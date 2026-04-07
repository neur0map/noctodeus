use rusqlite::{params, Connection};

use crate::errors::NoctoError;

/// A single directed link from one note to another.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Link {
    pub source_path: String,
    pub target_path: String,
}

/// Graph statistics computed from the links table.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkStats {
    pub total_links: i64,
    pub avg_links_per_note: f64,
    pub most_connected: Vec<ConnectedNote>,
    pub orphan_count: i64,
    pub orphan_paths: Vec<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectedNote {
    pub path: String,
    pub title: Option<String>,
    pub count: i64,
}

// ── Wiki-link extraction ──────────────────────────────────────────────

/// Extract wiki-link targets from content.
/// Handles [[target]] and [[target|display text]] syntax.
fn extract_wiki_links(content: &str) -> Vec<String> {
    let mut links = Vec::new();
    let mut rest = content;

    while let Some(start) = rest.find("[[") {
        let after_open = &rest[start + 2..];
        if let Some(end) = after_open.find("]]") {
            let inner = &after_open[..end];
            // Take the part before '|' (display text separator).
            let target = inner.split('|').next().unwrap_or("").trim();
            if !target.is_empty() {
                links.push(target.to_string());
            }
            rest = &after_open[end + 2..];
        } else {
            break;
        }
    }

    links
}

// ── Mutations ─────────────────────────────────────────────────────────

/// Replace all outgoing links for a given source file.
/// Deletes existing links from this source, then inserts the new set.
pub fn replace_links_for_source(
    conn: &Connection,
    source_path: &str,
    content: &str,
    all_file_names: &[(&str, &str)], // (path, name_without_extension)
) -> Result<(), NoctoError> {
    conn.execute(
        "DELETE FROM links WHERE source_path = ?1",
        params![source_path],
    )?;

    let targets = extract_wiki_links(content);

    let mut stmt = conn.prepare(
        "INSERT OR IGNORE INTO links (source_path, target_path) VALUES (?1, ?2)",
    )?;

    for target_name in &targets {
        // Match target name against known file names (case-insensitive).
        let target_lower = target_name.to_lowercase();
        if let Some((path, _)) = all_file_names
            .iter()
            .find(|(_, name)| name.to_lowercase() == target_lower)
        {
            stmt.execute(params![source_path, path])?;
        }
    }

    Ok(())
}

/// Remove all links where the given path is source or target.
pub fn delete_links_for_path(conn: &Connection, path: &str) -> Result<(), NoctoError> {
    conn.execute(
        "DELETE FROM links WHERE source_path = ?1",
        params![path],
    )?;
    conn.execute(
        "DELETE FROM links WHERE target_path = ?1",
        params![path],
    )?;
    Ok(())
}

/// Clear the entire links table (used during full re-scan).
pub fn clear_links(conn: &Connection) -> Result<(), NoctoError> {
    conn.execute("DELETE FROM links", [])?;
    Ok(())
}

// ── Queries ───────────────────────────────────────────────────────────

/// Get all links (for graph view).
pub fn get_all_links(conn: &Connection) -> Result<Vec<Link>, NoctoError> {
    let mut stmt = conn.prepare("SELECT source_path, target_path FROM links")?;
    let rows = stmt.query_map([], |row| {
        Ok(Link {
            source_path: row.get(0)?,
            target_path: row.get(1)?,
        })
    })?;
    let mut results = Vec::new();
    for row in rows {
        results.push(row?);
    }
    Ok(results)
}

/// Get backlinks for a specific file (all notes that link TO this path).
pub fn get_backlinks(conn: &Connection, path: &str) -> Result<Vec<Link>, NoctoError> {
    let mut stmt =
        conn.prepare("SELECT source_path, target_path FROM links WHERE target_path = ?1")?;
    let rows = stmt.query_map(params![path], |row| {
        Ok(Link {
            source_path: row.get(0)?,
            target_path: row.get(1)?,
        })
    })?;
    let mut results = Vec::new();
    for row in rows {
        results.push(row?);
    }
    Ok(results)
}

/// Compute graph statistics from the links table.
pub fn get_link_stats(conn: &Connection) -> Result<LinkStats, NoctoError> {
    let total_links: i64 =
        conn.query_row("SELECT count(*) FROM links", [], |row| row.get(0))?;

    let note_count: i64 = conn.query_row(
        "SELECT count(*) FROM files WHERE is_directory = 0 AND (extension = 'md' OR extension = 'markdown' OR extension = 'mdx')",
        [],
        |row| row.get(0),
    )?;

    let avg_links_per_note = if note_count > 0 {
        total_links as f64 / note_count as f64
    } else {
        0.0
    };

    // Most connected: union of outgoing and incoming counts, top 5.
    let mut stmt = conn.prepare(
        "SELECT path, title, count FROM (
            SELECT f.path, f.title,
                   (SELECT count(*) FROM links WHERE source_path = f.path)
                   + (SELECT count(*) FROM links WHERE target_path = f.path) as count
            FROM files f
            WHERE f.is_directory = 0
              AND (f.extension = 'md' OR f.extension = 'markdown' OR f.extension = 'mdx')
        )
        WHERE count > 0
        ORDER BY count DESC
        LIMIT 5",
    )?;
    let most_connected: Vec<ConnectedNote> = stmt
        .query_map([], |row| {
            Ok(ConnectedNote {
                path: row.get(0)?,
                title: row.get(1)?,
                count: row.get(2)?,
            })
        })?
        .filter_map(|r| r.ok())
        .collect();

    // Orphans: notes with zero links (neither source nor target).
    let mut stmt = conn.prepare(
        "SELECT f.path FROM files f
         WHERE f.is_directory = 0
           AND (f.extension = 'md' OR f.extension = 'markdown' OR f.extension = 'mdx')
           AND f.path NOT IN (SELECT source_path FROM links)
           AND f.path NOT IN (SELECT target_path FROM links)",
    )?;
    let orphan_paths: Vec<String> = stmt
        .query_map([], |row| row.get(0))?
        .filter_map(|r| r.ok())
        .collect();

    let orphan_count = orphan_paths.len() as i64;

    Ok(LinkStats {
        total_links,
        avg_links_per_note,
        most_connected,
        orphan_count,
        orphan_paths,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::migrations::run_all_migrations;
    use rusqlite::Connection;

    fn setup_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        run_all_migrations(&conn).unwrap();
        conn
    }

    fn insert_file(conn: &Connection, path: &str, name: &str) {
        conn.execute(
            "INSERT INTO files (path, parent_dir, name, extension, is_directory)
             VALUES (?1, '.', ?2, 'md', 0)",
            params![path, name],
        )
        .unwrap();
    }

    #[test]
    fn test_extract_wiki_links() {
        let content = "Hello [[Note A]] and [[Note B|display]] world [[Orphan]]";
        let links = extract_wiki_links(content);
        assert_eq!(links, vec!["Note A", "Note B", "Orphan"]);
    }

    #[test]
    fn test_extract_wiki_links_empty() {
        assert!(extract_wiki_links("no links here").is_empty());
    }

    #[test]
    fn test_extract_wiki_links_unclosed() {
        let content = "[[valid]] and [[unclosed";
        let links = extract_wiki_links(content);
        assert_eq!(links, vec!["valid"]);
    }

    #[test]
    fn test_replace_and_query_links() {
        let conn = setup_db();
        insert_file(&conn, "a.md", "a.md");
        insert_file(&conn, "b.md", "b.md");
        insert_file(&conn, "c.md", "c.md");

        let all_files = vec![("a.md", "a"), ("b.md", "b"), ("c.md", "c")];

        let content = "Links to [[b]] and [[c]]";
        replace_links_for_source(&conn, "a.md", content, &all_files).unwrap();

        let links = get_all_links(&conn).unwrap();
        assert_eq!(links.len(), 2);

        let backlinks = get_backlinks(&conn, "b.md").unwrap();
        assert_eq!(backlinks.len(), 1);
        assert_eq!(backlinks[0].source_path, "a.md");
    }

    #[test]
    fn test_replace_links_clears_old() {
        let conn = setup_db();
        insert_file(&conn, "a.md", "a.md");
        insert_file(&conn, "b.md", "b.md");
        insert_file(&conn, "c.md", "c.md");

        let all_files = vec![("a.md", "a"), ("b.md", "b"), ("c.md", "c")];

        // First: link to b and c.
        replace_links_for_source(&conn, "a.md", "[[b]] [[c]]", &all_files).unwrap();
        assert_eq!(get_all_links(&conn).unwrap().len(), 2);

        // Second: only link to c now.
        replace_links_for_source(&conn, "a.md", "[[c]]", &all_files).unwrap();
        let links = get_all_links(&conn).unwrap();
        assert_eq!(links.len(), 1);
        assert_eq!(links[0].target_path, "c.md");
    }

    #[test]
    fn test_delete_links_for_path() {
        let conn = setup_db();
        insert_file(&conn, "a.md", "a.md");
        insert_file(&conn, "b.md", "b.md");

        let all_files = vec![("a.md", "a"), ("b.md", "b")];

        replace_links_for_source(&conn, "a.md", "[[b]]", &all_files).unwrap();
        assert_eq!(get_all_links(&conn).unwrap().len(), 1);

        delete_links_for_path(&conn, "b.md").unwrap();
        assert_eq!(get_all_links(&conn).unwrap().len(), 0);
    }

    #[test]
    fn test_link_stats() {
        let conn = setup_db();
        insert_file(&conn, "a.md", "a.md");
        insert_file(&conn, "b.md", "b.md");
        insert_file(&conn, "c.md", "c.md");

        let all_files = vec![("a.md", "a"), ("b.md", "b"), ("c.md", "c")];

        // a -> b, a -> c
        replace_links_for_source(&conn, "a.md", "[[b]] [[c]]", &all_files).unwrap();
        // b -> a
        replace_links_for_source(&conn, "b.md", "[[a]]", &all_files).unwrap();

        let stats = get_link_stats(&conn).unwrap();
        assert_eq!(stats.total_links, 3);
        assert_eq!(stats.orphan_count, 0); // c is a target, so not orphan
        assert!(stats.avg_links_per_note > 0.0);
        assert!(!stats.most_connected.is_empty());
    }
}
