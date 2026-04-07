use std::path::Path;

use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;

use crate::errors::NoctoError;

/// Type alias for the SQLite connection pool used throughout the app.
pub type DbPool = Pool<SqliteConnectionManager>;

/// Create a new connection pool for the SQLite database at
/// `.noctodeus/meta.db` inside the given core path.
///
/// Each connection is initialized with WAL mode and foreign keys enabled.
/// The pool size is kept small (4 connections) because this is a local
/// single-user app — we just need enough to avoid blocking the async
/// runtime while a long scan or FTS rebuild is running.
pub fn create_pool(core_path: &Path) -> Result<DbPool, NoctoError> {
    let db_path = core_path.join(".noctodeus").join("meta.db");

    let manager = SqliteConnectionManager::file(&db_path).with_init(|conn| {
        conn.execute_batch(
            "PRAGMA journal_mode=WAL;
                 PRAGMA foreign_keys=ON;
                 PRAGMA busy_timeout=5000;",
        )?;
        Ok(())
    });

    let pool = Pool::builder()
        .max_size(4)
        .build(manager)
        .map_err(|e| NoctoError::Unexpected {
            detail: format!("Failed to create DB pool: {e}"),
        })?;

    Ok(pool)
}
