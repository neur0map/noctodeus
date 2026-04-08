use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::normalize_path;

use crate::core::state::AppState;
use crate::db::mutations;
use crate::db::pool::DbPool;
use crate::db::queries::FileInfo;
use crate::errors::NoctoError;

/// File content returned when reading a file.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileContent {
    pub path: String,
    pub content: String,
    pub metadata: FileInfo,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Get the DB pool from the active core, or error if no core is open.
async fn get_db(state: &tauri::State<'_, AppState>) -> Result<DbPool, NoctoError> {
    let core = state.active_core.read().await;
    match core.as_ref() {
        Some(active) => Ok(active.db.clone()),
        None => Err(NoctoError::CoreNotFound {
            path: String::new(),
        }),
    }
}

/// Resolve a relative path to an absolute path within the active core root.
/// Returns an error if no core is open.
async fn resolve_path(
    state: &tauri::State<'_, AppState>,
    relative: &str,
) -> Result<std::path::PathBuf, NoctoError> {
    let core = state.active_core.read().await;
    match core.as_ref() {
        Some(active) => Ok(active.core_path.join(relative)),
        None => Err(NoctoError::CoreNotFound {
            path: String::new(),
        }),
    }
}

/// Build a basic FileInfo from filesystem metadata.
/// Used as a return value after file operations (before the watcher indexes it).
fn file_info_from_path(abs_path: &Path, core_root: &Path) -> Result<FileInfo, NoctoError> {
    let relative = normalize_path(&abs_path
        .strip_prefix(core_root)
        .unwrap_or(abs_path)
        .to_string_lossy());

    let name = abs_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    let extension = abs_path
        .extension()
        .map(|e| e.to_string_lossy().to_string());

    let parent = abs_path
        .parent()
        .map(|p| {
            let rel = normalize_path(&p.strip_prefix(core_root)
                .unwrap_or(p)
                .to_string_lossy());
            if rel.is_empty() { ".".to_string() } else { rel }
        })
        .unwrap_or_else(|| ".".to_string());

    let metadata = std::fs::metadata(abs_path).ok();
    let size = metadata.as_ref().map(|m| m.len() as i64);
    let modified_at = metadata
        .as_ref()
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs() as i64);

    let is_directory = metadata.as_ref().map(|m| m.is_dir()).unwrap_or(false);

    Ok(FileInfo {
        path: relative,
        parent_dir: parent,
        name,
        extension,
        title: None,
        size,
        modified_at,
        content_hash: None,
        is_directory,
        aliases: Vec::new(),
    })
}

// ---------------------------------------------------------------------------
// File commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn file_create(
    path: String,
    content: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<FileInfo, NoctoError> {
    let abs_path = resolve_path(&state, &path).await?;

    if abs_path.exists() {
        return Err(NoctoError::PathConflict {
            path: path.clone(),
        });
    }

    // Ensure the parent directory exists.
    if let Some(parent) = abs_path.parent() {
        if !parent.exists() {
            std::fs::create_dir_all(parent)?;
        }
    }

    // Write file to disk (empty or with content).
    let file_content = content.unwrap_or_default();
    std::fs::write(&abs_path, &file_content)?;

    let core = state.active_core.read().await;
    let active = core.as_ref().unwrap();
    let core_root = &active.core_path;
    let info = file_info_from_path(&abs_path, core_root)?;

    // Insert into FTS for markdown files
    let ext = abs_path.extension().and_then(|e| e.to_str()).unwrap_or("");
    if ext == "md" || ext == "markdown" || ext == "mdx" {
        let db = active.db.clone();
        let conn = db.get().map_err(|e| NoctoError::Unexpected {
            detail: format!("Failed to get DB connection: {e}"),
        })?;
        let _ = crate::indexer::fts::update_fts_entry(
            &conn,
            &path,
            info.title.as_deref(),
            &file_content,
        );

        // Background memvid index (lexical-only, non-blocking)
        let cp = active.core_path.clone();
        let path_clone = path.clone();
        let content_clone = file_content.clone();
        tokio::spawn(async move {
            let _ = tokio::task::spawn_blocking(move || {
                if let Ok(mut mv) = crate::ai::memory::open_memory(&cp) {
                    let _ = crate::ai::memory::index_note(&mut mv, &path_clone, None, &content_clone, None);
                    let _ = mv.commit();
                }
            }).await;
        });
    }

    Ok(info)
}

#[tauri::command]
pub async fn file_read(
    path: String,
    state: tauri::State<'_, AppState>,
) -> Result<FileContent, NoctoError> {
    let abs_path = resolve_path(&state, &path).await?;

    if !abs_path.exists() {
        return Err(NoctoError::FileNotFound { path: path.clone() });
    }

    let content = std::fs::read_to_string(&abs_path)?;

    // Update recents in DB.
    let db = get_db(&state).await?;
    {
        let conn = db.get().map_err(|e| NoctoError::Unexpected {
            detail: format!("Failed to get DB connection: {e}"),
        })?;
        mutations::add_recent(&conn, &path)?;
    }

    let core = state.active_core.read().await;
    let core_root = &core.as_ref().unwrap().core_path;
    let metadata = file_info_from_path(&abs_path, core_root)?;

    Ok(FileContent {
        path,
        content,
        metadata,
    })
}

#[tauri::command]
pub async fn file_write(
    path: String,
    content: String,
    state: tauri::State<'_, AppState>,
) -> Result<FileInfo, NoctoError> {
    let abs_path = resolve_path(&state, &path).await?;

    if !abs_path.exists() {
        return Err(NoctoError::FileNotFound { path: path.clone() });
    }

    std::fs::write(&abs_path, &content)?;

    let core = state.active_core.read().await;
    let active = core.as_ref().unwrap();
    let core_root = &active.core_path;
    let mut info = file_info_from_path(&abs_path, core_root)?;
    info.content_hash = Some(crate::indexer::scanner::hash_bytes(content.as_bytes()));

    // Update FTS index for markdown files
    let ext = abs_path.extension().and_then(|e| e.to_str()).unwrap_or("");
    if ext == "md" || ext == "markdown" || ext == "mdx" {
        let db = active.db.clone();
        let conn = db.get().map_err(|e| NoctoError::Unexpected {
            detail: format!("Failed to get DB connection: {e}"),
        })?;
        let _ = crate::indexer::fts::update_fts_entry(
            &conn,
            &path,
            info.title.as_deref(),
            &content,
        );

        // Background memvid index (lexical-only, non-blocking)
        let cp = active.core_path.clone();
        let path_clone = path.clone();
        let content_clone = content.clone();
        tokio::spawn(async move {
            let _ = tokio::task::spawn_blocking(move || {
                if let Ok(mut mv) = crate::ai::memory::open_memory(&cp) {
                    let _ = crate::ai::memory::index_note(&mut mv, &path_clone, None, &content_clone, None);
                    let _ = mv.commit();
                }
            }).await;
        });
    }

    Ok(info)
}

#[tauri::command]
pub async fn file_delete(
    path: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), NoctoError> {
    let abs_path = resolve_path(&state, &path).await?;

    if !abs_path.exists() {
        return Err(NoctoError::FileNotFound { path: path.clone() });
    }

    // Remove from FTS before deleting
    if let Ok(db) = get_db(&state).await {
        if let Ok(conn) = db.get() {
            let _ = crate::indexer::fts::remove_fts_entry(&conn, &path);
        }
    }

    // Move to OS trash instead of permanent delete.
    trash::delete(&abs_path).map_err(|e| NoctoError::Unexpected {
        detail: format!("Trash failed: {e}"),
    })?;

    Ok(())
}

#[tauri::command]
pub async fn file_rename(
    old_path: String,
    new_path: String,
    state: tauri::State<'_, AppState>,
) -> Result<FileInfo, NoctoError> {
    let abs_old = resolve_path(&state, &old_path).await?;
    let abs_new = resolve_path(&state, &new_path).await?;

    if !abs_old.exists() {
        return Err(NoctoError::FileNotFound {
            path: old_path.clone(),
        });
    }

    if abs_new.exists() {
        return Err(NoctoError::PathConflict {
            path: new_path.clone(),
        });
    }

    std::fs::rename(&abs_old, &abs_new)?;

    let core = state.active_core.read().await;
    let core_root = &core.as_ref().unwrap().core_path;
    file_info_from_path(&abs_new, core_root)
}

#[tauri::command]
pub async fn file_move(
    path: String,
    new_parent: String,
    state: tauri::State<'_, AppState>,
) -> Result<FileInfo, NoctoError> {
    let abs_src = resolve_path(&state, &path).await?;
    let abs_parent = resolve_path(&state, &new_parent).await?;

    if !abs_src.exists() {
        return Err(NoctoError::FileNotFound { path: path.clone() });
    }

    if !abs_parent.is_dir() {
        return Err(NoctoError::FileNotFound {
            path: new_parent.clone(),
        });
    }

    let file_name = abs_src
        .file_name()
        .ok_or_else(|| NoctoError::Unexpected {
            detail: "Source path has no file name".to_string(),
        })?;

    let abs_dest = abs_parent.join(file_name);

    if abs_dest.exists() {
        return Err(NoctoError::PathConflict {
            path: abs_dest.to_string_lossy().to_string(),
        });
    }

    std::fs::rename(&abs_src, &abs_dest)?;

    let core = state.active_core.read().await;
    let core_root = &core.as_ref().unwrap().core_path;
    file_info_from_path(&abs_dest, core_root)
}

#[tauri::command]
pub async fn file_duplicate(
    path: String,
    state: tauri::State<'_, AppState>,
) -> Result<FileInfo, NoctoError> {
    let abs_path = resolve_path(&state, &path).await?;

    if !abs_path.exists() {
        return Err(NoctoError::FileNotFound { path: path.clone() });
    }

    let abs_dest = find_copy_name(&abs_path);

    std::fs::copy(&abs_path, &abs_dest)?;

    let core = state.active_core.read().await;
    let core_root = &core.as_ref().unwrap().core_path;
    file_info_from_path(&abs_dest, core_root)
}

// ---------------------------------------------------------------------------
// Directory commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn dir_create(
    path: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), NoctoError> {
    let abs_path = resolve_path(&state, &path).await?;

    if abs_path.exists() {
        return Err(NoctoError::PathConflict { path });
    }

    std::fs::create_dir_all(&abs_path)?;
    Ok(())
}

#[tauri::command]
pub async fn dir_delete(
    path: String,
    recursive: bool,
    state: tauri::State<'_, AppState>,
) -> Result<(), NoctoError> {
    let abs_path = resolve_path(&state, &path).await?;

    if !abs_path.exists() {
        return Err(NoctoError::FileNotFound { path: path.clone() });
    }

    if !abs_path.is_dir() {
        return Err(NoctoError::Unexpected {
            detail: format!("Not a directory: {path}"),
        });
    }

    // For non-recursive, check if directory is empty.
    if !recursive {
        let is_empty = std::fs::read_dir(&abs_path)
            .map_err(|e| NoctoError::Unexpected {
                detail: e.to_string(),
            })?
            .next()
            .is_none();

        if !is_empty {
            return Err(NoctoError::Unexpected {
                detail: format!("Directory not empty: {path}. Use recursive=true to delete."),
            });
        }
    }

    // Move to OS trash.
    trash::delete(&abs_path).map_err(|e| NoctoError::Unexpected {
        detail: format!("Trash failed: {e}"),
    })?;

    Ok(())
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/// Find a non-conflicting copy name: "file (copy).md", "file (copy 2).md", etc.
fn find_copy_name(original: &Path) -> std::path::PathBuf {
    let stem = original
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "file".to_string());

    let ext = original.extension().map(|e| e.to_string_lossy().to_string());

    let parent = original.parent().unwrap_or_else(|| Path::new("."));

    // First try: "stem (copy).ext"
    let first = make_name(&stem, " (copy)", ext.as_deref());
    let candidate = parent.join(&first);
    if !candidate.exists() {
        return candidate;
    }

    // Then try: "stem (copy 2).ext", "stem (copy 3).ext", ...
    for n in 2..=100 {
        let suffix = format!(" (copy {n})");
        let name = make_name(&stem, &suffix, ext.as_deref());
        let candidate = parent.join(&name);
        if !candidate.exists() {
            return candidate;
        }
    }

    // Fallback: use timestamp
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let suffix = format!(" (copy {ts})");
    let name = make_name(&stem, &suffix, ext.as_deref());
    parent.join(&name)
}

fn make_name(stem: &str, suffix: &str, ext: Option<&str>) -> String {
    match ext {
        Some(e) => format!("{stem}{suffix}.{e}"),
        None => format!("{stem}{suffix}"),
    }
}

// ---------------------------------------------------------------------------
// Media commands
// ---------------------------------------------------------------------------

/// Copy a file from an absolute source path into the core's `media/` directory.
/// Returns the relative path (e.g. `media/abc123.png`).
#[tauri::command]
pub async fn media_copy(
    source_path: String,
    state: tauri::State<'_, AppState>,
) -> Result<String, NoctoError> {
    let core = state.active_core.read().await;
    let active = core.as_ref().ok_or_else(|| NoctoError::CoreNotFound {
        path: String::new(),
    })?;
    let core_root = &active.core_path;

    let src = Path::new(&source_path);
    if !src.exists() {
        return Err(NoctoError::FileNotFound {
            path: source_path.clone(),
        });
    }

    // Ensure media/ directory exists
    let media_dir = core_root.join("media");
    if !media_dir.exists() {
        std::fs::create_dir_all(&media_dir)?;
    }

    // Generate unique filename: <timestamp_hex>-<short_hash>.<ext>
    let ext = src
        .extension()
        .map(|e| e.to_string_lossy().to_string())
        .unwrap_or_else(|| "bin".to_string());

    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();

    let filename = format!("{ts:x}.{ext}");
    let dest = media_dir.join(&filename);

    std::fs::copy(src, &dest)?;

    Ok(format!("media/{filename}"))
}
