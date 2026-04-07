use rusqlite::Connection;
use tracing::{debug, info};

use crate::errors::NoctoError;

/// Run all pending migrations on the database.
///
/// Creates the `schema_version` table if it doesn't exist, reads the
/// current version, and runs each migration function sequentially.
/// Each migration bumps the version number after success.
pub fn run_all_migrations(conn: &Connection) -> Result<(), NoctoError> {
    // Create version tracking table.
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_version (
            version INTEGER NOT NULL
        );",
    )?;

    let current_version = get_version(conn)?;
    info!(current_version, "checking schema migrations");

    let migrations: &[fn(&Connection) -> Result<(), NoctoError>] = &[
        migrate_v1, // Initial schema: files, pinned, recents, state, files_fts
        migrate_v2, // Links table for wiki-link graph
    ];

    for (i, migration) in migrations.iter().enumerate() {
        let version = (i + 1) as i64;
        if version > current_version {
            debug!(version, "running migration");
            migration(conn)?;
            set_version(conn, version)?;
            info!(version, "migration complete");
        }
    }

    Ok(())
}

/// Get the current schema version. Returns 0 if no version is set.
fn get_version(conn: &Connection) -> Result<i64, NoctoError> {
    let result: Result<i64, _> = conn.query_row(
        "SELECT COALESCE(MAX(version), 0) FROM schema_version",
        [],
        |row| row.get(0),
    );
    match result {
        Ok(v) => Ok(v),
        Err(_) => Ok(0),
    }
}

/// Set the schema version.
fn set_version(conn: &Connection, version: i64) -> Result<(), NoctoError> {
    conn.execute("DELETE FROM schema_version", [])?;
    conn.execute(
        "INSERT INTO schema_version (version) VALUES (?1)",
        [version],
    )?;
    Ok(())
}

/// V1: Initial schema — files, pinned, recents, state, FTS5.
/// This is the same schema that was previously in schema.rs `run_migrations()`.
fn migrate_v1(conn: &Connection) -> Result<(), NoctoError> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS files (
            path TEXT PRIMARY KEY,
            parent_dir TEXT NOT NULL,
            name TEXT NOT NULL,
            extension TEXT,
            title TEXT,
            size INTEGER,
            modified_at INTEGER,
            content_hash TEXT,
            is_directory INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS pinned (
            path TEXT PRIMARY KEY,
            pinned_at INTEGER
        );

        CREATE TABLE IF NOT EXISTS recents (
            path TEXT PRIMARY KEY,
            accessed_at INTEGER
        );

        CREATE TABLE IF NOT EXISTS state (
            key TEXT PRIMARY KEY,
            value TEXT
        );

        CREATE VIRTUAL TABLE IF NOT EXISTS files_fts USING fts5(
            path,
            title,
            content,
            tokenize='porter unicode61'
        );

        CREATE INDEX IF NOT EXISTS idx_files_parent ON files(parent_dir);
        CREATE INDEX IF NOT EXISTS idx_files_extension ON files(extension);
        ",
    )?;
    Ok(())
}

/// V2: Links table for wiki-link graph.
/// Populated during file indexing, queried for graph view + backlinks.
fn migrate_v2(conn: &Connection) -> Result<(), NoctoError> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS links (
            source_path TEXT NOT NULL,
            target_path TEXT NOT NULL,
            PRIMARY KEY (source_path, target_path)
        );

        CREATE INDEX IF NOT EXISTS idx_links_target ON links(target_path);
        ",
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    #[test]
    fn test_fresh_db_runs_all_migrations() {
        let conn = Connection::open_in_memory().unwrap();
        run_all_migrations(&conn).unwrap();

        // Should be at version 2.
        let version = get_version(&conn).unwrap();
        assert_eq!(version, 2);

        // V1 tables should exist.
        let count: i64 = conn
            .query_row(
                "SELECT count(*) FROM sqlite_master WHERE name = 'files'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);

        // V2 tables should exist.
        let count: i64 = conn
            .query_row(
                "SELECT count(*) FROM sqlite_master WHERE name = 'links'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn test_idempotent_migrations() {
        let conn = Connection::open_in_memory().unwrap();
        run_all_migrations(&conn).unwrap();
        // Running again should be a no-op (all versions already applied).
        run_all_migrations(&conn).unwrap();
        let version = get_version(&conn).unwrap();
        assert_eq!(version, 2);
    }

    #[test]
    fn test_incremental_migration() {
        let conn = Connection::open_in_memory().unwrap();

        // Simulate a DB that already had V1 applied.
        conn.execute_batch(
            "CREATE TABLE schema_version (version INTEGER NOT NULL);
             INSERT INTO schema_version (version) VALUES (1);",
        )
        .unwrap();
        // Create V1 tables manually.
        conn.execute_batch(
            "CREATE TABLE files (path TEXT PRIMARY KEY, parent_dir TEXT NOT NULL, name TEXT NOT NULL, extension TEXT, title TEXT, size INTEGER, modified_at INTEGER, content_hash TEXT, is_directory INTEGER DEFAULT 0);
             CREATE TABLE pinned (path TEXT PRIMARY KEY, pinned_at INTEGER);
             CREATE TABLE recents (path TEXT PRIMARY KEY, accessed_at INTEGER);
             CREATE TABLE state (key TEXT PRIMARY KEY, value TEXT);",
        )
        .unwrap();

        // Now run migrations — should only apply V2.
        run_all_migrations(&conn).unwrap();
        let version = get_version(&conn).unwrap();
        assert_eq!(version, 2);

        // Links table should exist.
        let count: i64 = conn
            .query_row(
                "SELECT count(*) FROM sqlite_master WHERE name = 'links'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
    }
}
