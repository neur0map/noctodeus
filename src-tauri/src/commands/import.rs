use std::fs;
use std::path::PathBuf;

use tauri::{Emitter, State};

use crate::core::manifest::{create_manifest, ensure_noctodeus_dir};
use crate::core::state::AppState;
use crate::db::{create_pool, run_all_migrations};
use crate::errors::{CmdResult, NoctoError};
use crate::import::obsidian::{self, ImportProgress, VaultScan};

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

/// Scan an Obsidian vault directory and return a summary of its contents.
#[tauri::command]
pub fn import_scan(vault_path: String) -> CmdResult<VaultScan> {
    let path = PathBuf::from(&vault_path);
    obsidian::scan_vault(&path)
}

/// Import an Obsidian vault into a Noctodeus core.
///
/// If `create_new_core` is true, a new core is created at `target_path` with
/// the given `core_name`. Otherwise the target must already be an existing core
/// (i.e., contain a `.noctodeus/` directory).
///
/// After copying files, a full `core_scan` is triggered so the index is
/// up-to-date.
#[tauri::command]
pub async fn import_obsidian(
    vault_path: String,
    target_path: String,
    create_new_core: bool,
    core_name: Option<String>,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> CmdResult<obsidian::ImportResult> {
    let vault = PathBuf::from(&vault_path);
    let target = PathBuf::from(&target_path);

    if !vault.is_dir() {
        return Err(NoctoError::FileNotFound {
            path: vault_path.clone(),
        });
    }

    if create_new_core {
        // Create the target directory if it doesn't exist.
        if !target.exists() {
            fs::create_dir_all(&target)?;
        }

        let name = core_name
            .as_deref()
            .unwrap_or("Imported Vault");

        // Initialise the .noctodeus directory structure and manifest.
        ensure_noctodeus_dir(&target)?;
        let manifest = create_manifest(&target, name)?;

        // Open and migrate the database.
        let pool = create_pool(&target)?;
        {
            let conn = pool.get().map_err(|e| NoctoError::Unexpected {
                detail: format!("Failed to get connection from pool: {e}"),
            })?;
            run_all_migrations(&conn)?;
        }

        // Register the core in AppState so core_scan can operate on it.
        let now = chrono::Utc::now().to_rfc3339();
        let info = crate::core::state::CoreInfo {
            id: manifest.core.id.clone(),
            name: manifest.core.name.clone(),
            path: target_path.clone(),
            created_at: manifest.core.created_at.clone(),
            last_opened: Some(now.clone()),
        };

        // Start file watcher.
        let watcher_shutdown = crate::watcher::DebouncedWatcher::start(&target)
            .ok()
            .map(|watcher| {
                let (tx, mut rx) = tokio::sync::oneshot::channel::<()>();
                let watch_pool = pool.clone();
                let watch_path = target.clone();
                let watch_app = app.clone();
                tokio::spawn(async move {
                    loop {
                        tokio::select! {
                            _ = &mut rx => {
                                watcher.stop();
                                break;
                            }
                            _ = tokio::time::sleep(std::time::Duration::from_millis(50)) => {
                                if let Ok(batch) = watcher.receiver().try_recv() {
                                    if let Ok(conn) = watch_pool.get() {
                                        match crate::indexer::incremental::process_changes(&conn, &watch_path, &batch) {
                                            Ok(events) => {
                                                for event in events {
                                                    let _ = watch_app.emit("file-event", &event);
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
                tx
            });

        let active = crate::core::state::ActiveCore {
            info: info.clone(),
            db: pool,
            core_path: target.clone(),
            watcher_shutdown,
        };

        {
            let mut lock = state.active_core.write().await;
            *lock = Some(active);
        }

        // Persist to cores.json registry.
        super::core::upsert_registry_entry(super::core::CoreEntry {
            id: info.id.clone(),
            name: info.name.clone(),
            path: target_path.clone(),
            last_opened: Some(now),
        })?;
    } else {
        // Verify the target is an existing core.
        let noctodeus_dir = target.join(".noctodeus");
        if !noctodeus_dir.exists() {
            return Err(NoctoError::CoreNotFound {
                path: target_path.clone(),
            });
        }
    }

    // Import vault files into the target core.
    let emit_app = app.clone();
    let result = obsidian::import_vault(&vault, &target, move |progress: ImportProgress| {
        let _ = emit_app.emit("import-progress", &progress);
    })?;

    // Run core_scan to index everything.
    // The core must be in AppState (either just created above or already active).
    let core_lock = state.active_core.read().await;
    let active = core_lock.as_ref().ok_or(NoctoError::CoreNotFound {
        path: target_path.clone(),
    })?;

    let files = crate::indexer::scanner::scan_directory(&active.core_path)?;
    let conn = active.db.get().map_err(|e| NoctoError::Unexpected {
        detail: format!("Failed to get DB connection: {e}"),
    })?;

    crate::db::mutations::clear_files(&conn)?;
    for f in &files {
        crate::db::mutations::upsert_file(&conn, f)?;
    }
    crate::indexer::fts::rebuild_fts(&conn, &active.core_path)?;

    crate::db::links::clear_links(&conn)?;
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
            crate::db::links::replace_links_for_source(&conn, path, &content, &lookup)?;
        }
    }

    Ok(result)
}
