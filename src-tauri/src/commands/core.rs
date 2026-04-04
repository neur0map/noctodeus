use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use chrono::Utc;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::core::manifest::{create_manifest, ensure_noctodeus_dir, load_manifest};
use crate::core::state::{ActiveCore, AppState, CoreInfo};
use crate::db::mutations;
use crate::db::queries::FileInfo;
use crate::db::schema::run_migrations;
use crate::errors::{CmdResult, NoctoError};
use crate::indexer::{fts, scanner};

/// Persisted registry entry stored in `cores.json` inside the app data dir.
#[derive(Debug, Clone, Serialize, Deserialize)]
struct CoreEntry {
    id: String,
    name: String,
    path: String,
    last_opened: Option<String>,
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

/// Writes the cores registry back to disk.
fn write_cores_registry(entries: &[CoreEntry]) -> Result<(), NoctoError> {
    let path = cores_json_path()?;
    let json = serde_json::to_string_pretty(entries)?;
    fs::write(&path, json)?;
    Ok(())
}

/// Opens (or creates) the SQLite database at `.noctodeus/meta.db` with WAL
/// mode enabled, then runs migrations.
fn open_db(core_path: &Path) -> Result<Connection, NoctoError> {
    let db_path = core_path.join(".noctodeus").join("meta.db");
    let conn = Connection::open(&db_path)?;
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
    run_migrations(&conn)?;
    Ok(conn)
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
pub async fn core_create(path: String, name: String, state: State<'_, AppState>) -> CmdResult<CoreInfo> {
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
    let conn = open_db(&core_path)?;

    let now = Utc::now().to_rfc3339();

    let info = CoreInfo {
        id: manifest.core.id.clone(),
        name: manifest.core.name.clone(),
        path: path.clone(),
        created_at: manifest.core.created_at.clone(),
        last_opened: Some(now.clone()),
    };

    let active = ActiveCore {
        info: info.clone(),
        db: Arc::new(Mutex::new(conn)),
        core_path: core_path.clone(),
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
pub async fn core_open(path: String, state: State<'_, AppState>) -> CmdResult<CoreInfo> {
    let core_path = PathBuf::from(&path);

    if !core_path.is_dir() {
        return Err(NoctoError::CoreNotFound { path: path.clone() });
    }

    let noctodeus_dir = core_path.join(".noctodeus");
    if !noctodeus_dir.exists() {
        return Err(NoctoError::CoreNotFound { path: path.clone() });
    }

    let manifest = load_manifest(&core_path)?;
    let conn = open_db(&core_path)?;
    let now = Utc::now().to_rfc3339();

    let info = CoreInfo {
        id: manifest.core.id.clone(),
        name: manifest.core.name.clone(),
        path: path.clone(),
        created_at: manifest.core.created_at.clone(),
        last_opened: Some(now.clone()),
    };

    let active = ActiveCore {
        info: info.clone(),
        db: Arc::new(Mutex::new(conn)),
        core_path: core_path.clone(),
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

/// Close the currently-active Core, releasing its DB connection and resources.
#[tauri::command]
pub async fn core_close(state: State<'_, AppState>) -> CmdResult<()> {
    let mut lock = state.active_core.write().await;
    // Dropping the ActiveCore closes the rusqlite Connection.
    *lock = None;
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

    let conn = active.db.lock().map_err(|e| NoctoError::Unexpected {
        detail: format!("DB lock poisoned: {e}"),
    })?;

    // Clear and rebuild the file index
    mutations::clear_files(&conn)?;
    for f in &files {
        mutations::upsert_file(&conn, f)?;
    }

    // Rebuild FTS from markdown files
    fts::rebuild_fts(&conn, &active.core_path)?;

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
