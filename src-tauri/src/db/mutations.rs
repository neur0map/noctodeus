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

// ---------------------------------------------------------------------------
// Wiki mutations
// ---------------------------------------------------------------------------

pub fn upsert_wiki_meta(
    conn: &Connection,
    last_ingest_at: i64,
    page_count: i64,
    link_count: i64,
) -> Result<(), NoctoError> {
    conn.execute(
        "INSERT INTO wiki_meta (id, last_ingest_at, page_count, link_count)
         VALUES (1, ?1, ?2, ?3)
         ON CONFLICT(id) DO UPDATE SET
            last_ingest_at = excluded.last_ingest_at,
            page_count = excluded.page_count,
            link_count = excluded.link_count",
        params![last_ingest_at, page_count, link_count],
    )?;
    Ok(())
}

pub fn update_wiki_lint_at(conn: &Connection, lint_at: i64) -> Result<(), NoctoError> {
    conn.execute(
        "UPDATE wiki_meta SET last_lint_at = ?1 WHERE id = 1",
        params![lint_at],
    )?;
    Ok(())
}

pub fn insert_wiki_ingest_entry(
    conn: &Connection,
    id: &str,
    source_path: &str,
    source_type: &str,
    content_hash: &str,
    ingested_at: i64,
    wiki_pages_affected: &str,
) -> Result<(), NoctoError> {
    conn.execute(
        "INSERT OR REPLACE INTO wiki_ingest_log (id, source_path, source_type, content_hash, ingested_at, wiki_pages_affected)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![id, source_path, source_type, content_hash, ingested_at, wiki_pages_affected],
    )?;
    Ok(())
}

pub fn upsert_wiki_page_hash(
    conn: &Connection,
    page_path: &str,
    written_hash: &str,
) -> Result<(), NoctoError> {
    conn.execute(
        "INSERT OR REPLACE INTO wiki_page_hashes (page_path, written_hash)
         VALUES (?1, ?2)",
        params![page_path, written_hash],
    )?;
    Ok(())
}

pub fn delete_wiki_page_hash(conn: &Connection, page_path: &str) -> Result<(), NoctoError> {
    conn.execute(
        "DELETE FROM wiki_page_hashes WHERE page_path = ?1",
        params![page_path],
    )?;
    Ok(())
}

pub fn clear_wiki_data(conn: &Connection) -> Result<(), NoctoError> {
    conn.execute_batch(
        "DELETE FROM wiki_ingest_log;
         DELETE FROM wiki_meta;
         DELETE FROM wiki_page_hashes;"
    )?;
    Ok(())
}
