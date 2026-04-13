use rusqlite::{params, Connection, Row};
use serde::{Deserialize, Serialize};

use crate::errors::NoctoError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileInfo {
    pub path: String,
    pub parent_dir: String,
    pub name: String,
    pub extension: Option<String>,
    pub title: Option<String>,
    pub size: Option<i64>,
    pub modified_at: Option<i64>,
    pub content_hash: Option<String>,
    pub is_directory: bool,
    #[serde(default)]
    pub aliases: Vec<String>,
    #[serde(default)]
    pub evicted: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchHit {
    pub path: String,
    pub title: Option<String>,
    pub snippet: String,
    pub score: f64,
}

fn row_to_file_info(row: &Row<'_>) -> rusqlite::Result<FileInfo> {
    let is_dir: i32 = row.get("is_directory")?;
    Ok(FileInfo {
        path: row.get("path")?,
        parent_dir: row.get("parent_dir")?,
        name: row.get("name")?,
        extension: row.get("extension")?,
        title: row.get("title")?,
        size: row.get("size")?,
        modified_at: row.get("modified_at")?,
        content_hash: row.get("content_hash")?,
        is_directory: is_dir != 0,
        aliases: Vec::new(),
        evicted: false,
    })
}

pub fn get_file(conn: &Connection, path: &str) -> Result<FileInfo, NoctoError> {
    conn.query_row(
        "SELECT path, parent_dir, name, extension, title, size, modified_at, content_hash, is_directory
         FROM files WHERE path = ?1",
        params![path],
        row_to_file_info,
    )
    .map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => NoctoError::FileNotFound {
            path: path.to_string(),
        },
        other => NoctoError::DbQueryFailed {
            detail: other.to_string(),
        },
    })
}

pub fn list_files(conn: &Connection, parent_dir: &str) -> Result<Vec<FileInfo>, NoctoError> {
    let mut stmt = conn.prepare(
        "SELECT path, parent_dir, name, extension, title, size, modified_at, content_hash, is_directory
         FROM files WHERE parent_dir = ?1 ORDER BY is_directory DESC, name ASC",
    )?;
    let rows = stmt.query_map(params![parent_dir], row_to_file_info)?;
    let mut results = Vec::new();
    for row in rows {
        results.push(row?);
    }
    Ok(results)
}

pub fn search_fts(conn: &Connection, query: &str) -> Result<Vec<SearchHit>, NoctoError> {
    let mut stmt = conn.prepare(
        "SELECT path, title, snippet(files_fts, 2, '<mark>', '</mark>', '...', 32) AS snippet, rank
         FROM files_fts WHERE files_fts MATCH ?1 ORDER BY rank LIMIT 50",
    )?;
    let rows = stmt.query_map(params![query], |row| {
        let rank: f64 = row.get("rank")?;
        Ok(SearchHit {
            path: row.get("path")?,
            title: row.get("title")?,
            snippet: row.get("snippet")?,
            score: -rank, // FTS5 rank is negative; negate for a positive relevance score
        })
    })?;
    let mut results = Vec::new();
    for row in rows {
        results.push(row?);
    }
    Ok(results)
}

pub fn get_recent(conn: &Connection, limit: u32) -> Result<Vec<FileInfo>, NoctoError> {
    let mut stmt = conn.prepare(
        "SELECT f.path, f.parent_dir, f.name, f.extension, f.title, f.size,
                f.modified_at, f.content_hash, f.is_directory
         FROM recents r
         JOIN files f ON f.path = r.path
         ORDER BY r.accessed_at DESC
         LIMIT ?1",
    )?;
    let rows = stmt.query_map(params![limit], row_to_file_info)?;
    let mut results = Vec::new();
    for row in rows {
        results.push(row?);
    }
    Ok(results)
}

pub fn get_pinned(conn: &Connection) -> Result<Vec<FileInfo>, NoctoError> {
    let mut stmt = conn.prepare(
        "SELECT f.path, f.parent_dir, f.name, f.extension, f.title, f.size,
                f.modified_at, f.content_hash, f.is_directory
         FROM pinned p
         JOIN files f ON f.path = p.path
         ORDER BY p.pinned_at ASC",
    )?;
    let rows = stmt.query_map([], row_to_file_info)?;
    let mut results = Vec::new();
    for row in rows {
        results.push(row?);
    }
    Ok(results)
}

pub fn load_state(conn: &Connection, key: &str) -> Result<Option<String>, NoctoError> {
    let result = conn.query_row(
        "SELECT value FROM state WHERE key = ?1",
        params![key],
        |row| row.get(0),
    );
    match result {
        Ok(value) => Ok(Some(value)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(NoctoError::DbQueryFailed {
            detail: e.to_string(),
        }),
    }
}

pub fn get_all_files(conn: &Connection) -> Result<Vec<FileInfo>, NoctoError> {
    let mut stmt = conn.prepare(
        "SELECT path, parent_dir, name, extension, title, size, modified_at, content_hash, is_directory
         FROM files ORDER BY path ASC",
    )?;
    let rows = stmt.query_map([], row_to_file_info)?;
    let mut results = Vec::new();
    for row in rows {
        results.push(row?);
    }
    Ok(results)
}
