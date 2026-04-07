use std::fs;
use std::path::Path;

use chrono::Utc;
use tracing::{debug, info};

use crate::errors::NoctoError;
use crate::sync::git;

/// Attempt three-way merge on a conflicting file.
/// Returns Ok(()) if resolved (either clean merge or fork).
/// The resolved files are written to both `repo_subdir` and `core_path`.
pub async fn resolve_conflict(
    file_rel_path: &str,
    local_content: &str,
    ancestor_content: &str,
    remote_content: &str,
    repo_subdir: &Path,
    core_path: &Path,
) -> Result<ConflictResolution, NoctoError> {
    let tmp_dir = tempfile::tempdir().map_err(|e| NoctoError::SyncFailed {
        detail: format!("Failed to create temp dir: {e}"),
    })?;

    let local_file = tmp_dir.path().join("local");
    let ancestor_file = tmp_dir.path().join("ancestor");
    let remote_file = tmp_dir.path().join("remote");

    fs::write(&local_file, local_content)?;
    fs::write(&ancestor_file, ancestor_content)?;
    fs::write(&remote_file, remote_content)?;

    match git::merge_file(&local_file, &ancestor_file, &remote_file).await {
        Ok(merged) => {
            debug!(path = file_rel_path, "clean three-way merge");
            // Write merged result to both locations
            write_atomic(&repo_subdir.join(file_rel_path), &merged)?;
            write_atomic(&core_path.join(file_rel_path), &merged)?;
            Ok(ConflictResolution::Merged)
        }
        Err(_) => {
            info!(path = file_rel_path, "merge conflict — forking");
            fork_conflict(file_rel_path, local_content, remote_content, repo_subdir, core_path)
        }
    }
}

/// Fork a conflicted file: keep remote as the canonical file,
/// save local as a .conflict file.
fn fork_conflict(
    file_rel_path: &str,
    local_content: &str,
    remote_content: &str,
    repo_subdir: &Path,
    core_path: &Path,
) -> Result<ConflictResolution, NoctoError> {
    let today = Utc::now().format("%Y-%m-%d").to_string();

    // Build conflict filename: note.md → note.conflict-2026-04-07.md
    let conflict_name = if let Some((stem, ext)) = file_rel_path.rsplit_once('.') {
        format!("{}.conflict-{}.{}", stem, today, ext)
    } else {
        format!("{}.conflict-{}", file_rel_path, today)
    };

    // Remote version stays as the canonical file
    write_atomic(&repo_subdir.join(file_rel_path), remote_content)?;
    write_atomic(&core_path.join(file_rel_path), remote_content)?;

    // Local version saved as conflict file
    write_atomic(&repo_subdir.join(&conflict_name), local_content)?;
    write_atomic(&core_path.join(&conflict_name), local_content)?;

    info!(
        canonical = file_rel_path,
        conflict = conflict_name,
        "conflict forked"
    );

    Ok(ConflictResolution::Forked {
        conflict_file: conflict_name,
    })
}

#[derive(Debug, Clone)]
pub enum ConflictResolution {
    /// Three-way merge succeeded cleanly.
    Merged,
    /// Conflict: remote kept as canonical, local saved as .conflict file.
    Forked { conflict_file: String },
}

/// Write content to a file atomically (write to temp, then rename).
fn write_atomic(path: &Path, content: &str) -> Result<(), NoctoError> {
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)?;
        }
    }
    let tmp = path.with_extension("sync-tmp");
    fs::write(&tmp, content)?;
    fs::rename(&tmp, path)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_clean_merge() {
        let repo = tempfile::tempdir().unwrap();
        let core = tempfile::tempdir().unwrap();

        let ancestor = "line 1\nline 2\nline 3\nline 4\nline 5\n";
        let local = "line 1\nlocal change\nline 3\nline 4\nline 5\n";
        let remote = "line 1\nline 2\nline 3\nline 4\nremote change\n";

        let result = resolve_conflict(
            "note.md", local, ancestor, remote,
            repo.path(), core.path(),
        ).await.unwrap();

        assert!(matches!(result, ConflictResolution::Merged));
        let merged = fs::read_to_string(core.path().join("note.md")).unwrap();
        assert!(merged.contains("local change"));
        assert!(merged.contains("remote change"));
    }

    #[tokio::test]
    async fn test_fork_on_conflict() {
        let repo = tempfile::tempdir().unwrap();
        let core = tempfile::tempdir().unwrap();

        let ancestor = "same line\n";
        let local = "local version of same line\n";
        let remote = "remote version of same line\n";

        let result = resolve_conflict(
            "note.md", local, ancestor, remote,
            repo.path(), core.path(),
        ).await.unwrap();

        match result {
            ConflictResolution::Forked { conflict_file } => {
                assert!(conflict_file.contains(".conflict-"));
                assert!(conflict_file.ends_with(".md"));
                // Remote version is the canonical file
                let canonical = fs::read_to_string(core.path().join("note.md")).unwrap();
                assert_eq!(canonical, remote);
                // Local version is the conflict file
                let conflict = fs::read_to_string(core.path().join(&conflict_file)).unwrap();
                assert_eq!(conflict, local);
            }
            _ => panic!("expected fork"),
        }
    }
}
