use rusqlite::Connection;
use serde::Serialize;
use std::fs;
use std::path::Path;
use tracing::{debug, error};

use crate::db::mutations;
use crate::db::queries::FileInfo;
use crate::errors::NoctoError;
use crate::indexer::fts;
use crate::indexer::scanner::scan_single_file;
use crate::watcher::debounce::FileChange;

/// Typed event to emit to the frontend via Tauri's event system.
/// The `tag` + `content` serde representation matches the Tauri event
/// protocol so the frontend receives `{ type: "Created", payload: { ... } }`.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", content = "payload")]
pub enum FileEvent {
    Created {
        path: String,
        metadata: FileInfo,
    },
    Modified {
        path: String,
        metadata: FileInfo,
    },
    Deleted {
        path: String,
    },
    Renamed {
        old_path: String,
        new_path: String,
        metadata: FileInfo,
    },
}

/// Process a batch of debounced file changes: update the SQLite index,
/// update the FTS index, and return a list of typed events to emit to
/// the frontend.
pub fn process_changes(
    conn: &Connection,
    core_path: &Path,
    changes: &[FileChange],
) -> Result<Vec<FileEvent>, NoctoError> {
    let mut events = Vec::new();

    for change in changes {
        match change {
            FileChange::Created(path) => {
                match handle_created(conn, core_path, path) {
                    Ok(event) => events.push(event),
                    Err(e) => {
                        error!(path = %path.display(), error = %e, "failed to process created file");
                    }
                }
            }
            FileChange::Modified(path) => {
                match handle_modified(conn, core_path, path) {
                    Ok(event) => events.push(event),
                    Err(e) => {
                        error!(path = %path.display(), error = %e, "failed to process modified file");
                    }
                }
            }
            FileChange::Deleted(path) => {
                match handle_deleted(conn, core_path, path) {
                    Ok(event) => events.push(event),
                    Err(e) => {
                        error!(path = %path.display(), error = %e, "failed to process deleted file");
                    }
                }
            }
            FileChange::Renamed { from, to } => {
                match handle_renamed(conn, core_path, from, to) {
                    Ok(event) => events.push(event),
                    Err(e) => {
                        error!(
                            from = %from.display(), to = %to.display(),
                            error = %e, "failed to process renamed file"
                        );
                    }
                }
            }
        }
    }

    debug!(count = events.len(), "processed change batch");
    Ok(events)
}

/// Handle a newly created file or directory.
fn handle_created(
    conn: &Connection,
    core_path: &Path,
    abs_path: &Path,
) -> Result<FileEvent, NoctoError> {
    let file_info = scan_single_file(core_path, abs_path)?;
    mutations::upsert_file(conn, &file_info)?;

    // Add to FTS if it's a markdown file.
    if !file_info.is_directory && is_markdown(&file_info.name) {
        if let Ok(content) = fs::read_to_string(abs_path) {
            fts::update_fts_entry(conn, &file_info.path, file_info.title.as_deref(), &content)?;
        }
    }

    let rel_path = file_info.path.clone();
    debug!(path = %rel_path, "indexed new file");

    Ok(FileEvent::Created {
        path: rel_path,
        metadata: file_info,
    })
}

/// Handle a modified file.
fn handle_modified(
    conn: &Connection,
    core_path: &Path,
    abs_path: &Path,
) -> Result<FileEvent, NoctoError> {
    let file_info = scan_single_file(core_path, abs_path)?;
    mutations::upsert_file(conn, &file_info)?;

    // Update FTS for markdown files.
    if !file_info.is_directory && is_markdown(&file_info.name) {
        if let Ok(content) = fs::read_to_string(abs_path) {
            fts::update_fts_entry(conn, &file_info.path, file_info.title.as_deref(), &content)?;
        }
    }

    let rel_path = file_info.path.clone();
    debug!(path = %rel_path, "re-indexed modified file");

    Ok(FileEvent::Modified {
        path: rel_path,
        metadata: file_info,
    })
}

/// Handle a deleted file or directory.
fn handle_deleted(
    conn: &Connection,
    core_path: &Path,
    abs_path: &Path,
) -> Result<FileEvent, NoctoError> {
    let rel_path = abs_path
        .strip_prefix(core_path)
        .unwrap_or(abs_path)
        .to_string_lossy()
        .to_string();

    // Remove from all tables.
    mutations::delete_file(conn, &rel_path)?;
    fts::remove_fts_entry(conn, &rel_path)?;

    debug!(path = %rel_path, "removed deleted file from index");

    Ok(FileEvent::Deleted { path: rel_path })
}

/// Handle a renamed file or directory.
fn handle_renamed(
    conn: &Connection,
    core_path: &Path,
    from_abs: &Path,
    to_abs: &Path,
) -> Result<FileEvent, NoctoError> {
    let old_rel = from_abs
        .strip_prefix(core_path)
        .unwrap_or(from_abs)
        .to_string_lossy()
        .to_string();

    // Scan the new path to get full metadata.
    let file_info = scan_single_file(core_path, to_abs)?;
    let new_rel = file_info.path.clone();

    // Update the path in files table and cascade to recents/pinned.
    mutations::rename_file(conn, &old_rel, &new_rel)?;

    // Update remaining fields (title, hash, size, etc.) that may have changed.
    mutations::upsert_file(conn, &file_info)?;

    // Update FTS: remove old entry, add new one.
    fts::remove_fts_entry(conn, &old_rel)?;
    if !file_info.is_directory && is_markdown(&file_info.name) {
        if let Ok(content) = fs::read_to_string(to_abs) {
            fts::update_fts_entry(conn, &new_rel, file_info.title.as_deref(), &content)?;
        }
    }

    debug!(old_path = %old_rel, new_path = %new_rel, "re-indexed renamed file");

    Ok(FileEvent::Renamed {
        old_path: old_rel,
        new_path: new_rel,
        metadata: file_info,
    })
}

/// Check if a file name indicates a markdown file.
fn is_markdown(name: &str) -> bool {
    let lower = name.to_lowercase();
    lower.ends_with(".md") || lower.ends_with(".markdown") || lower.ends_with(".mdx")
}
