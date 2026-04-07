use std::path::Path;

use tokio::process::Command;
use tracing::{debug, warn};

use crate::errors::NoctoError;

/// Timeout for git operations (30 seconds).
const GIT_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(30);

/// Run a git command in the given directory with optional env vars.
/// Returns stdout as a String on success. Times out after 30 seconds.
pub async fn run_git(
    repo_dir: &Path,
    args: &[&str],
    env: &[(&str, &str)],
) -> Result<String, NoctoError> {
    let mut cmd = Command::new("git");
    cmd.args(args)
        .current_dir(repo_dir)
        .env("GIT_TERMINAL_PROMPT", "0"); // never prompt for input

    for (key, val) in env {
        cmd.env(key, val);
    }

    debug!(args = ?args, "running git command");

    let output = tokio::time::timeout(GIT_TIMEOUT, cmd.output())
        .await
        .map_err(|_| NoctoError::SyncFailed {
            detail: format!("git {} timed out after 30s", args.join(" ")),
        })?
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                NoctoError::GitNotFound
            } else {
                NoctoError::SyncFailed {
                    detail: format!("Failed to run git: {e}"),
                }
            }
        })?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        warn!(args = ?args, stderr = %stderr, "git command failed");
        Err(NoctoError::SyncFailed {
            detail: format!("git {} failed: {}", args.join(" "), stderr),
        })
    }
}

/// Check if git is installed.
pub async fn check_git_installed() -> Result<String, NoctoError> {
    let output = Command::new("git")
        .args(["--version"])
        .output()
        .await
        .map_err(|_| NoctoError::GitNotFound)?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        Err(NoctoError::GitNotFound)
    }
}

/// Clone a repo to a local path.
pub async fn clone(
    remote_url: &str,
    local_path: &Path,
    env: &[(&str, &str)],
) -> Result<(), NoctoError> {
    let mut cmd = Command::new("git");
    cmd.args(["clone", remote_url, &local_path.to_string_lossy()])
        .env("GIT_TERMINAL_PROMPT", "0");

    for (key, val) in env {
        cmd.env(key, val);
    }

    let output = cmd.output().await.map_err(|e| NoctoError::SyncFailed {
        detail: format!("Clone failed: {e}"),
    })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(NoctoError::SyncFailed {
            detail: format!("Clone failed: {}", stderr.trim()),
        });
    }

    Ok(())
}

/// Initialize a new repo at the given path with `main` as default branch.
pub async fn init(repo_dir: &Path) -> Result<(), NoctoError> {
    if !repo_dir.exists() {
        std::fs::create_dir_all(repo_dir)?;
    }
    run_git(repo_dir, &["init", "-b", "main"], &[]).await?;
    Ok(())
}

/// Fetch from remote.
pub async fn fetch(repo_dir: &Path, env: &[(&str, &str)]) -> Result<(), NoctoError> {
    run_git(repo_dir, &["fetch", "origin", "main"], env).await?;
    Ok(())
}

/// Get the current HEAD commit hash.
pub async fn head_hash(repo_dir: &Path) -> Result<String, NoctoError> {
    run_git(repo_dir, &["rev-parse", "HEAD"], &[]).await
}

/// Get the remote main branch commit hash (after fetch).
pub async fn remote_hash(repo_dir: &Path) -> Result<String, NoctoError> {
    run_git(repo_dir, &["rev-parse", "origin/main"], &[]).await
}

/// Stage all changes.
pub async fn add_all(repo_dir: &Path) -> Result<(), NoctoError> {
    run_git(repo_dir, &["add", "-A"], &[]).await?;
    Ok(())
}

/// Check if there are staged changes.
pub async fn has_changes(repo_dir: &Path) -> Result<bool, NoctoError> {
    let output = run_git(repo_dir, &["status", "--porcelain"], &[]).await?;
    Ok(!output.is_empty())
}

/// Commit staged changes.
pub async fn commit(repo_dir: &Path, message: &str) -> Result<(), NoctoError> {
    run_git(repo_dir, &["commit", "-m", message], &[]).await?;
    Ok(())
}

/// Push to remote.
pub async fn push(repo_dir: &Path, env: &[(&str, &str)]) -> Result<(), NoctoError> {
    run_git(repo_dir, &["push", "origin", "main"], env).await?;
    Ok(())
}

/// Hard reset to a specific ref.
pub async fn reset_hard(repo_dir: &Path, target: &str) -> Result<(), NoctoError> {
    run_git(repo_dir, &["reset", "--hard", target], &[]).await?;
    Ok(())
}

/// Get diff between two refs as name-status (with rename detection).
/// Returns Vec<(status_char, old_path, new_path_if_rename)>.
pub async fn diff_name_status(
    repo_dir: &Path,
    from: &str,
    to: &str,
) -> Result<Vec<DiffEntry>, NoctoError> {
    let output = run_git(
        repo_dir,
        &["diff", "--name-status", "-M", from, to],
        &[],
    )
    .await?;

    let mut entries = Vec::new();
    for line in output.lines() {
        let parts: Vec<&str> = line.split('\t').collect();
        match parts.as_slice() {
            [status, path] => {
                entries.push(DiffEntry {
                    status: status.chars().next().unwrap_or('M'),
                    path: path.to_string(),
                    new_path: None,
                });
            }
            [status, old_path, new_path] if status.starts_with('R') => {
                entries.push(DiffEntry {
                    status: 'R',
                    path: old_path.to_string(),
                    new_path: Some(new_path.to_string()),
                });
            }
            _ => {}
        }
    }
    Ok(entries)
}

#[derive(Debug, Clone)]
pub struct DiffEntry {
    pub status: char, // 'A' added, 'M' modified, 'D' deleted, 'R' renamed
    pub path: String,
    pub new_path: Option<String>, // only for renames
}

/// Run git merge-file for three-way merge.
/// Returns Ok(merged_content) on clean merge, Err on conflict.
pub async fn merge_file(
    local_path: &Path,
    ancestor_path: &Path,
    remote_path: &Path,
) -> Result<String, NoctoError> {
    // git merge-file writes to the first file in place and returns:
    // 0 = clean merge, >0 = conflicts, <0 = error
    // We work on copies to avoid modifying originals.
    let output_path = local_path.with_extension("merge-result");
    std::fs::copy(local_path, &output_path)?;

    let output = Command::new("git")
        .args([
            "merge-file",
            "--diff3",
            &output_path.to_string_lossy(),
            &ancestor_path.to_string_lossy(),
            &remote_path.to_string_lossy(),
        ])
        .output()
        .await
        .map_err(|e| NoctoError::SyncFailed {
            detail: format!("merge-file failed: {e}"),
        })?;

    let merged = std::fs::read_to_string(&output_path)?;
    let _ = std::fs::remove_file(&output_path);

    if output.status.success() {
        Ok(merged)
    } else {
        Err(NoctoError::SyncConflict {
            detail: "Three-way merge produced conflicts".to_string(),
        })
    }
}

/// Check for dirty/broken git state (rebase in progress, etc.)
pub async fn check_repo_health(repo_dir: &Path) -> Result<RepoHealth, NoctoError> {
    let rebase_merge = repo_dir.join(".git/rebase-merge");
    let rebase_apply = repo_dir.join(".git/rebase-apply");

    if rebase_merge.exists() || rebase_apply.exists() {
        return Ok(RepoHealth::RebaseInProgress);
    }

    let porcelain = run_git(repo_dir, &["status", "--porcelain"], &[]).await?;
    if porcelain.is_empty() {
        Ok(RepoHealth::Clean)
    } else {
        Ok(RepoHealth::Dirty)
    }
}

#[derive(Debug)]
pub enum RepoHealth {
    Clean,
    Dirty,
    RebaseInProgress,
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    async fn init_test_repo() -> TempDir {
        let dir = TempDir::new().unwrap();
        init(dir.path()).await.unwrap();
        // Configure git user for commits
        run_git(dir.path(), &["config", "user.email", "test@test.com"], &[]).await.unwrap();
        run_git(dir.path(), &["config", "user.name", "Test"], &[]).await.unwrap();
        dir
    }

    #[tokio::test]
    async fn test_check_git_installed() {
        let version = check_git_installed().await.unwrap();
        assert!(version.contains("git version"));
    }

    #[tokio::test]
    async fn test_init_and_commit() {
        let dir = init_test_repo().await;
        std::fs::write(dir.path().join("test.md"), "# Hello").unwrap();
        add_all(dir.path()).await.unwrap();
        assert!(has_changes(dir.path()).await.unwrap());
        commit(dir.path(), "initial").await.unwrap();
        assert!(!has_changes(dir.path()).await.unwrap());
    }

    #[tokio::test]
    async fn test_diff_name_status() {
        let dir = init_test_repo().await;
        std::fs::write(dir.path().join("a.md"), "first").unwrap();
        add_all(dir.path()).await.unwrap();
        commit(dir.path(), "add a").await.unwrap();
        let hash1 = head_hash(dir.path()).await.unwrap();

        std::fs::write(dir.path().join("a.md"), "modified").unwrap();
        std::fs::write(dir.path().join("b.md"), "new file").unwrap();
        add_all(dir.path()).await.unwrap();
        commit(dir.path(), "modify and add").await.unwrap();
        let hash2 = head_hash(dir.path()).await.unwrap();

        let entries = diff_name_status(dir.path(), &hash1, &hash2).await.unwrap();
        assert!(entries.iter().any(|e| e.status == 'M' && e.path == "a.md"));
        assert!(entries.iter().any(|e| e.status == 'A' && e.path == "b.md"));
    }

    #[tokio::test]
    async fn test_repo_health_clean() {
        let dir = init_test_repo().await;
        std::fs::write(dir.path().join("test.md"), "hello").unwrap();
        add_all(dir.path()).await.unwrap();
        commit(dir.path(), "init").await.unwrap();
        let health = check_repo_health(dir.path()).await.unwrap();
        assert!(matches!(health, RepoHealth::Clean));
    }
}
