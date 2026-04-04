use rusqlite::{params, Connection};
use std::fs;
use std::path::Path;
use tracing::{debug, warn};

use crate::errors::NoctoError;

/// Rebuild the entire FTS index from scratch.
///
/// Clears the `files_fts` table, then for every markdown file in the
/// `files` table reads its content from disk and inserts into FTS.
pub fn rebuild_fts(conn: &Connection, core_path: &Path) -> Result<(), NoctoError> {
    debug!("rebuilding FTS index");

    // Clear existing FTS entries.
    conn.execute("DELETE FROM files_fts", [])?;

    // Select all markdown files from the files table.
    let mut stmt = conn.prepare(
        "SELECT path, title FROM files
         WHERE is_directory = 0
         AND (extension = 'md' OR extension = 'markdown' OR extension = 'mdx')",
    )?;

    let entries: Vec<(String, Option<String>)> = stmt
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, Option<String>>(1)?))
        })?
        .filter_map(|r| r.ok())
        .collect();

    let mut indexed = 0;

    for (rel_path, title) in &entries {
        let abs_path = core_path.join(rel_path);
        match fs::read_to_string(&abs_path) {
            Ok(content) => {
                conn.execute(
                    "INSERT INTO files_fts (path, title, content) VALUES (?1, ?2, ?3)",
                    params![rel_path, title, content],
                )?;
                indexed += 1;
            }
            Err(e) => {
                warn!(path = %rel_path, error = %e, "failed to read file for FTS indexing");
            }
        }
    }

    debug!(total = entries.len(), indexed, "FTS rebuild complete");
    Ok(())
}

/// Update (or insert) a single FTS entry.
///
/// Deletes any existing entry for the path first, then inserts the new one.
/// This is required because the FTS table uses `content=''` (contentless),
/// meaning updates must be done as delete + insert.
pub fn update_fts_entry(
    conn: &Connection,
    path: &str,
    title: Option<&str>,
    content: &str,
) -> Result<(), NoctoError> {
    // Remove existing entry if present.
    conn.execute("DELETE FROM files_fts WHERE path = ?1", params![path])?;

    // Insert new entry.
    conn.execute(
        "INSERT INTO files_fts (path, title, content) VALUES (?1, ?2, ?3)",
        params![path, title, content],
    )?;

    Ok(())
}

/// Remove a single entry from the FTS index.
pub fn remove_fts_entry(conn: &Connection, path: &str) -> Result<(), NoctoError> {
    conn.execute("DELETE FROM files_fts WHERE path = ?1", params![path])?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::schema::run_migrations;
    use rusqlite::Connection;
    use std::fs;

    fn setup_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        run_migrations(&conn).unwrap();
        conn
    }

    #[test]
    fn test_update_and_remove_fts_entry() {
        let conn = setup_db();

        // Insert an entry.
        update_fts_entry(&conn, "notes/hello.md", Some("Hello"), "Hello world content").unwrap();

        // Verify it exists via a search.
        let count: i64 = conn
            .query_row(
                "SELECT count(*) FROM files_fts WHERE files_fts MATCH 'hello'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);

        // Update the entry with new content.
        update_fts_entry(&conn, "notes/hello.md", Some("Hello Updated"), "Updated content").unwrap();

        // Should still find the updated content (not duplicated).
        let count: i64 = conn
            .query_row(
                "SELECT count(*) FROM files_fts WHERE files_fts MATCH 'updated'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);

        // Old content should no longer be findable.
        let count: i64 = conn
            .query_row(
                "SELECT count(*) FROM files_fts WHERE files_fts MATCH '\"hello world content\"'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 0);

        // Remove the entry.
        remove_fts_entry(&conn, "notes/hello.md").unwrap();

        // After removal, nothing should match.
        let count: i64 = conn
            .query_row(
                "SELECT count(*) FROM files_fts WHERE files_fts MATCH 'updated'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn test_rebuild_fts() {
        let conn = setup_db();
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();

        // Write two markdown files.
        fs::write(root.join("first.md"), "# First\n\nFirst note content.").unwrap();
        fs::write(root.join("second.md"), "# Second\n\nSecond note content.").unwrap();
        // Write a non-markdown file (should be skipped in FTS).
        fs::write(root.join("data.json"), "{\"key\": \"value\"}").unwrap();

        // Insert file records into the files table.
        conn.execute(
            "INSERT INTO files (path, parent_dir, name, extension, title, size, modified_at, is_directory)
             VALUES ('first.md', '.', 'first.md', 'md', 'First', 100, 1000, 0)",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO files (path, parent_dir, name, extension, title, size, modified_at, is_directory)
             VALUES ('second.md', '.', 'second.md', 'md', 'Second', 100, 1000, 0)",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO files (path, parent_dir, name, extension, title, size, modified_at, is_directory)
             VALUES ('data.json', '.', 'data.json', 'json', NULL, 50, 1000, 0)",
            [],
        ).unwrap();

        // Rebuild FTS.
        rebuild_fts(&conn, root).unwrap();

        // Should find entries for markdown files.
        let count: i64 = conn
            .query_row("SELECT count(*) FROM files_fts", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 2);

        // Searching for "first" should find one result.
        let count: i64 = conn
            .query_row(
                "SELECT count(*) FROM files_fts WHERE files_fts MATCH 'first'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
    }
}
