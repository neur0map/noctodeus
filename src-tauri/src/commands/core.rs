use std::fs;
use std::path::{Path, PathBuf};

use chrono::Utc;
use serde::{Deserialize, Serialize};
use tauri::{Emitter, State};

use crate::core::manifest::{create_manifest, ensure_noctodeus_dir, load_manifest};
use crate::core::state::{ActiveCore, AppState, CoreInfo};
use crate::db::{create_pool, run_all_migrations, DbPool};
use crate::db::links;
use crate::db::mutations;
use crate::db::queries::FileInfo;
use crate::errors::{CmdResult, NoctoError};
use crate::indexer::{fts, incremental, scanner};
use crate::watcher::DebouncedWatcher;

/// Persisted registry entry stored in `cores.json` inside the app data dir.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoreEntry {
    pub id: String,
    pub name: String,
    pub path: String,
    pub last_opened: Option<String>,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Returns the path to `cores.json` in the OS app data directory.
fn cores_json_path() -> Result<PathBuf, NoctoError> {
    let base = dirs::data_dir().ok_or_else(|| NoctoError::Unexpected {
        detail: "Could not determine app data directory".to_string(),
    })?;
    let app_dir = base.join("com.noctodeus.app");
    if !app_dir.exists() {
        fs::create_dir_all(&app_dir)?;
    }
    Ok(app_dir.join("cores.json"))
}

/// Reads the cores registry from disk. Returns an empty vec if the file
/// doesn't exist yet.
fn read_cores_registry() -> Result<Vec<CoreEntry>, NoctoError> {
    let path = cores_json_path()?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let contents = fs::read_to_string(&path)?;
    let entries: Vec<CoreEntry> = serde_json::from_str(&contents)?;
    Ok(entries)
}

/// Public access to the cores registry for sync.
pub fn read_cores_registry_pub() -> Result<Vec<CoreEntry>, NoctoError> {
    read_cores_registry()
}

/// Writes the cores registry back to disk.
fn write_cores_registry(entries: &[CoreEntry]) -> Result<(), NoctoError> {
    let path = cores_json_path()?;
    let json = serde_json::to_string_pretty(entries)?;
    fs::write(&path, json)?;
    Ok(())
}

/// Opens (or creates) the SQLite database at `.noctodeus/meta.db`,
/// creates a connection pool, and runs migrations on one connection.
fn open_db(core_path: &Path) -> Result<crate::db::DbPool, NoctoError> {
    let pool = create_pool(core_path)?;

    // Run migrations on a connection from the pool.
    let conn = pool.get().map_err(|e| NoctoError::Unexpected {
        detail: format!("Failed to get connection from pool: {e}"),
    })?;
    run_all_migrations(&conn)?;

    Ok(pool)
}

/// Upserts a core entry in the registry (updates name/last_opened if the id
/// already exists, otherwise appends).
fn upsert_registry_entry(entry: CoreEntry) -> Result<(), NoctoError> {
    let mut entries = read_cores_registry()?;
    if let Some(existing) = entries.iter_mut().find(|e| e.id == entry.id) {
        existing.name = entry.name;
        existing.path = entry.path;
        existing.last_opened = entry.last_opened;
    } else {
        entries.push(entry);
    }
    write_cores_registry(&entries)?;
    Ok(())
}

/// Start the file watcher and spawn a background task that processes
/// debounced file changes through the incremental indexer, emitting
/// Tauri events to the frontend for each change.
///
/// Returns a `oneshot::Sender` that can be used to shut down the watcher.
fn start_watcher(
    core_path: &Path,
    pool: DbPool,
    app_handle: tauri::AppHandle,
) -> Result<tokio::sync::oneshot::Sender<()>, NoctoError> {
    let watcher = DebouncedWatcher::start(core_path)?;
    let (shutdown_tx, mut shutdown_rx) = tokio::sync::oneshot::channel::<()>();

    let watch_path = core_path.to_path_buf();

    tokio::spawn(async move {
        loop {
            tokio::select! {
                _ = &mut shutdown_rx => {
                    watcher.stop();
                    tracing::debug!("watcher task shutting down");
                    break;
                }
                _ = tokio::time::sleep(std::time::Duration::from_millis(50)) => {
                    if let Ok(batch) = watcher.receiver().try_recv() {
                        if let Ok(conn) = pool.get() {
                            match incremental::process_changes(&conn, &watch_path, &batch) {
                                Ok(events) => {
                                    for event in events {
                                        let _ = app_handle.emit("file-event", &event);
                                    }
                                }
                                Err(e) => {
                                    tracing::error!("incremental indexer error: {e}");
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    Ok(shutdown_tx)
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

/// Create a new Core in an existing folder.
///
/// 1. Validates the folder exists
/// 2. Creates `.noctodeus/` directory structure
/// 3. Writes `config.toml` manifest
/// 4. Opens SQLite DB with migrations
/// 5. Registers in `cores.json`
#[tauri::command]
pub async fn core_create(path: String, name: String, app: tauri::AppHandle, state: State<'_, AppState>) -> CmdResult<CoreInfo> {
    let core_path = PathBuf::from(&path);

    if !core_path.is_dir() {
        return Err(NoctoError::CoreNotFound { path: path.clone() });
    }

    // Refuse to re-initialize an existing Core.
    let noctodeus_dir = core_path.join(".noctodeus");
    if noctodeus_dir.join("config.toml").exists() {
        return Err(NoctoError::PathConflict {
            path: format!("{} already contains a Core", path),
        });
    }

    ensure_noctodeus_dir(&core_path)?;
    let manifest = create_manifest(&core_path, &name)?;

    // Populate welcome content for new cores (non-fatal if it fails)
    if let Err(e) = crate::core::welcome::write_welcome_content(&core_path) {
        tracing::warn!("failed to write welcome content: {e}");
    }

    let pool = open_db(&core_path)?;

    let now = Utc::now().to_rfc3339();

    let info = CoreInfo {
        id: manifest.core.id.clone(),
        name: manifest.core.name.clone(),
        path: path.clone(),
        created_at: manifest.core.created_at.clone(),
        last_opened: Some(now.clone()),
    };

    // Start file watcher for incremental indexing
    let watcher_shutdown = start_watcher(&core_path, pool.clone(), app)
        .map(Some)
        .unwrap_or_else(|e| {
            tracing::warn!("failed to start file watcher: {e}");
            None
        });

    let active = ActiveCore {
        info: info.clone(),
        db: pool,
        core_path: core_path.clone(),
        watcher_shutdown,
    };

    {
        let mut lock = state.active_core.write().await;
        *lock = Some(active);
    }

    upsert_registry_entry(CoreEntry {
        id: info.id.clone(),
        name: info.name.clone(),
        path: path.clone(),
        last_opened: Some(now),
    })?;

    Ok(info)
}

/// Open an existing Core and set it as the active core.
///
/// 1. Validates folder and `.noctodeus/` exist
/// 2. Loads manifest
/// 3. Opens SQLite DB
/// 4. Stores as active core in AppState
/// 5. Updates registry last_opened
#[tauri::command]
pub async fn core_open(path: String, app: tauri::AppHandle, state: State<'_, AppState>) -> CmdResult<CoreInfo> {
    let core_path = PathBuf::from(&path);

    if !core_path.is_dir() {
        return Err(NoctoError::CoreNotFound { path: path.clone() });
    }

    let noctodeus_dir = core_path.join(".noctodeus");
    if !noctodeus_dir.exists() {
        return Err(NoctoError::CoreNotFound { path: path.clone() });
    }

    let manifest = load_manifest(&core_path)?;
    let pool = open_db(&core_path)?;
    let now = Utc::now().to_rfc3339();

    let info = CoreInfo {
        id: manifest.core.id.clone(),
        name: manifest.core.name.clone(),
        path: path.clone(),
        created_at: manifest.core.created_at.clone(),
        last_opened: Some(now.clone()),
    };

    // Start file watcher for incremental indexing
    let watcher_shutdown = start_watcher(&core_path, pool.clone(), app)
        .map(Some)
        .unwrap_or_else(|e| {
            tracing::warn!("failed to start file watcher: {e}");
            None
        });

    let active = ActiveCore {
        info: info.clone(),
        db: pool,
        core_path: core_path.clone(),
        watcher_shutdown,
    };

    {
        let mut lock = state.active_core.write().await;
        *lock = Some(active);
    }

    upsert_registry_entry(CoreEntry {
        id: info.id.clone(),
        name: info.name.clone(),
        path,
        last_opened: Some(now),
    })?;

    Ok(info)
}

/// Close the currently-active Core, stopping the watcher and releasing resources.
#[tauri::command]
pub async fn core_close(state: State<'_, AppState>) -> CmdResult<()> {
    let mut lock = state.active_core.write().await;
    if let Some(mut active) = lock.take() {
        // Stop the file watcher before dropping.
        if let Some(tx) = active.watcher_shutdown.take() {
            let _ = tx.send(());
        }
        tracing::info!("core closed, watcher stopped");
    }
    Ok(())
}

/// Scan the active Core's directory, populate SQLite index and FTS, return the
/// full file tree. Called by the frontend after opening/creating a Core.
#[tauri::command]
pub async fn core_scan(state: State<'_, AppState>) -> CmdResult<Vec<FileInfo>> {
    let core = state.active_core.read().await;
    let active = core.as_ref().ok_or(NoctoError::CoreNotFound {
        path: String::new(),
    })?;

    let files = scanner::scan_directory(&active.core_path)?;

    let conn = active.db.get().map_err(|e| NoctoError::Unexpected {
        detail: format!("Failed to get DB connection: {e}"),
    })?;

    // Clear and rebuild the file index
    mutations::clear_files(&conn)?;
    for f in &files {
        mutations::upsert_file(&conn, f)?;
    }

    // Rebuild FTS from markdown files
    fts::rebuild_fts(&conn, &active.core_path)?;

    // Rebuild links table from markdown files
    links::clear_links(&conn)?;
    let file_names: Vec<(&str, String)> = files
        .iter()
        .filter(|f| !f.is_directory)
        .filter(|f| {
            matches!(
                f.extension.as_deref(),
                Some("md") | Some("markdown") | Some("mdx")
            )
        })
        .map(|f| {
            let name_no_ext = f
                .name
                .rsplit_once('.')
                .map(|(stem, _)| stem.to_string())
                .unwrap_or_else(|| f.name.clone());
            (f.path.as_str(), name_no_ext)
        })
        .collect();

    let lookup: Vec<(&str, &str)> = file_names
        .iter()
        .map(|(path, name)| (*path, name.as_str()))
        .collect();

    for (path, _) in &file_names {
        let abs_path = active.core_path.join(path);
        if let Ok(content) = std::fs::read_to_string(&abs_path) {
            links::replace_links_for_source(&conn, path, &content, &lookup)?;
        }
    }

    Ok(files)
}

/// List all known Cores from the registry. Entries whose folders no longer
/// exist on disk get `last_opened` set to `None` (acts as a "missing" flag
/// the frontend can use to show a badge).
#[tauri::command]
pub fn core_list() -> CmdResult<Vec<CoreInfo>> {
    let entries = read_cores_registry()?;

    let infos: Vec<CoreInfo> = entries
        .iter()
        .map(|e| {
            let exists = PathBuf::from(&e.path).is_dir();
            CoreInfo {
                id: e.id.clone(),
                name: e.name.clone(),
                path: e.path.clone(),
                created_at: String::new(), // Not stored in registry; load manifest for full data
                last_opened: if exists {
                    e.last_opened.clone()
                } else {
                    None
                },
            }
        })
        .collect();

    Ok(infos)
}
