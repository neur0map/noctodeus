use rusqlite::Connection;
use serde::Serialize;
use std::fs;
use std::path::Path;
use tracing::{debug, error};

use crate::normalize_path;

use crate::db::links;
use crate::db::mutations;
use crate::db::queries::{self, FileInfo};
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

    // Add to FTS and links if it's a markdown file.
    if !file_info.is_directory && is_markdown(&file_info.name) {
        if let Ok(content) = fs::read_to_string(abs_path) {
            fts::update_fts_entry(conn, &file_info.path, file_info.title.as_deref(), &content)?;
            update_links_for_file(conn, &file_info.path, &content);
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

    // Update FTS and links for markdown files.
    if !file_info.is_directory && is_markdown(&file_info.name) {
        if let Ok(content) = fs::read_to_string(abs_path) {
            fts::update_fts_entry(conn, &file_info.path, file_info.title.as_deref(), &content)?;
            update_links_for_file(conn, &file_info.path, &content);
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
    let rel_path = normalize_path(&abs_path
        .strip_prefix(core_path)
        .unwrap_or(abs_path)
        .to_string_lossy());

    // Remove from all tables.
    mutations::delete_file(conn, &rel_path)?;
    fts::remove_fts_entry(conn, &rel_path)?;
    links::delete_links_for_path(conn, &rel_path)?;

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
    let old_rel = normalize_path(&from_abs
        .strip_prefix(core_path)
        .unwrap_or(from_abs)
        .to_string_lossy());

    // Scan the new path to get full metadata.
    let file_info = scan_single_file(core_path, to_abs)?;
    let new_rel = file_info.path.clone();

    // Update the path in files table and cascade to recents/pinned.
    mutations::rename_file(conn, &old_rel, &new_rel)?;

    // Update remaining fields (title, hash, size, etc.) that may have changed.
    mutations::upsert_file(conn, &file_info)?;

    // Update FTS: remove old entry, add new one.
    fts::remove_fts_entry(conn, &old_rel)?;
    // Update links: remove old, re-index new.
    links::delete_links_for_path(conn, &old_rel)?;
    if !file_info.is_directory && is_markdown(&file_info.name) {
        if let Ok(content) = fs::read_to_string(to_abs) {
            fts::update_fts_entry(conn, &new_rel, file_info.title.as_deref(), &content)?;
            update_links_for_file(conn, &new_rel, &content);
        }
    }

    debug!(old_path = %old_rel, new_path = %new_rel, "re-indexed renamed file");

    Ok(FileEvent::Renamed {
        old_path: old_rel,
        new_path: new_rel,
        metadata: file_info,
    })
}

/// Re-index outgoing wiki-links for a single file.
/// Queries all files to build the name lookup. Acceptable for vaults <5k files;
/// a future optimization could cache this lookup.
fn update_links_for_file(conn: &Connection, path: &str, content: &str) {
    if let Ok(all_files) = queries::get_all_files(conn) {
        let file_names: Vec<(String, String)> = all_files
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
                (f.path.clone(), name_no_ext)
            })
            .collect();
        let lookup: Vec<(&str, &str)> = file_names
            .iter()
            .map(|(p, n)| (p.as_str(), n.as_str()))
            .collect();
        let _ = links::replace_links_for_source(conn, path, content, &lookup);
    }
}

use crate::indexer::util::is_markdown;
