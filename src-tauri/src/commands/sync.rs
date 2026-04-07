use std::path::PathBuf;

use tauri::State;

use crate::core::state::AppState;
use crate::errors::{CmdResult, NoctoError};
use crate::sync::github::{self, GitHubSync};
use crate::sync::manifest;
use crate::sync::{acquire_sync_lock, SyncBackend, SyncConfig, SyncCore, SyncResult, SyncStatus};

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

/// Helper: get token from sync config.
fn get_token(config: &SyncConfig) -> Result<String, NoctoError> {
    config.token.clone().ok_or(NoctoError::SyncFailed {
        detail: "No auth token configured. Re-enter your GitHub token in Settings > Sync."
            .to_string(),
    })
}

// ── Commands ──────────────────────────────────────────────────────────

/// Configure sync: validate git, clone repo, create sync.toml if needed.
#[tauri::command]
pub async fn sync_setup(remote_url: String, token: String) -> CmdResult<()> {
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
        token: Some(token.clone()),
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
    let config = match manifest::read_sync_config()? {
        Some(c) => c,
        None => return Ok(SyncStatus {
            configured: false,
            syncing: false,
            last_push_at: None,
            last_pull_at: None,
            has_local_changes: false,
            error: None,
            synced_core_ids: vec![],
            remote_url: None,
        }),
    };

    let repo_path = std::path::PathBuf::from(&config.repo_local_path);
    let has_changes = if repo_path.join(".git").exists() {
        crate::sync::git::has_changes(&repo_path).await.unwrap_or(false)
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
        synced_core_ids: config.synced_core_ids,
        remote_url: Some(config.remote_url),
    })
}

/// Smart sync: pull then push with auto-recovery.
#[tauri::command]
pub async fn sync_smart() -> CmdResult<SyncResult> {
    let _lock = acquire_sync_lock().await?;

    let config = manifest::read_sync_config()?.ok_or(NoctoError::SyncNotConfigured)?;
    let token = get_token(&config)?;

    let cores = build_sync_cores(&config)?;
    if cores.is_empty() {
        return Ok(SyncResult {
            files_pushed: 0,
            files_pulled: 0,
            conflicts: vec![],
        });
    }

    let backend = GitHubSync::new(token);
    github::smart_sync(&backend, &cores).await
}

/// Push only (no pull).
#[tauri::command]
pub async fn sync_push() -> CmdResult<SyncResult> {
    let _lock = acquire_sync_lock().await?;

    let config = manifest::read_sync_config()?.ok_or(NoctoError::SyncNotConfigured)?;
    let token = get_token(&config)?;
    let cores = build_sync_cores(&config)?;

    let backend = GitHubSync::new(token);
    backend.push(&cores).await
}

/// Pull only (no push).
#[tauri::command]
pub async fn sync_pull() -> CmdResult<SyncResult> {
    let _lock = acquire_sync_lock().await?;

    let config = manifest::read_sync_config()?.ok_or(NoctoError::SyncNotConfigured)?;
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
) -> CmdResult<()> {
    let _lock = acquire_sync_lock().await?;

    let mut config = manifest::read_sync_config()?.ok_or(NoctoError::SyncNotConfigured)?;
    let token = get_token(&config)?;

    let repo_path = PathBuf::from(&config.repo_local_path);

    // Sanitize core name for use as directory
    let subdir = core_name
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '-'
            }
        })
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
    let mut config = manifest::read_sync_config()?.ok_or(NoctoError::SyncNotConfigured)?;

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
