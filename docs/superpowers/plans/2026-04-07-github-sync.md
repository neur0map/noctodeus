# GitHub Sync Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add manual push/pull sync to GitHub with one-repo-multiple-cores, three-way merge with fork-on-conflict, and a single smart Sync button.

**Architecture:** Four phases. Phase 1 builds the git CLI wrapper and sync config layer. Phase 2 builds the copy engine, conflict resolver, and push/pull orchestration. Phase 3 exposes everything as Tauri commands. Phase 4 adds the frontend UI (Settings sync tab, sidebar sync button, command palette integration).

**Tech Stack:** Rust, git CLI (shelled out), Tauri 2, async-trait, tokio, SvelteKit 5, TypeScript

**Spec:** `docs/superpowers/specs/2026-04-07-github-sync-design.md`

---

## File Structure

### New Rust files
- `src-tauri/src/sync/mod.rs` — SyncBackend trait, SyncConfig, SyncError, SyncStatus, concurrency guard (Mutex), public API
- `src-tauri/src/sync/git.rs` — Git CLI wrapper: run_git(), clone, fetch, push, commit, add, status, diff, merge_file, reset
- `src-tauri/src/sync/github.rs` — GitHubSync struct implementing SyncBackend, push/pull/smart flows
- `src-tauri/src/sync/manifest.rs` — sync.toml and sync.json read/write
- `src-tauri/src/sync/copy.rs` — Bidirectional file copy with mtime guards, atomic writes
- `src-tauri/src/sync/conflict.rs` — Three-way merge via git merge-file, fork-on-conflict fallback
- `src-tauri/src/sync/auth.rs` — PAT storage, GIT_ASKPASS helper script generation
- `src-tauri/src/commands/sync.rs` — All sync_* Tauri commands

### New frontend files
- `src/lib/components/common/settings/SettingsSync.svelte` — Sync settings tab panel
- `src/lib/components/layout/SyncButton.svelte` — Sidebar footer sync button with 4 states
- `src/lib/stores/sync.svelte.ts` — Sync state store (status, last sync, synced cores)
- `src/lib/bridge/sync.ts` — Typed Tauri invoke wrappers for sync commands

### Modified files
- `src-tauri/Cargo.toml` — Add `async-trait` dependency
- `src-tauri/src/lib.rs` — Register `sync` module and sync commands
- `src-tauri/src/errors.rs` — Add sync error variants
- `src-tauri/src/commands/mod.rs` — Add `pub mod sync`
- `src/lib/components/common/SettingsModal.svelte` — Add 'sync' section to nav + import SettingsSync
- `src/lib/components/layout/SidebarContent.svelte` — Add SyncButton to footer
- `src/routes/+page.svelte` — Wire command palette sync commands

---

## Chunk 1: Foundation — Git CLI Wrapper, Config, Auth

### Task 1: Add async-trait dependency

**Files:**
- Modify: `src-tauri/Cargo.toml`

- [ ] **Step 1: Add async-trait to dependencies**

```toml
async-trait = "0.1"
```

- [ ] **Step 2: Verify compiles**

Run: `cd src-tauri && cargo check`

- [ ] **Step 3: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "feat(sync): add async-trait dependency"
```

---

### Task 2: Add sync error variants

**Files:**
- Modify: `src-tauri/src/errors.rs`

- [ ] **Step 1: Add sync error variants to NoctoError**

After the `Unexpected` variant, add:

```rust
    // Sync
    #[error("Sync failed: {detail}")]
    SyncFailed { detail: String },
    #[error("Sync in progress")]
    SyncBusy,
    #[error("Sync not configured")]
    SyncNotConfigured,
    #[error("Git not found: install git from git-scm.com")]
    GitNotFound,
    #[error("Sync conflict: {detail}")]
    SyncConflict { detail: String },
```

- [ ] **Step 2: Add error codes in the `code()` match**

```rust
    NoctoError::SyncFailed { .. } => "sync_failed",
    NoctoError::SyncBusy => "sync_busy",
    NoctoError::SyncNotConfigured => "sync_not_configured",
    NoctoError::GitNotFound => "git_not_found",
    NoctoError::SyncConflict { .. } => "sync_conflict",
```

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/errors.rs
git commit -m "feat(sync): add sync error variants"
```

---

### Task 3: Create sync module skeleton with SyncBackend trait

**Files:**
- Create: `src-tauri/src/sync/mod.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Create `sync/mod.rs` with trait, types, and concurrency guard**

```rust
pub mod auth;
pub mod conflict;
pub mod copy;
pub mod git;
pub mod github;
pub mod manifest;

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;

use crate::errors::NoctoError;

/// Global sync lock — held for the duration of any sync operation.
pub static SYNC_LOCK: Mutex<()> = Mutex::const_new(());

/// Acquire the sync lock or return SyncBusy if already held.
pub async fn acquire_sync_lock() -> Result<tokio::sync::MutexGuard<'static, ()>, NoctoError> {
    SYNC_LOCK.try_lock().map_err(|_| NoctoError::SyncBusy)
}

/// Check if a sync operation is currently in progress.
pub fn is_syncing() -> bool {
    SYNC_LOCK.try_lock().is_err()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncConfig {
    pub remote_url: String,
    pub repo_local_path: String,
    pub synced_core_ids: Vec<String>,
    pub last_push_at: Option<String>,
    pub last_pull_at: Option<String>,
    /// PAT stored here for v1. Future: move to OS keychain via tauri-plugin-stronghold.
    #[serde(default)]
    pub token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncCore {
    pub id: String,
    pub name: String,
    pub local_path: String,  // user's core path on disk
    pub repo_subdir: String, // subdirectory name within the repo
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncStatus {
    pub configured: bool,
    pub syncing: bool,
    pub last_push_at: Option<String>,
    pub last_pull_at: Option<String>,
    pub has_local_changes: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncResult {
    pub files_pushed: u32,
    pub files_pulled: u32,
    pub conflicts: Vec<String>,
}

#[async_trait]
pub trait SyncBackend: Send + Sync {
    async fn init(&self, config: &SyncConfig) -> Result<(), NoctoError>;
    async fn push(&self, cores: &[SyncCore]) -> Result<SyncResult, NoctoError>;
    async fn pull(&self, cores: &[SyncCore]) -> Result<SyncResult, NoctoError>;
    async fn status(&self) -> Result<SyncStatus, NoctoError>;
}
```

- [ ] **Step 2: Add `pub mod sync;` to `lib.rs`**

In `src-tauri/src/lib.rs`, after `pub mod watcher;` add:

```rust
pub mod sync;
```

- [ ] **Step 3: Create empty submodule files so it compiles**

Create these files with just `// TODO` as placeholder content:
- `src-tauri/src/sync/git.rs`
- `src-tauri/src/sync/github.rs`
- `src-tauri/src/sync/manifest.rs`
- `src-tauri/src/sync/copy.rs`
- `src-tauri/src/sync/conflict.rs`
- `src-tauri/src/sync/auth.rs`

- [ ] **Step 4: Verify compiles**

Run: `cd src-tauri && cargo check`

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/sync/ src-tauri/src/lib.rs
git commit -m "feat(sync): add sync module skeleton with SyncBackend trait"
```

---

### Task 4: Implement git CLI wrapper

**Files:**
- Create: `src-tauri/src/sync/git.rs` (replace placeholder)

This is the low-level git CLI interface. Every function shells out to `git` using `tokio::process::Command`.

- [ ] **Step 1: Write the git CLI wrapper**

```rust
use std::path::Path;
use std::process::Output;

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
```

- [ ] **Step 2: Write tests for the git wrapper**

Add tests at the bottom of `git.rs`:

```rust
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
```

- [ ] **Step 3: Run tests**

Run: `cd src-tauri && cargo test sync::git`
Expected: All 4 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/sync/git.rs
git commit -m "feat(sync): implement git CLI wrapper with tests"
```

---

### Task 5: Implement sync manifest (sync.toml + sync.json)

**Files:**
- Create: `src-tauri/src/sync/manifest.rs` (replace placeholder)

- [ ] **Step 1: Write the manifest module**

```rust
use std::fs;
use std::path::{Path, PathBuf};

use chrono::Utc;
use serde::{Deserialize, Serialize};
use tracing::debug;

use crate::errors::NoctoError;
use crate::sync::SyncConfig;

// ── sync.toml (lives inside the git repo) ─────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncManifest {
    pub sync: SyncMeta,
    #[serde(default)]
    pub cores: Vec<SyncManifestCore>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncMeta {
    pub version: u32,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncManifestCore {
    pub id: String,
    pub name: String,
    pub path: String, // subdirectory within repo
    pub added_at: String,
}

/// Read sync.toml from the repo's .noctodeus-sync/ directory.
pub fn read_sync_toml(repo_dir: &Path) -> Result<SyncManifest, NoctoError> {
    let path = repo_dir.join(".noctodeus-sync").join("sync.toml");
    if !path.exists() {
        return Err(NoctoError::SyncNotConfigured);
    }
    let contents = fs::read_to_string(&path)?;
    let manifest: SyncManifest = toml::from_str(&contents)?;
    Ok(manifest)
}

/// Write sync.toml to the repo's .noctodeus-sync/ directory.
pub fn write_sync_toml(repo_dir: &Path, manifest: &SyncManifest) -> Result<(), NoctoError> {
    let dir = repo_dir.join(".noctodeus-sync");
    if !dir.exists() {
        fs::create_dir_all(&dir)?;
    }
    let toml_str = toml::to_string_pretty(manifest)?;
    fs::write(dir.join("sync.toml"), toml_str)?;
    Ok(())
}

/// Create a fresh sync.toml with no cores.
pub fn create_sync_toml(repo_dir: &Path) -> Result<SyncManifest, NoctoError> {
    let manifest = SyncManifest {
        sync: SyncMeta {
            version: 1,
            created_at: Utc::now().to_rfc3339(),
        },
        cores: Vec::new(),
    };
    write_sync_toml(repo_dir, &manifest)?;
    Ok(manifest)
}

/// Write the .gitignore for noctodeus artifacts.
pub fn write_gitignore(repo_dir: &Path) -> Result<(), NoctoError> {
    let dir = repo_dir.join(".noctodeus-sync");
    if !dir.exists() {
        fs::create_dir_all(&dir)?;
    }
    let content = "# Noctodeus — machine-specific artifacts\n\
                   **/.noctodeus/meta.db\n\
                   **/.noctodeus/meta.db-wal\n\
                   **/.noctodeus/meta.db-shm\n\
                   **/.noctodeus/logs/\n\
                   **/.noctodeus/cache/\n";
    // Write to repo root, not inside .noctodeus-sync
    fs::write(repo_dir.join(".gitignore"), content)?;
    Ok(())
}

/// Add a core to the sync manifest.
pub fn add_core_to_manifest(
    repo_dir: &Path,
    id: &str,
    name: &str,
    subdir: &str,
) -> Result<SyncManifest, NoctoError> {
    let mut manifest = read_sync_toml(repo_dir)?;
    if manifest.cores.iter().any(|c| c.id == id) {
        debug!(id, "core already in sync manifest");
        return Ok(manifest);
    }
    manifest.cores.push(SyncManifestCore {
        id: id.to_string(),
        name: name.to_string(),
        path: subdir.to_string(),
        added_at: Utc::now().to_rfc3339(),
    });
    write_sync_toml(repo_dir, &manifest)?;
    Ok(manifest)
}

/// Remove a core from the sync manifest.
pub fn remove_core_from_manifest(
    repo_dir: &Path,
    id: &str,
) -> Result<SyncManifest, NoctoError> {
    let mut manifest = read_sync_toml(repo_dir)?;
    manifest.cores.retain(|c| c.id != id);
    write_sync_toml(repo_dir, &manifest)?;
    Ok(manifest)
}

// ── sync.json (lives in app data directory) ───────────────────────────

/// Get the path to sync.json in the app data directory.
pub fn sync_json_path() -> Result<PathBuf, NoctoError> {
    let base = dirs::data_dir().ok_or_else(|| NoctoError::Unexpected {
        detail: "Could not determine app data directory".to_string(),
    })?;
    let app_dir = base.join("com.noctodeus.app");
    if !app_dir.exists() {
        fs::create_dir_all(&app_dir)?;
    }
    Ok(app_dir.join("sync.json"))
}

/// Read the app-level sync config.
pub fn read_sync_config() -> Result<Option<SyncConfig>, NoctoError> {
    let path = sync_json_path()?;
    if !path.exists() {
        return Ok(None);
    }
    let contents = fs::read_to_string(&path)?;
    let config: SyncConfig = serde_json::from_str(&contents)?;
    Ok(Some(config))
}

/// Write the app-level sync config.
pub fn write_sync_config(config: &SyncConfig) -> Result<(), NoctoError> {
    let path = sync_json_path()?;
    let json = serde_json::to_string_pretty(config)?;
    fs::write(&path, json)?;
    Ok(())
}

/// Delete the sync config (used by sync_disconnect).
pub fn delete_sync_config() -> Result<(), NoctoError> {
    let path = sync_json_path()?;
    if path.exists() {
        fs::remove_file(&path)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sync_toml_roundtrip() {
        let dir = tempfile::tempdir().unwrap();
        let manifest = create_sync_toml(dir.path()).unwrap();
        assert_eq!(manifest.sync.version, 1);
        assert!(manifest.cores.is_empty());

        let manifest = add_core_to_manifest(dir.path(), "abc-123", "my-vault", "my-vault").unwrap();
        assert_eq!(manifest.cores.len(), 1);
        assert_eq!(manifest.cores[0].name, "my-vault");

        let manifest = read_sync_toml(dir.path()).unwrap();
        assert_eq!(manifest.cores.len(), 1);

        let manifest = remove_core_from_manifest(dir.path(), "abc-123").unwrap();
        assert!(manifest.cores.is_empty());
    }

    #[test]
    fn test_gitignore_creation() {
        let dir = tempfile::tempdir().unwrap();
        write_gitignore(dir.path()).unwrap();
        let content = fs::read_to_string(dir.path().join(".gitignore")).unwrap();
        assert!(content.contains("meta.db"));
        assert!(content.contains("logs/"));
        assert!(content.contains("cache/"));
    }
}
```

- [ ] **Step 2: Run tests**

Run: `cd src-tauri && cargo test sync::manifest`
Expected: 2 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/sync/manifest.rs
git commit -m "feat(sync): implement sync.toml and sync.json manifest layer"
```

---

### Task 6: Implement auth module (PAT + GIT_ASKPASS)

**Files:**
- Create: `src-tauri/src/sync/auth.rs` (replace placeholder)

- [ ] **Step 1: Write the auth module**

```rust
use std::fs;
use std::path::PathBuf;

use crate::errors::NoctoError;

/// Build the GIT_ASKPASS environment variable pairs for git commands.
/// This avoids embedding the token in .git/config or remote URLs.
///
/// The askpass script echoes the token when git asks for a password.
/// Git calls it with a prompt argument; we ignore the prompt and always
/// return the token.
pub fn git_auth_env(token: &str) -> Result<Vec<(String, String)>, NoctoError> {
    let askpass_path = askpass_script_path()?;

    // Write the askpass script. On Unix it needs to be executable.
    #[cfg(unix)]
    {
        let script = format!("#!/bin/sh\necho '{}'", token.replace('\'', "'\\''"));
        fs::write(&askpass_path, &script)?;
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&askpass_path, fs::Permissions::from_mode(0o700))?;
    }

    #[cfg(windows)]
    {
        let script = format!("@echo off\necho {}", token);
        let bat_path = askpass_path.with_extension("bat");
        fs::write(&bat_path, &script)?;
        return Ok(vec![
            ("GIT_ASKPASS".to_string(), bat_path.to_string_lossy().to_string()),
            ("GIT_TERMINAL_PROMPT".to_string(), "0".to_string()),
        ]);
    }

    #[cfg(unix)]
    Ok(vec![
        ("GIT_ASKPASS".to_string(), askpass_path.to_string_lossy().to_string()),
        ("GIT_TERMINAL_PROMPT".to_string(), "0".to_string()),
    ])
}

/// Build the remote URL with the token for cloning.
/// We use this only for the initial clone (before the askpass script exists).
/// After clone, all operations use GIT_ASKPASS.
pub fn authenticated_url(remote_url: &str, token: &str) -> String {
    // https://github.com/user/repo.git → https://TOKEN@github.com/user/repo.git
    if let Some(rest) = remote_url.strip_prefix("https://") {
        format!("https://{}@{}", token, rest)
    } else {
        remote_url.to_string()
    }
}

/// After clone, reset the remote URL to the plain HTTPS URL (no token).
pub fn sanitize_remote_url(remote_url: &str) -> String {
    // Remove any embedded credentials
    if let Some(at_pos) = remote_url.find('@') {
        if remote_url.starts_with("https://") {
            return format!("https://{}", &remote_url[at_pos + 1..]);
        }
    }
    remote_url.to_string()
}

fn askpass_script_path() -> Result<PathBuf, NoctoError> {
    let base = dirs::data_dir().ok_or_else(|| NoctoError::Unexpected {
        detail: "Could not determine app data directory".to_string(),
    })?;
    let dir = base.join("com.noctodeus.app").join("sync");
    if !dir.exists() {
        fs::create_dir_all(&dir)?;
    }
    Ok(dir.join("git-askpass"))
}

/// Clean up the askpass script (used by sync_disconnect).
pub fn cleanup_auth() -> Result<(), NoctoError> {
    let path = askpass_script_path()?;
    if path.exists() {
        fs::remove_file(&path)?;
    }
    // Also try .bat on Windows
    let bat = path.with_extension("bat");
    if bat.exists() {
        fs::remove_file(&bat)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_authenticated_url() {
        let url = authenticated_url("https://github.com/user/repo.git", "ghp_abc123");
        assert_eq!(url, "https://ghp_abc123@github.com/user/repo.git");
    }

    #[test]
    fn test_sanitize_remote_url() {
        let url = sanitize_remote_url("https://ghp_abc123@github.com/user/repo.git");
        assert_eq!(url, "https://github.com/user/repo.git");
    }

    #[test]
    fn test_sanitize_clean_url() {
        let url = sanitize_remote_url("https://github.com/user/repo.git");
        assert_eq!(url, "https://github.com/user/repo.git");
    }
}
```

- [ ] **Step 2: Run tests**

Run: `cd src-tauri && cargo test sync::auth`
Expected: 3 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/sync/auth.rs
git commit -m "feat(sync): implement PAT auth with GIT_ASKPASS for secure token usage"
```

---

### Task 7: Implement copy engine with mtime guards

**Files:**
- Create: `src-tauri/src/sync/copy.rs` (replace placeholder)

- [ ] **Step 1: Write the copy engine**

```rust
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
    // Clean repo subdir: remove files that don't exist in core anymore
    if repo_subdir.exists() {
        for entry in WalkDir::new(repo_subdir).into_iter().flatten() {
            if !entry.file_type().is_file() { continue; }
            let rel = entry.path().strip_prefix(repo_subdir).unwrap_or(entry.path());
            let core_file = core_path.join(rel);
            if !core_file.exists() {
                let _ = fs::remove_file(entry.path());
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
            // Skip .noctodeus/meta.db, logs, cache (but keep config.toml)
            let name = e.file_name().to_string_lossy();
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
```

- [ ] **Step 2: Run tests**

Run: `cd src-tauri && cargo test sync::copy`
Expected: 2 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/sync/copy.rs
git commit -m "feat(sync): implement bidirectional file copy with mtime guards"
```

---

### Task 8: Implement conflict resolver

**Files:**
- Create: `src-tauri/src/sync/conflict.rs` (replace placeholder)

- [ ] **Step 1: Write the conflict resolver**

```rust
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

        let ancestor = "line 1\nline 2\nline 3\n";
        let local = "line 1\nlocal change\nline 3\n";
        let remote = "line 1\nline 2\nremote change\n";

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
```

- [ ] **Step 2: Run tests**

Run: `cd src-tauri && cargo test sync::conflict`
Expected: 2 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/sync/conflict.rs
git commit -m "feat(sync): implement three-way merge with fork-on-conflict fallback"
```

---

## Chunk 2: GitHubSync Backend — Push, Pull, Smart Sync

### Task 9: Implement GitHubSync push and pull

**Files:**
- Create: `src-tauri/src/sync/github.rs` (replace placeholder)

This is the main orchestrator. It implements the `SyncBackend` trait, coordinating git.rs, copy.rs, conflict.rs, and manifest.rs.

- [ ] **Step 1: Write the GitHubSync implementation**

```rust
use std::path::{Path, PathBuf};

use async_trait::async_trait;
use chrono::Utc;
use tracing::{debug, info, warn};

use crate::errors::NoctoError;
use crate::sync::auth;
use crate::sync::conflict::{self, ConflictResolution};
use crate::sync::copy;
use crate::sync::git;
use crate::sync::manifest;
use crate::sync::{SyncBackend, SyncConfig, SyncCore, SyncResult, SyncStatus};

pub struct GitHubSync {
    token: String,
}

impl GitHubSync {
    pub fn new(token: String) -> Self {
        Self { token }
    }

    fn auth_env(&self) -> Result<Vec<(String, String)>, NoctoError> {
        auth::git_auth_env(&self.token)
    }

    fn env_refs(env: &[(String, String)]) -> Vec<(&str, &str)> {
        env.iter().map(|(k, v)| (k.as_str(), v.as_str())).collect()
    }
}

#[async_trait]
impl SyncBackend for GitHubSync {
    async fn init(&self, config: &SyncConfig) -> Result<(), NoctoError> {
        let repo_path = PathBuf::from(&config.repo_local_path);

        if repo_path.join(".git").exists() {
            debug!("repo already cloned");
            return Ok(());
        }

        // Clone using authenticated URL for initial clone
        let auth_url = auth::authenticated_url(&config.remote_url, &self.token);
        git::clone(&auth_url, &repo_path, &[]).await?;

        // Sanitize remote URL to remove embedded token
        let clean_url = auth::sanitize_remote_url(&config.remote_url);
        git::run_git(&repo_path, &["remote", "set-url", "origin", &clean_url], &[]).await?;

        // Create sync manifest if this is a fresh repo
        if !repo_path.join(".noctodeus-sync").join("sync.toml").exists() {
            manifest::create_sync_toml(&repo_path)?;
            manifest::write_gitignore(&repo_path)?;
            git::add_all(&repo_path).await?;
            if git::has_changes(&repo_path).await? {
                git::commit(&repo_path, "init: noctodeus sync").await?;
                let env = self.auth_env()?;
                git::push(&repo_path, &Self::env_refs(&env)).await?;
            }
        }

        Ok(())
    }

    async fn push(&self, cores: &[SyncCore]) -> Result<SyncResult, NoctoError> {
        let config = manifest::read_sync_config()?
            .ok_or(NoctoError::SyncNotConfigured)?;
        let repo_path = PathBuf::from(&config.repo_local_path);

        // Recover from dirty state if needed
        recover_dirty_state(&repo_path).await?;

        // Copy each core's files into the repo
        let mut total_files = 0u32;
        for core in cores {
            let subdir = repo_path.join(&core.repo_subdir);
            let count = tokio::task::spawn_blocking({
                let core_path = PathBuf::from(&core.local_path);
                let subdir = subdir.clone();
                move || copy::copy_core_to_repo(&core_path, &subdir)
            })
            .await
            .map_err(|e| NoctoError::SyncFailed { detail: e.to_string() })??;
            total_files += count;
        }

        // Stage, commit, push
        git::add_all(&repo_path).await?;

        if !git::has_changes(&repo_path).await? {
            debug!("no changes to push");
            return Ok(SyncResult { files_pushed: 0, files_pulled: 0, conflicts: vec![] });
        }

        let core_names: Vec<&str> = cores.iter().map(|c| c.name.as_str()).collect();
        let msg = format!("sync: {} @ {}", core_names.join(", "), Utc::now().to_rfc3339());
        git::commit(&repo_path, &msg).await?;

        let env = self.auth_env()?;
        git::push(&repo_path, &Self::env_refs(&env)).await?;

        // Update timestamps
        let mut sync_config = config;
        sync_config.last_push_at = Some(Utc::now().to_rfc3339());
        manifest::write_sync_config(&sync_config)?;

        info!(files = total_files, "push complete");
        Ok(SyncResult { files_pushed: total_files, files_pulled: 0, conflicts: vec![] })
    }

    async fn pull(&self, cores: &[SyncCore]) -> Result<SyncResult, NoctoError> {
        let config = manifest::read_sync_config()?
            .ok_or(NoctoError::SyncNotConfigured)?;
        let repo_path = PathBuf::from(&config.repo_local_path);

        // Recover from dirty state if needed
        recover_dirty_state(&repo_path).await?;

        let env = self.auth_env()?;

        // Fetch remote
        git::fetch(&repo_path, &Self::env_refs(&env)).await?;

        // Check if there's anything to pull
        let local_hash = git::head_hash(&repo_path).await?;
        let remote_hash = git::remote_hash(&repo_path).await?;

        if local_hash == remote_hash {
            debug!("already up to date");
            return Ok(SyncResult { files_pushed: 0, files_pulled: 0, conflicts: vec![] });
        }

        // Get diff between local and remote
        let diff = git::diff_name_status(&repo_path, &local_hash, &remote_hash).await?;

        // Snapshot core files before sync for mtime guards
        let mut core_snapshots: Vec<(SyncCore, Vec<copy::FileSnapshot>)> = Vec::new();
        for core in cores {
            let snapshots = {
                let core_path = PathBuf::from(&core.local_path);
                tokio::task::spawn_blocking(move || copy::snapshot_core(&core_path))
                    .await
                    .map_err(|e| NoctoError::SyncFailed { detail: e.to_string() })?
            };
            core_snapshots.push((core.clone(), snapshots));
        }

        // Reset to remote (we'll re-apply local changes)
        git::reset_hard(&repo_path, "origin/main").await?;

        // Handle deletions and renames in core paths
        let mut total_pulled = 0u32;
        let mut all_conflicts = Vec::new();

        for entry in &diff {
            // Find which core this file belongs to
            let Some((core, _)) = core_snapshots.iter().find(|(c, _)| {
                entry.path.starts_with(&format!("{}/", c.repo_subdir))
            }) else {
                continue;
            };
            let core_path = Path::new(&core.local_path);

            // Strip the repo subdir prefix to get the relative path within the core
            let core_rel = entry.path.strip_prefix(&format!("{}/", core.repo_subdir))
                .unwrap_or(&entry.path);

            match entry.status {
                'D' => {
                    let cp = core_path.to_path_buf();
                    let rel = core_rel.to_string();
                    tokio::task::spawn_blocking(move || copy::delete_from_core(&cp, &rel))
                        .await
                        .map_err(|e| NoctoError::SyncFailed { detail: e.to_string() })??;
                    total_pulled += 1;
                }
                'R' => {
                    if let Some(new_path) = &entry.new_path {
                        let new_core_rel = new_path
                            .strip_prefix(&format!("{}/", core.repo_subdir))
                            .unwrap_or(new_path);
                        let cp = core_path.to_path_buf();
                        let old = core_rel.to_string();
                        let new = new_core_rel.to_string();
                        tokio::task::spawn_blocking(move || copy::rename_in_core(&cp, &old, &new))
                            .await
                            .map_err(|e| NoctoError::SyncFailed { detail: e.to_string() })??;
                        total_pulled += 1;
                    }
                }
                'M' | 'A' => {
                    // Check if file was also locally modified (different from last sync snapshot)
                    let snapshot_hash = core_snapshots.iter()
                        .find(|(c, _)| c.id == core.id)
                        .and_then(|(_, snaps)| snaps.iter().find(|s| s.path == core_rel))
                        .and_then(|s| s.hash.as_deref());

                    let local_file = core_path.join(core_rel);
                    let local_hash = if local_file.exists() {
                        Some(crate::indexer::scanner::hash_bytes(
                            &std::fs::read(&local_file).unwrap_or_default(),
                        ))
                    } else {
                        None
                    };

                    // Get the repo file hash from BEFORE reset (the snapshot = last sync state)
                    let repo_file = repo_path.join(&entry.path);
                    let remote_content = std::fs::read_to_string(&repo_file).unwrap_or_default();

                    let both_changed = snapshot_hash.is_some()
                        && local_hash.as_deref() != snapshot_hash;

                    if both_changed {
                        // Three-way merge: ancestor=snapshot, ours=local, theirs=remote
                        let local_content = std::fs::read_to_string(&local_file).unwrap_or_default();
                        // Use empty string as ancestor if no snapshot (new file on both sides)
                        let ancestor = ""; // snapshot content not stored — use empty for v1
                        let cr = core_rel.to_string();
                        let sub = repo_path.join(&core.repo_subdir);
                        let cp = core_path.to_path_buf();
                        match conflict::resolve_conflict(
                            &cr, &local_content, ancestor, &remote_content, &sub, &cp,
                        ).await {
                            Ok(ConflictResolution::Merged) => {
                                total_pulled += 1;
                            }
                            Ok(ConflictResolution::Forked { conflict_file }) => {
                                all_conflicts.push(conflict_file);
                                total_pulled += 1;
                            }
                            Err(e) => {
                                warn!(path = %cr, error = %e, "conflict resolution failed, keeping remote");
                            }
                        }
                    }
                    // Non-conflicting changes handled by copy_repo_to_core below
                }
                _ => {}
            }
        }

        // Copy updated files from repo to core paths (handles non-conflicting A/M changes)
        for (core, snapshots) in &core_snapshots {
            let subdir = repo_path.join(&core.repo_subdir);
            let core_path = PathBuf::from(&core.local_path);
            let snaps = snapshots.clone();

            let (count, conflicts) = tokio::task::spawn_blocking(move || {
                copy::copy_repo_to_core(&subdir, &core_path, &snaps)
            })
            .await
            .map_err(|e| NoctoError::SyncFailed { detail: e.to_string() })??;

            total_pulled += count;

            // Handle mtime conflicts (files edited during sync)
            for conflict_path in conflicts {
                all_conflicts.push(conflict_path);
            }
        }

        // Update timestamps
        let mut sync_config = config;
        sync_config.last_pull_at = Some(Utc::now().to_rfc3339());
        manifest::write_sync_config(&sync_config)?;

        info!(pulled = total_pulled, conflicts = all_conflicts.len(), "pull complete");
        Ok(SyncResult {
            files_pushed: 0,
            files_pulled: total_pulled,
            conflicts: all_conflicts,
        })
    }

    async fn status(&self) -> Result<SyncStatus, NoctoError> {
        let config = match manifest::read_sync_config()? {
            Some(c) => c,
            None => return Ok(SyncStatus {
                configured: false,
                syncing: false,
                last_push_at: None,
                last_pull_at: None,
                has_local_changes: false,
                error: None,
            }),
        };

        let repo_path = PathBuf::from(&config.repo_local_path);
        let has_changes = if repo_path.join(".git").exists() {
            git::has_changes(&repo_path).await.unwrap_or(false)
        } else {
            false
        };

        Ok(SyncStatus {
            configured: true,
            syncing: crate::sync::is_syncing(),
            last_push_at: config.last_push_at,
            last_pull_at: config.last_pull_at,
            has_local_changes: has_changes,
            error: None,
        })
    }
}

/// Smart sync: pull then push, with automatic error recovery and retries.
pub async fn smart_sync(backend: &GitHubSync, cores: &[SyncCore]) -> Result<SyncResult, NoctoError> {
    // Pull first
    let pull_result = backend.pull(cores).await?;

    // Then push
    let push_result = match backend.push(cores).await {
        Ok(r) => r,
        Err(NoctoError::SyncFailed { detail }) if detail.contains("rejected") => {
            // Remote changed during our push — pull again and retry (max 3)
            for attempt in 1..=3 {
                debug!(attempt, "push rejected, retrying after pull");
                backend.pull(cores).await?;
                match backend.push(cores).await {
                    Ok(r) => return Ok(SyncResult {
                        files_pushed: r.files_pushed,
                        files_pulled: pull_result.files_pulled + r.files_pulled,
                        conflicts: [pull_result.conflicts.clone(), r.conflicts].concat(),
                    }),
                    Err(e) if attempt < 3 => {
                        warn!(attempt, error = %e, "push retry failed");
                        continue;
                    }
                    Err(e) => return Err(e),
                }
            }
            unreachable!()
        }
        Err(e) => return Err(e),
    };

    Ok(SyncResult {
        files_pushed: push_result.files_pushed,
        files_pulled: pull_result.files_pulled,
        conflicts: [pull_result.conflicts, push_result.conflicts].concat(),
    })
}

/// Recover from dirty or broken git state.
async fn recover_dirty_state(repo_path: &Path) -> Result<(), NoctoError> {
    let health = git::check_repo_health(repo_path).await?;
    match health {
        git::RepoHealth::Clean => Ok(()),
        git::RepoHealth::RebaseInProgress => {
            warn!("aborting stale rebase");
            git::run_git(repo_path, &["rebase", "--abort"], &[]).await?;
            Ok(())
        }
        git::RepoHealth::Dirty => {
            warn!("dirty state detected, committing leftover changes");
            git::add_all(repo_path).await?;
            if git::has_changes(repo_path).await? {
                git::commit(repo_path, "sync: recover from interrupted sync").await?;
            }
            Ok(())
        }
    }
}
```

- [ ] **Step 2: Verify compiles**

Run: `cd src-tauri && cargo check`

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/sync/github.rs
git commit -m "feat(sync): implement GitHubSync backend with push, pull, and smart sync"
```

---

## Chunk 3: Tauri Commands

### Task 10: Create sync Tauri commands

**Files:**
- Create: `src-tauri/src/commands/sync.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Write the sync commands**

```rust
use std::path::PathBuf;

use tauri::State;

use crate::core::state::AppState;
use crate::errors::{CmdResult, NoctoError};
use crate::sync::github::{self, GitHubSync};
use crate::sync::manifest;
use crate::sync::{acquire_sync_lock, SyncConfig, SyncCore, SyncResult, SyncStatus};

// ── Helpers ───────────────────────────────────────────────────────────

/// Build the list of SyncCore from config + cores.json registry.
fn build_sync_cores(config: &SyncConfig) -> Result<Vec<SyncCore>, NoctoError> {
    let registry = crate::commands::core::read_cores_registry_pub()?;
    let repo_path = PathBuf::from(&config.repo_local_path);
    let manifest = manifest::read_sync_toml(&repo_path)?;

    let mut cores = Vec::new();
    for core_id in &config.synced_core_ids {
        // Find in registry for local path
        let Some(reg_entry) = registry.iter().find(|e| &e.id == core_id) else {
            continue;
        };
        // Find in manifest for repo subdir
        let Some(manifest_entry) = manifest.cores.iter().find(|c| &c.id == core_id) else {
            continue;
        };
        cores.push(SyncCore {
            id: core_id.clone(),
            name: manifest_entry.name.clone(),
            local_path: reg_entry.path.clone(),
            repo_subdir: manifest_entry.path.clone(),
        });
    }

    Ok(cores)
}

// ── Commands ──────────────────────────────────────────────────────────

/// Configure sync: validate git, clone repo, create sync.toml if needed.
#[tauri::command]
pub async fn sync_setup(
    remote_url: String,
    token: String,
) -> CmdResult<()> {
    use crate::sync::git;

    // Preflight: check git is installed
    git::check_git_installed().await?;

    // Determine local clone path
    let repo_name = remote_url
        .rsplit('/')
        .next()
        .unwrap_or("noctodeus-vault")
        .trim_end_matches(".git");

    let base = dirs::data_dir().ok_or_else(|| NoctoError::Unexpected {
        detail: "Could not determine app data directory".to_string(),
    })?;
    let sync_dir = base.join("com.noctodeus.app").join("sync");
    std::fs::create_dir_all(&sync_dir)?;
    let repo_local_path = sync_dir.join(repo_name);

    let config = SyncConfig {
        remote_url: remote_url.clone(),
        repo_local_path: repo_local_path.to_string_lossy().to_string(),
        synced_core_ids: Vec::new(),
        last_push_at: None,
        last_pull_at: None,
        token: Some(token.clone()), // stored in sync.json for v1; future: OS keychain
    };

    // Save config first so init can read it
    manifest::write_sync_config(&config)?;

    // Clone and initialize
    let backend = GitHubSync::new(token);
    backend.init(&config).await?;

    Ok(())
}

/// Get current sync status.
#[tauri::command]
pub async fn sync_status() -> CmdResult<SyncStatus> {
    let config = manifest::read_sync_config()?;
    if config.is_none() {
        return Ok(SyncStatus {
            configured: false,
            syncing: false,
            last_push_at: None,
            last_pull_at: None,
            has_local_changes: false,
            error: None,
        });
    }

    // TODO: read token from keychain; for now use empty
    let backend = GitHubSync::new(String::new());
    backend.status().await
}

/// Helper: get token from sync config.
fn get_token(config: &SyncConfig) -> Result<String, NoctoError> {
    config.token.clone().ok_or(NoctoError::SyncFailed {
        detail: "No auth token configured. Re-enter your GitHub token in Settings → Sync.".to_string(),
    })
}

/// Smart sync: pull then push with auto-recovery.
#[tauri::command]
pub async fn sync_smart() -> CmdResult<SyncResult> {
    let _lock = acquire_sync_lock().await?;

    let config = manifest::read_sync_config()?
        .ok_or(NoctoError::SyncNotConfigured)?;
    let token = get_token(&config)?;

    let cores = build_sync_cores(&config)?;
    if cores.is_empty() {
        return Ok(SyncResult { files_pushed: 0, files_pulled: 0, conflicts: vec![] });
    }

    let backend = GitHubSync::new(token);
    github::smart_sync(&backend, &cores).await
}

/// Push only (no pull).
#[tauri::command]
pub async fn sync_push() -> CmdResult<SyncResult> {
    let _lock = acquire_sync_lock().await?;

    let config = manifest::read_sync_config()?
        .ok_or(NoctoError::SyncNotConfigured)?;
    let token = get_token(&config)?;
    let cores = build_sync_cores(&config)?;

    let backend = GitHubSync::new(token);
    backend.push(&cores).await
}

/// Pull only (no push).
#[tauri::command]
pub async fn sync_pull() -> CmdResult<SyncResult> {
    let _lock = acquire_sync_lock().await?;

    let config = manifest::read_sync_config()?
        .ok_or(NoctoError::SyncNotConfigured)?;
    let token = get_token(&config)?;
    let cores = build_sync_cores(&config)?;

    let backend = GitHubSync::new(token);
    backend.pull(&cores).await
}

/// Enable sync for a core.
#[tauri::command]
pub async fn sync_enable_core(
    core_id: String,
    core_name: String,
    token: String,
) -> CmdResult<()> {
    let _lock = acquire_sync_lock().await?;

    let mut config = manifest::read_sync_config()?
        .ok_or(NoctoError::SyncNotConfigured)?;

    let repo_path = PathBuf::from(&config.repo_local_path);

    // Sanitize core name for use as directory
    let subdir = core_name
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '-' })
        .collect::<String>();

    // Add to sync.toml
    manifest::add_core_to_manifest(&repo_path, &core_id, &core_name, &subdir)?;

    // Add to synced_core_ids
    if !config.synced_core_ids.contains(&core_id) {
        config.synced_core_ids.push(core_id.clone());
        manifest::write_sync_config(&config)?;
    }

    // Copy core files into repo and push
    let cores = build_sync_cores(&config)?;
    let backend = GitHubSync::new(token);
    backend.push(&cores).await?;

    Ok(())
}

/// Disable sync for a core (files stay in repo).
#[tauri::command]
pub async fn sync_disable_core(core_id: String) -> CmdResult<()> {
    let mut config = manifest::read_sync_config()?
        .ok_or(NoctoError::SyncNotConfigured)?;

    let repo_path = PathBuf::from(&config.repo_local_path);
    manifest::remove_core_from_manifest(&repo_path, &core_id)?;

    config.synced_core_ids.retain(|id| id != &core_id);
    manifest::write_sync_config(&config)?;

    Ok(())
}

/// Delete a .conflict file after user has resolved it.
#[tauri::command]
pub async fn sync_resolve(
    conflict_path: String,
    state: State<'_, AppState>,
) -> CmdResult<()> {
    let core = state.active_core.read().await;
    let active = core.as_ref().ok_or(NoctoError::CoreNotFound {
        path: String::new(),
    })?;

    let abs = active.core_path.join(&conflict_path);
    if abs.exists() {
        std::fs::remove_file(&abs)?;
    }

    Ok(())
}

/// Disconnect sync: remove clone, clear config.
#[tauri::command]
pub async fn sync_disconnect() -> CmdResult<()> {
    if let Some(config) = manifest::read_sync_config()? {
        let repo_path = PathBuf::from(&config.repo_local_path);
        if repo_path.exists() {
            std::fs::remove_dir_all(&repo_path).map_err(|e| NoctoError::SyncFailed {
                detail: format!("Failed to remove sync repo: {e}"),
            })?;
        }
    }

    crate::sync::auth::cleanup_auth()?;
    manifest::delete_sync_config()?;

    Ok(())
}
```

- [ ] **Step 2: REQUIRED — Make `CoreEntry` public and expose registry reader**

The `build_sync_cores` function needs to read `cores.json`. Currently both `CoreEntry` and `read_cores_registry` are private in `commands/core.rs`. **Both must be made public or the build will fail.**

In `src-tauri/src/commands/core.rs`:

1. Change `struct CoreEntry` to `pub struct CoreEntry` (line ~20)
2. Add a public wrapper after the existing `read_cores_registry` function:

```rust
/// Public access to the cores registry for sync.
pub fn read_cores_registry_pub() -> Result<Vec<CoreEntry>, NoctoError> {
    read_cores_registry()
}
```

- [ ] **Step 3: Register in `commands/mod.rs`**

Add `pub mod sync;` and `pub use self::sync::*;`

- [ ] **Step 4: Register in `lib.rs` invoke_handler**

Add after the graph commands:

```rust
            // Sync commands
            commands::sync_setup,
            commands::sync_status,
            commands::sync_smart,
            commands::sync_push,
            commands::sync_pull,
            commands::sync_enable_core,
            commands::sync_disable_core,
            commands::sync_resolve,
            commands::sync_disconnect,
```

- [ ] **Step 5: Build and test**

Run: `cd src-tauri && cargo build && cargo test`
Expected: Clean build, all existing tests pass.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/commands/sync.rs src-tauri/src/commands/core.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs
git commit -m "feat(sync): add all sync Tauri commands"
```

---

## Chunk 4: Frontend — Bridge, Store, Settings Tab, Sync Button

### Task 11: Add sync bridge functions

**Files:**
- Create: `src/lib/bridge/sync.ts`

- [ ] **Step 1: Write typed invoke wrappers**

```typescript
import { invoke } from '@tauri-apps/api/core';

export interface SyncStatus {
  configured: boolean;
  syncing: boolean;
  lastPushAt: string | null;
  lastPullAt: string | null;
  hasLocalChanges: boolean;
  error: string | null;
}

export interface SyncResult {
  filesPushed: number;
  filesPulled: number;
  conflicts: string[];
}

export async function syncSetup(remoteUrl: string, token: string): Promise<void> {
  return invoke('sync_setup', { remoteUrl, token });
}

export async function syncStatus(): Promise<SyncStatus> {
  return invoke<SyncStatus>('sync_status');
}

export async function syncSmart(): Promise<SyncResult> {
  return invoke<SyncResult>('sync_smart');
}

export async function syncPush(): Promise<SyncResult> {
  return invoke<SyncResult>('sync_push');
}

export async function syncPull(): Promise<SyncResult> {
  return invoke<SyncResult>('sync_pull');
}

export async function syncEnableCore(coreId: string, coreName: string, token: string): Promise<void> {
  return invoke('sync_enable_core', { coreId, coreName, token });
}

export async function syncDisableCore(coreId: string): Promise<void> {
  return invoke('sync_disable_core', { coreId });
}

export async function syncResolve(conflictPath: string): Promise<void> {
  return invoke('sync_resolve', { conflictPath });
}

export async function syncDisconnect(): Promise<void> {
  return invoke('sync_disconnect');
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/bridge/sync.ts
git commit -m "feat(sync): add frontend bridge functions for sync commands"
```

---

### Task 12: Add sync store

**Files:**
- Create: `src/lib/stores/sync.svelte.ts`

- [ ] **Step 1: Write the sync state store**

```typescript
import { syncStatus, syncSmart, syncPush, syncPull, type SyncStatus, type SyncResult } from '../bridge/sync';

let status = $state<SyncStatus>({
  configured: false,
  syncing: false,
  lastPushAt: null,
  lastPullAt: null,
  hasLocalChanges: false,
  error: null,
});

let lastError = $state<string | null>(null);

export function getSyncState() {
  return {
    get status() { return status; },
    get lastError() { return lastError; },

    async refresh() {
      try {
        status = await syncStatus();
        lastError = null;
      } catch (err) {
        lastError = String(err);
      }
    },

    async sync(): Promise<SyncResult | null> {
      if (status.syncing) return null;
      status = { ...status, syncing: true, error: null };
      try {
        const result = await syncSmart();
        await this.refresh();
        return result;
      } catch (err) {
        lastError = String(err);
        status = { ...status, syncing: false, error: String(err) };
        return null;
      }
    },

    reset() {
      status = {
        configured: false,
        syncing: false,
        lastPushAt: null,
        lastPullAt: null,
        hasLocalChanges: false,
        error: null,
      };
      lastError = null;
    },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/stores/sync.svelte.ts
git commit -m "feat(sync): add sync state store"
```

---

### Task 13: Add SettingsSync tab component

**Files:**
- Create: `src/lib/components/common/settings/SettingsSync.svelte`
- Modify: `src/lib/components/common/SettingsModal.svelte`

- [ ] **Step 1: Create the sync settings panel**

```svelte
<script lang="ts">
  import { getSettings } from '../../../stores/settings.svelte';
  import { getSyncState } from '../../../stores/sync.svelte';
  import { getCoreState } from '../../../stores/core.svelte';
  import { syncSetup, syncEnableCore, syncDisableCore, syncDisconnect } from '../../../bridge/sync';
  import { listCores } from '../../../bridge/commands';

  let { settings }: { settings: ReturnType<typeof getSettings> } = $props();

  const syncState = getSyncState();
  const core = getCoreState();

  let token = $state('');
  let repoUrl = $state('');
  let connecting = $state(false);
  let error = $state<string | null>(null);
  let cores = $state<{ id: string; name: string; synced: boolean }[]>([]);

  async function loadCores() {
    try {
      const allCores = await listCores();
      const status = syncState.status;
      cores = allCores.map(c => ({
        id: c.id,
        name: c.name,
        synced: false, // TODO: cross-reference with sync config
      }));
    } catch {}
  }

  async function handleConnect() {
    if (!token.trim() || !repoUrl.trim()) return;
    connecting = true;
    error = null;
    try {
      await syncSetup(repoUrl.trim(), token.trim());
      await syncState.refresh();
      await loadCores();
    } catch (err) {
      error = String(err);
    }
    connecting = false;
  }

  async function handleDisconnect() {
    try {
      await syncDisconnect();
      syncState.reset();
      cores = [];
    } catch (err) {
      error = String(err);
    }
  }

  async function toggleCoreSync(coreId: string, coreName: string, enabled: boolean) {
    try {
      if (enabled) {
        await syncEnableCore(coreId, coreName, token);
      } else {
        await syncDisableCore(coreId);
      }
      await loadCores();
    } catch (err) {
      error = String(err);
    }
  }

  $effect(() => {
    if (syncState.status.configured) {
      loadCores();
    }
  });
</script>

<div class="settings__section">
  {#if !syncState.status.configured}
    <div class="settings__row settings__row--vertical">
      <div class="settings__row-info">
        <span class="settings__row-label">GitHub Token</span>
        <span class="settings__row-desc">Generate a fine-grained PAT with repo read/write access.</span>
      </div>
      <input
        class="settings__font-input"
        type="password"
        placeholder="ghp_xxxxxxxxxxxx"
        bind:value={token}
      />
    </div>
    <div class="settings__row settings__row--vertical">
      <div class="settings__row-info">
        <span class="settings__row-label">Repository URL</span>
        <span class="settings__row-desc">HTTPS URL of your sync repo.</span>
      </div>
      <input
        class="settings__font-input"
        type="text"
        placeholder="https://github.com/user/noctodeus-vault.git"
        bind:value={repoUrl}
      />
    </div>
    <div class="settings__row settings__row--action">
      <button
        class="settings__reset-all"
        onclick={handleConnect}
        disabled={connecting || !token.trim() || !repoUrl.trim()}
      >
        {connecting ? 'Connecting...' : 'Connect'}
      </button>
    </div>
  {:else}
    <div class="settings__row">
      <div class="settings__row-info">
        <span class="settings__row-label">Connected</span>
        <span class="settings__row-desc">
          Last sync: {syncState.status.lastPushAt ?? 'never'}
        </span>
      </div>
      <button class="settings__reset-all" onclick={handleDisconnect}>
        Disconnect
      </button>
    </div>

    {#each cores as c}
      <div class="settings__row">
        <div class="settings__row-info">
          <span class="settings__row-label">{c.name}</span>
        </div>
        <label class="settings__toggle">
          <input
            type="checkbox"
            checked={c.synced}
            onchange={() => toggleCoreSync(c.id, c.name, !c.synced)}
          />
          <span class="settings__toggle-track"></span>
        </label>
      </div>
    {/each}
  {/if}

  {#if error}
    <div class="settings__row">
      <span class="settings__row-desc" style="color: var(--color-error, #f7768e);">{error}</span>
    </div>
  {/if}
</div>
```

- [ ] **Step 2: Register sync tab in SettingsModal**

In `SettingsModal.svelte`:

1. Add import: `import SettingsSync from './settings/SettingsSync.svelte';`
2. Add icon import: `import CloudSync from "@lucide/svelte/icons/cloud";` (or `RefreshCw`)
3. Update `Section` type: `type Section = 'general' | 'editor' | 'appearance' | 'files' | 'hotkeys' | 'sync';`
4. Add to sections array: `{ id: 'sync', label: 'Sync' }`
5. Add nav icon case: `{:else if section.id === 'sync'}<CloudSync size={14} />`
6. Add tab panel after hotkeys: `{:else if activeSection === 'sync'}<SettingsSync {settings} />`

- [ ] **Step 3: Build check**

Run: `cd /Users/neur0map/prowl/noctodeus && npm run check`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/common/settings/SettingsSync.svelte src/lib/components/common/SettingsModal.svelte
git commit -m "feat(sync): add Sync settings tab with connect/disconnect and per-core toggle"
```

---

### Task 14: Add SyncButton to sidebar footer

**Files:**
- Create: `src/lib/components/layout/SyncButton.svelte`
- Modify: `src/lib/components/layout/SidebarContent.svelte`

- [ ] **Step 1: Create the sync button component**

```svelte
<script lang="ts">
  import { getSyncState } from '../../stores/sync.svelte';
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';
  import Check from '@lucide/svelte/icons/check';
  import AlertCircle from '@lucide/svelte/icons/alert-circle';
  import Circle from '@lucide/svelte/icons/circle';

  const sync = getSyncState();

  async function handleSync() {
    if (!sync.status.configured || sync.status.syncing) return;
    const { toast } = await import('../../stores/toast.svelte');
    const result = await sync.sync();
    if (result) {
      if (result.conflicts.length > 0) {
        toast.warn(`Synced with ${result.conflicts.length} conflict(s)`);
      } else {
        const total = result.filesPushed + result.filesPulled;
        toast.success(total > 0 ? `Synced — ${total} files updated` : 'Already up to date');
      }
    } else if (sync.lastError) {
      toast.error(`Sync failed: ${sync.lastError}`);
    }
  }
</script>

{#if sync.status.configured}
  <button
    class="sync-btn"
    class:sync-btn--syncing={sync.status.syncing}
    class:sync-btn--error={!!sync.status.error}
    class:sync-btn--pending={sync.status.hasLocalChanges}
    onclick={handleSync}
    disabled={sync.status.syncing}
    title={sync.status.syncing ? 'Syncing...' : 'Sync now'}
  >
    {#if sync.status.syncing}
      <RefreshCw size={13} class="sync-btn__spin" />
    {:else if sync.status.error}
      <AlertCircle size={13} />
    {:else if sync.status.hasLocalChanges}
      <Circle size={13} />
    {:else}
      <Check size={13} />
    {/if}
  </button>
{/if}

<style>
  .sync-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--color-muted-foreground);
    cursor: pointer;
    transition: color 150ms ease-out, background 150ms ease-out;
  }

  .sync-btn:hover {
    color: var(--color-foreground);
    background: var(--color-hover);
  }

  .sync-btn--syncing {
    color: var(--color-accent);
  }

  .sync-btn--syncing :global(.sync-btn__spin) {
    animation: spin 1s linear infinite;
  }

  .sync-btn--error {
    color: var(--color-error, #f7768e);
  }

  .sync-btn--pending {
    color: var(--color-accent);
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>
```

- [ ] **Step 2: Add SyncButton to SidebarContent footer**

Read `SidebarContent.svelte` and add `<SyncButton />` to the sidebar footer area (near the settings gear icon).

- [ ] **Step 3: Build check**

Run: `npm run check`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/layout/SyncButton.svelte src/lib/components/layout/SidebarContent.svelte
git commit -m "feat(sync): add smart sync button to sidebar footer"
```

---

### Task 15: Add command palette sync commands

**Files:**
- Modify: `src/routes/+page.svelte`

- [ ] **Step 1: Add sync commands to the commands array**

In `+page.svelte`, find the `commands` array and add:

```typescript
{ id: 'sync-now', label: 'Sync Now', shortcut: '' },
{ id: 'sync-push', label: 'Sync: Push Only', shortcut: '' },
{ id: 'sync-pull', label: 'Sync: Pull Only', shortcut: '' },
{ id: 'sync-settings', label: 'Sync: Open Settings', shortcut: '' },
```

Wire the handlers in the command palette's `onselect` (or equivalent dispatch):
- `sync-now` → call `syncSmart`
- `sync-push` → call `syncPush`
- `sync-pull` → call `syncPull`
- `sync-settings` → open settings modal to sync tab

- [ ] **Step 2: Build and test**

Run: `npm run check && npm run test`
Expected: 0 errors, all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "feat(sync): add sync commands to command palette"
```

---

### Task 16: Final verification

- [ ] **Step 1: Run full Rust test suite**

Run: `cd src-tauri && cargo test`
Expected: All tests pass (original 30 + new sync tests).

- [ ] **Step 2: Run full frontend check**

Run: `npm run check && npm run test`
Expected: 0 errors, all frontend tests pass.

- [ ] **Step 3: Manual smoke test**

1. `npm run tauri dev`
2. Open Settings → Sync tab should appear
3. The sync button should NOT appear in sidebar (not configured yet)
4. Configure with a PAT + test repo URL
5. Enable sync for a core
6. Click Sync → should push files to GitHub
7. Verify files appear in the GitHub repo

- [ ] **Step 4: Commit**

```bash
git commit --allow-empty -m "milestone: GitHub sync feature complete"
```
