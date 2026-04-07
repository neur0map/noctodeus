use std::fs;
use std::path::Path;
use std::time::SystemTime;

use sha2::{Digest, Sha256};
use tracing::{debug, warn};
use walkdir::WalkDir;

use crate::errors::NoctoError;

/// Snapshot of a file's state for mtime-based conflict detection.
#[derive(Debug, Clone)]
pub struct FileSnapshot {
    pub path: String,
    pub mtime: Option<u64>,
    pub hash: Option<String>,
}

/// Copy all files from a core's local path to its repo subdirectory.
/// First removes stale files from repo_subdir that no longer exist in core_path,
/// so that `git add -A` will detect deletions. Then copies all current files.
/// Returns the number of files copied.
pub fn copy_core_to_repo(core_path: &Path, repo_subdir: &Path) -> Result<u32, NoctoError> {
    // Clean repo subdir: remove files/dirs that shouldn't be synced
    // (either deleted from core, or match the exclusion filter)
    if repo_subdir.exists() {
        // First pass: remove excluded files and files missing from core
        for entry in WalkDir::new(repo_subdir).into_iter().flatten() {
            let name = entry.file_name().to_string_lossy();
            let path = entry.path();

            if entry.file_type().is_file() {
                // Remove OS junk and DB artifacts from repo
                if name == ".DS_Store" || name == "Thumbs.db" || name == "desktop.ini"
                    || name == "meta.db" || name == "meta.db-wal" || name == "meta.db-shm"
                {
                    let _ = fs::remove_file(path);
                    continue;
                }
                // Remove files that no longer exist in the core
                let rel = path.strip_prefix(repo_subdir).unwrap_or(path);
                let core_file = core_path.join(rel);
                if !core_file.exists() {
                    let _ = fs::remove_file(path);
                }
            }
        }
        // Second pass: remove excluded directories from repo
        // (walk again since removing during iteration is tricky with WalkDir)
        let excluded_dirs: &[&str] = &[".obsidian", ".logseq", "logseq", ".trash", ".git"];
        for dir_name in excluded_dirs {
            let dir_path = repo_subdir.join(dir_name);
            if dir_path.is_dir() {
                let _ = fs::remove_dir_all(&dir_path);
            }
        }
        // Also check nested excluded dirs
        for entry in WalkDir::new(repo_subdir)
            .into_iter()
            .flatten()
        {
            if entry.file_type().is_dir() {
                let name = entry.file_name().to_string_lossy();
                if excluded_dirs.contains(&name.as_ref()) {
                    let _ = fs::remove_dir_all(entry.path());
                }
            }
        }
    } else {
        fs::create_dir_all(repo_subdir)?;
    }

    let mut count = 0;

    for entry in WalkDir::new(core_path)
        .follow_links(false)
        .into_iter()
        .filter_entry(|e| {
            let name = e.file_name().to_string_lossy();

            // Skip OS junk files
            if name == ".DS_Store" || name == "Thumbs.db" || name == "desktop.ini" {
                return false;
            }

            // Skip other app metadata directories
            if e.file_type().is_dir() {
                if name == ".obsidian" || name == ".logseq" || name == "logseq"
                    || name == ".trash" || name == ".git"
                {
                    return false;
                }
            }

            // Skip .noctodeus/meta.db, logs, cache (but keep config.toml)
            if name == "meta.db" || name == "meta.db-wal" || name == "meta.db-shm" {
                return false;
            }
            if e.file_type().is_dir() {
                let rel = e.path().strip_prefix(core_path).unwrap_or(e.path());
                let rel_str = rel.to_string_lossy();
                if rel_str.contains(".noctodeus/logs") || rel_str.contains(".noctodeus/cache") {
                    return false;
                }
            }
            true
        })
    {
        let entry = entry?;
        let rel_path = entry.path().strip_prefix(core_path).unwrap_or(entry.path());
        let dest = repo_subdir.join(rel_path);

        if entry.file_type().is_dir() {
            if !dest.exists() {
                fs::create_dir_all(&dest)?;
            }
        } else {
            if let Some(parent) = dest.parent() {
                if !parent.exists() {
                    fs::create_dir_all(parent)?;
                }
            }
            // Atomic write: write to temp, then rename
            let tmp = dest.with_extension("sync-tmp");
            fs::copy(entry.path(), &tmp)?;
            fs::rename(&tmp, &dest)?;
            count += 1;
        }
    }

    debug!(count, "copied core to repo");
    Ok(count)
}

/// Copy changed files from repo subdirectory back to the core path.
/// Uses mtime guards to avoid overwriting files edited during sync.
/// Returns (files_copied, conflicts) where conflicts are paths that
/// were modified during sync and need fork-on-conflict treatment.
pub fn copy_repo_to_core(
    repo_subdir: &Path,
    core_path: &Path,
    pre_sync_snapshots: &[FileSnapshot],
) -> Result<(u32, Vec<String>), NoctoError> {
    let mut count = 0;
    let mut conflicts = Vec::new();

    for entry in WalkDir::new(repo_subdir)
        .follow_links(false)
        .into_iter()
        .filter_entry(|e| {
            let name = e.file_name().to_string_lossy();
            name != "meta.db" && name != "meta.db-wal" && name != "meta.db-shm"
        })
    {
        let entry = entry?;
        if entry.file_type().is_dir() {
            continue;
        }

        let rel_path = entry
            .path()
            .strip_prefix(repo_subdir)
            .unwrap_or(entry.path());
        let dest = core_path.join(rel_path);
        let rel_str = rel_path.to_string_lossy().to_string();

        // Mtime guard: check if file was modified during sync
        if dest.exists() {
            if let Some(snapshot) = pre_sync_snapshots.iter().find(|s| s.path == rel_str) {
                let current_mtime = file_mtime(&dest);
                if current_mtime != snapshot.mtime {
                    warn!(path = %rel_str, "file modified during sync, treating as conflict");
                    conflicts.push(rel_str);
                    continue;
                }
            }
        }

        if let Some(parent) = dest.parent() {
            if !parent.exists() {
                fs::create_dir_all(parent)?;
            }
        }

        // Atomic write
        let tmp = dest.with_extension("sync-tmp");
        fs::copy(entry.path(), &tmp)?;
        fs::rename(&tmp, &dest)?;
        count += 1;
    }

    debug!(count, conflicts = conflicts.len(), "copied repo to core");
    Ok((count, conflicts))
}

/// Snapshot all files in a core path for mtime comparison.
pub fn snapshot_core(core_path: &Path) -> Vec<FileSnapshot> {
    let mut snapshots = Vec::new();
    for entry in WalkDir::new(core_path)
        .follow_links(false)
        .into_iter()
        .flatten()
    {
        if entry.file_type().is_file() {
            let rel = entry
                .path()
                .strip_prefix(core_path)
                .unwrap_or(entry.path())
                .to_string_lossy()
                .to_string();
            snapshots.push(FileSnapshot {
                path: rel,
                mtime: file_mtime(entry.path()),
                hash: file_hash(entry.path()),
            });
        }
    }
    snapshots
}

/// Delete a file from the core path by moving to trash.
pub fn delete_from_core(core_path: &Path, rel_path: &str) -> Result<(), NoctoError> {
    let abs = core_path.join(rel_path);
    if abs.exists() {
        trash::delete(&abs).map_err(|e| NoctoError::SyncFailed {
            detail: format!("Failed to trash {}: {e}", rel_path),
        })?;
    }
    Ok(())
}

/// Rename a file in the core path.
pub fn rename_in_core(
    core_path: &Path,
    old_rel: &str,
    new_rel: &str,
) -> Result<(), NoctoError> {
    let old_abs = core_path.join(old_rel);
    let new_abs = core_path.join(new_rel);
    if old_abs.exists() {
        if let Some(parent) = new_abs.parent() {
            if !parent.exists() {
                fs::create_dir_all(parent)?;
            }
        }
        fs::rename(&old_abs, &new_abs)?;
    }
    Ok(())
}

fn file_mtime(path: &Path) -> Option<u64> {
    fs::metadata(path)
        .ok()
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
}

fn file_hash(path: &Path) -> Option<String> {
    let data = fs::read(path).ok()?;
    let mut hasher = Sha256::new();
    hasher.update(&data);
    Some(hex::encode(hasher.finalize()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_copy_core_to_repo() {
        let core = tempfile::tempdir().unwrap();
        let repo = tempfile::tempdir().unwrap();
        let subdir = repo.path().join("my-vault");

        fs::write(core.path().join("note.md"), "hello").unwrap();
        fs::create_dir_all(core.path().join(".noctodeus")).unwrap();
        fs::write(core.path().join(".noctodeus/config.toml"), "config").unwrap();
        fs::write(core.path().join(".noctodeus/meta.db"), "db").unwrap();

        let count = copy_core_to_repo(core.path(), &subdir).unwrap();
        assert!(count >= 2); // note.md + config.toml
        assert!(subdir.join("note.md").exists());
        assert!(subdir.join(".noctodeus/config.toml").exists());
        assert!(!subdir.join(".noctodeus/meta.db").exists()); // excluded
    }

    #[test]
    fn test_copy_repo_to_core_with_mtime_guard() {
        let repo_sub = tempfile::tempdir().unwrap();
        let core = tempfile::tempdir().unwrap();

        // Create file in both locations
        fs::write(core.path().join("note.md"), "original").unwrap();
        fs::write(repo_sub.path().join("note.md"), "from-remote").unwrap();

        // Snapshot BEFORE any changes
        let snapshots = snapshot_core(core.path());

        // Copy should succeed (mtime hasn't changed)
        let (count, conflicts) =
            copy_repo_to_core(repo_sub.path(), core.path(), &snapshots).unwrap();
        assert_eq!(count, 1);
        assert!(conflicts.is_empty());
        assert_eq!(fs::read_to_string(core.path().join("note.md")).unwrap(), "from-remote");
    }
}
