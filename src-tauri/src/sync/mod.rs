pub mod auth;
pub mod conflict;
pub mod copy;
pub mod git;
pub mod github;
pub mod icloud;
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
    pub local_path: String,
    pub repo_subdir: String,
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
    pub synced_core_ids: Vec<String>,
    pub remote_url: Option<String>,
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
    async fn push(&self, cores: &[SyncCore], sync_media: bool) -> Result<SyncResult, NoctoError>;
    async fn pull(&self, cores: &[SyncCore]) -> Result<SyncResult, NoctoError>;
    async fn status(&self) -> Result<SyncStatus, NoctoError>;
}
