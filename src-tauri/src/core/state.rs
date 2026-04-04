use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use rusqlite::Connection;
use serde::Serialize;
use tokio::sync::RwLock;

/// Serializable snapshot of a Core's identity, sent to the frontend.
#[derive(Debug, Clone, Serialize)]
pub struct CoreInfo {
    pub id: String,
    pub name: String,
    pub path: String,
    pub created_at: String,
    pub last_opened: Option<String>,
}

/// The currently-open Core with its SQLite connection and filesystem root.
pub struct ActiveCore {
    pub info: CoreInfo,
    pub db: Arc<Mutex<Connection>>,
    pub core_path: PathBuf,
}

// ActiveCore is not Clone (contains a Connection), but Debug is handy for logs.
impl std::fmt::Debug for ActiveCore {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ActiveCore")
            .field("info", &self.info)
            .field("core_path", &self.core_path)
            .finish_non_exhaustive()
    }
}

/// Top-level application state managed by Tauri.
pub struct AppState {
    pub active_core: Arc<RwLock<Option<ActiveCore>>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            active_core: Arc::new(RwLock::new(None)),
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}
