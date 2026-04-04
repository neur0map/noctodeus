use rusqlite::{params, Connection};

use crate::db::queries::FileInfo;
use crate::errors::NoctoError;

pub fn upsert_file(conn: &Connection, file: &FileInfo) -> Result<(), NoctoError> {
    conn.execute(
        "INSERT INTO files (path, parent_dir, name, extension, title, size, modified_at, content_hash, is_directory)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
         ON CONFLICT(path) DO UPDATE SET
            parent_dir = excluded.parent_dir,
            name = excluded.name,
            extension = excluded.extension,
            title = excluded.title,
            size = excluded.size,
            modified_at = excluded.modified_at,
            content_hash = excluded.content_hash,
            is_directory = excluded.is_directory",
        params![
            file.path,
            file.parent_dir,
            file.name,
            file.extension,
            file.title,
            file.size,
            file.modified_at,
            file.content_hash,
            file.is_directory as i32,
        ],
    )?;
    Ok(())
}

pub fn delete_file(conn: &Connection, path: &str) -> Result<(), NoctoError> {
    conn.execute("DELETE FROM files WHERE path = ?1", params![path])?;
    conn.execute("DELETE FROM pinned WHERE path = ?1", params![path])?;
    conn.execute("DELETE FROM recents WHERE path = ?1", params![path])?;
    Ok(())
}

pub fn rename_file(conn: &Connection, old_path: &str, new_path: &str) -> Result<(), NoctoError> {
    conn.execute(
        "UPDATE files SET path = ?1 WHERE path = ?2",
        params![new_path, old_path],
    )?;
    conn.execute(
        "UPDATE pinned SET path = ?1 WHERE path = ?2",
        params![new_path, old_path],
    )?;
    conn.execute(
        "UPDATE recents SET path = ?1 WHERE path = ?2",
        params![new_path, old_path],
    )?;
    Ok(())
}

pub fn add_pinned(conn: &Connection, path: &str) -> Result<(), NoctoError> {
    conn.execute(
        "INSERT OR REPLACE INTO pinned (path, pinned_at)
         VALUES (?1, strftime('%s', 'now'))",
        params![path],
    )?;
    Ok(())
}

pub fn remove_pinned(conn: &Connection, path: &str) -> Result<(), NoctoError> {
    conn.execute("DELETE FROM pinned WHERE path = ?1", params![path])?;
    Ok(())
}

pub fn add_recent(conn: &Connection, path: &str) -> Result<(), NoctoError> {
    conn.execute(
        "INSERT OR REPLACE INTO recents (path, accessed_at)
         VALUES (?1, strftime('%s', 'now'))",
        params![path],
    )?;
    Ok(())
}

pub fn save_state(conn: &Connection, key: &str, value: &str) -> Result<(), NoctoError> {
    conn.execute(
        "INSERT OR REPLACE INTO state (key, value) VALUES (?1, ?2)",
        params![key, value],
    )?;
    Ok(())
}

pub fn clear_files(conn: &Connection) -> Result<(), NoctoError> {
    conn.execute_batch(
        "DELETE FROM files;
         DELETE FROM files_fts;",
    )?;
    Ok(())
}

pub fn upsert_fts(
    conn: &Connection,
    path: &str,
    title: Option<&str>,
    content: &str,
) -> Result<(), NoctoError> {
    // Delete existing entry first (content='' table requires manual management)
    conn.execute(
        "DELETE FROM files_fts WHERE path = ?1",
        params![path],
    )?;
    conn.execute(
        "INSERT INTO files_fts (path, title, content) VALUES (?1, ?2, ?3)",
        params![path, title, content],
    )?;
    Ok(())
}

pub fn delete_fts(conn: &Connection, path: &str) -> Result<(), NoctoError> {
    conn.execute(
        "DELETE FROM files_fts WHERE path = ?1",
        params![path],
    )?;
    Ok(())
}
