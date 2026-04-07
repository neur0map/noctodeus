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
        git::run_git(
            &repo_path,
            &["remote", "set-url", "origin", &clean_url],
            &[],
        )
        .await?;

        // Create sync manifest if this is a fresh repo
        if !repo_path
            .join(".noctodeus-sync")
            .join("sync.toml")
            .exists()
        {
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
        let config = manifest::read_sync_config()?.ok_or(NoctoError::SyncNotConfigured)?;
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
            .map_err(|e| NoctoError::SyncFailed {
                detail: e.to_string(),
            })??;
            total_files += count;
        }

        // Stage, commit, push
        git::add_all(&repo_path).await?;

        if !git::has_changes(&repo_path).await? {
            debug!("no changes to push");
            return Ok(SyncResult {
                files_pushed: 0,
                files_pulled: 0,
                conflicts: vec![],
            });
        }

        let core_names: Vec<&str> = cores.iter().map(|c| c.name.as_str()).collect();
        let msg = format!(
            "sync: {} @ {}",
            core_names.join(", "),
            Utc::now().to_rfc3339()
        );
        git::commit(&repo_path, &msg).await?;

        let env = self.auth_env()?;
        git::push(&repo_path, &Self::env_refs(&env)).await?;

        // Update timestamps
        let mut sync_config = config;
        sync_config.last_push_at = Some(Utc::now().to_rfc3339());
        manifest::write_sync_config(&sync_config)?;

        info!(files = total_files, "push complete");
        Ok(SyncResult {
            files_pushed: total_files,
            files_pulled: 0,
            conflicts: vec![],
        })
    }

    async fn pull(&self, cores: &[SyncCore]) -> Result<SyncResult, NoctoError> {
        let config = manifest::read_sync_config()?.ok_or(NoctoError::SyncNotConfigured)?;
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
            return Ok(SyncResult {
                files_pushed: 0,
                files_pulled: 0,
                conflicts: vec![],
            });
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
                    .map_err(|e| NoctoError::SyncFailed {
                        detail: e.to_string(),
                    })?
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
            let Some((core, _)) = core_snapshots
                .iter()
                .find(|(c, _)| entry.path.starts_with(&format!("{}/", c.repo_subdir)))
            else {
                continue;
            };
            let core_path = Path::new(&core.local_path);

            // Strip the repo subdir prefix to get the relative path within the core
            let core_rel = entry
                .path
                .strip_prefix(&format!("{}/", core.repo_subdir))
                .unwrap_or(&entry.path);

            match entry.status {
                'D' => {
                    let cp = core_path.to_path_buf();
                    let rel = core_rel.to_string();
                    tokio::task::spawn_blocking(move || copy::delete_from_core(&cp, &rel))
                        .await
                        .map_err(|e| NoctoError::SyncFailed {
                            detail: e.to_string(),
                        })??;
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
                        tokio::task::spawn_blocking(move || {
                            copy::rename_in_core(&cp, &old, &new)
                        })
                        .await
                        .map_err(|e| NoctoError::SyncFailed {
                            detail: e.to_string(),
                        })??;
                        total_pulled += 1;
                    }
                }
                'M' | 'A' => {
                    // Check if file was also locally modified (different from last sync snapshot)
                    let snapshot_hash = core_snapshots
                        .iter()
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

                    // Get the repo file (now at remote version after reset)
                    let repo_file = repo_path.join(&entry.path);
                    let remote_content =
                        std::fs::read_to_string(&repo_file).unwrap_or_default();

                    let both_changed =
                        snapshot_hash.is_some() && local_hash.as_deref() != snapshot_hash;

                    if both_changed {
                        // Three-way merge: ancestor=snapshot, ours=local, theirs=remote
                        let local_content =
                            std::fs::read_to_string(&local_file).unwrap_or_default();
                        // Use empty string as ancestor if no snapshot (new file on both sides)
                        let ancestor = "";
                        let cr = core_rel.to_string();
                        let sub = repo_path.join(&core.repo_subdir);
                        let cp = core_path.to_path_buf();
                        match conflict::resolve_conflict(
                            &cr,
                            &local_content,
                            ancestor,
                            &remote_content,
                            &sub,
                            &cp,
                        )
                        .await
                        {
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
            .map_err(|e| NoctoError::SyncFailed {
                detail: e.to_string(),
            })??;

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
            None => {
                return Ok(SyncStatus {
                    configured: false,
                    syncing: false,
                    last_push_at: None,
                    last_pull_at: None,
                    has_local_changes: false,
                    error: None,
                    synced_core_ids: vec![],
                    remote_url: None,
                })
            }
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
            last_push_at: config.last_push_at.clone(),
            last_pull_at: config.last_pull_at.clone(),
            has_local_changes: has_changes,
            error: None,
            synced_core_ids: config.synced_core_ids.clone(),
            remote_url: Some(config.remote_url.clone()),
        })
    }
}

/// Smart sync: pull then push, with automatic error recovery and retries.
pub async fn smart_sync(
    backend: &GitHubSync,
    cores: &[SyncCore],
) -> Result<SyncResult, NoctoError> {
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
                    Ok(r) => {
                        return Ok(SyncResult {
                            files_pushed: r.files_pushed,
                            files_pulled: pull_result.files_pulled + r.files_pulled,
                            conflicts: [pull_result.conflicts.clone(), r.conflicts].concat(),
                        });
                    }
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
