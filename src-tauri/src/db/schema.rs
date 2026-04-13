use rusqlite::Connection;

use crate::errors::NoctoError;

pub fn run_migrations(conn: &Connection) -> Result<(), NoctoError> {
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

        CREATE TABLE IF NOT EXISTS research_sessions (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            summary TEXT NOT NULL DEFAULT '',
            sources TEXT NOT NULL DEFAULT '[]',
            messages TEXT NOT NULL DEFAULT '[]',
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );
    ",
    )?;
    Ok(())
}
