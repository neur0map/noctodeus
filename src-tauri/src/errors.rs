use serde::ser::SerializeStruct;
use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum NoctoError {
    // File system
    #[error("File not found: {path}")]
    FileNotFound { path: String },
    #[error("Permission denied: {path}")]
    PermissionDenied { path: String },
    #[error("Disk full")]
    DiskFull,
    #[error("Path conflict: {path}")]
    PathConflict { path: String },

    // Core
    #[error("Core not found: {path}")]
    CoreNotFound { path: String },
    #[error("Core already open")]
    CoreAlreadyOpen,
    #[error("Core corrupted: {detail}")]
    CoreCorrupted { detail: String },

    // Database
    #[error("Database migration failed: {detail}")]
    DbMigrationFailed { detail: String },
    #[error("Database query failed: {detail}")]
    DbQueryFailed { detail: String },

    // Internal
    #[error("Watcher failed: {detail}")]
    WatcherFailed { detail: String },
    #[error("Indexer failed: {detail}")]
    IndexerFailed { detail: String },
    #[error("Unexpected error: {detail}")]
    Unexpected { detail: String },

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

    // Share
    #[error("Share failed: {detail}")]
    ShareFailed { detail: String },
}

impl NoctoError {
    fn code(&self) -> &'static str {
        match self {
            NoctoError::FileNotFound { .. } => "file_not_found",
            NoctoError::PermissionDenied { .. } => "permission_denied",
            NoctoError::DiskFull => "disk_full",
            NoctoError::PathConflict { .. } => "path_conflict",
            NoctoError::CoreNotFound { .. } => "core_not_found",
            NoctoError::CoreAlreadyOpen => "core_already_open",
            NoctoError::CoreCorrupted { .. } => "core_corrupted",
            NoctoError::DbMigrationFailed { .. } => "db_migration_failed",
            NoctoError::DbQueryFailed { .. } => "db_query_failed",
            NoctoError::WatcherFailed { .. } => "watcher_failed",
            NoctoError::IndexerFailed { .. } => "indexer_failed",
            NoctoError::Unexpected { .. } => "unexpected",
            NoctoError::SyncFailed { .. } => "sync_failed",
            NoctoError::SyncBusy => "sync_busy",
            NoctoError::SyncNotConfigured => "sync_not_configured",
            NoctoError::GitNotFound => "git_not_found",
            NoctoError::SyncConflict { .. } => "sync_conflict",
            NoctoError::ShareFailed { .. } => "share_failed",
        }
    }
}

impl Serialize for NoctoError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let mut state = serializer.serialize_struct("NoctoError", 2)?;
        state.serialize_field("code", self.code())?;
        state.serialize_field("message", &self.to_string())?;
        state.end()
    }
}

impl From<rusqlite::Error> for NoctoError {
    fn from(err: rusqlite::Error) -> Self {
        NoctoError::DbQueryFailed {
            detail: err.to_string(),
        }
    }
}

impl From<std::io::Error> for NoctoError {
    fn from(err: std::io::Error) -> Self {
        match err.kind() {
            std::io::ErrorKind::NotFound => NoctoError::FileNotFound {
                path: err.to_string(),
            },
            std::io::ErrorKind::PermissionDenied => NoctoError::PermissionDenied {
                path: err.to_string(),
            },
            _ => NoctoError::Unexpected {
                detail: err.to_string(),
            },
        }
    }
}

impl From<notify::Error> for NoctoError {
    fn from(err: notify::Error) -> Self {
        NoctoError::WatcherFailed {
            detail: err.to_string(),
        }
    }
}

impl From<walkdir::Error> for NoctoError {
    fn from(err: walkdir::Error) -> Self {
        NoctoError::IndexerFailed {
            detail: err.to_string(),
        }
    }
}

impl From<toml::ser::Error> for NoctoError {
    fn from(err: toml::ser::Error) -> Self {
        NoctoError::CoreCorrupted {
            detail: format!("TOML serialization failed: {err}"),
        }
    }
}

impl From<toml::de::Error> for NoctoError {
    fn from(err: toml::de::Error) -> Self {
        NoctoError::CoreCorrupted {
            detail: format!("TOML parse failed: {err}"),
        }
    }
}

impl From<serde_json::Error> for NoctoError {
    fn from(err: serde_json::Error) -> Self {
        NoctoError::Unexpected {
            detail: format!("JSON error: {err}"),
        }
    }
}

/// Result type alias for Tauri commands.
pub type CmdResult<T> = Result<T, NoctoError>;
