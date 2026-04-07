use sha2::{Digest, Sha256};
use std::fs;
use std::path::Path;
use tracing::{debug, trace, warn};
use walkdir::WalkDir;

use crate::db::queries::FileInfo;
use crate::errors::NoctoError;
use crate::normalize_path;

/// Maximum file size for content hashing (10 MB).
const MAX_HASH_SIZE: u64 = 10 * 1024 * 1024;

/// Walk the entire Core directory tree and build a flat list of `FileInfo`
/// entries. Skips the `.noctodeus/` metadata directory.
pub fn scan_directory(core_path: &Path) -> Result<Vec<FileInfo>, NoctoError> {
    let mut files = Vec::new();
    let core_path_str = core_path
        .to_str()
        .ok_or_else(|| NoctoError::Unexpected {
            detail: "core path is not valid UTF-8".into(),
        })?;

    debug!(path = core_path_str, "starting full directory scan");

    for entry in WalkDir::new(core_path)
        .follow_links(false)
        .into_iter()
        .filter_entry(|e| !is_noctodeus_dir(e))
    {
        let entry = entry?;
        let entry_path = entry.path();

        // Skip the root directory itself.
        if entry_path == core_path {
            continue;
        }

        let rel_path = normalize_path(&entry_path
            .strip_prefix(core_path)
            .unwrap_or(entry_path)
            .to_string_lossy());

        let parent_dir = entry_path
            .parent()
            .map(|p| {
                normalize_path(&p.strip_prefix(core_path)
                    .unwrap_or(p)
                    .to_string_lossy())
            })
            .unwrap_or_default();

        // Use "" for files at the root of the Core.
        let parent_dir = if parent_dir.is_empty() {
            ".".to_string()
        } else {
            parent_dir
        };

        let name = entry
            .file_name()
            .to_string_lossy()
            .to_string();

        let is_dir = entry.file_type().is_dir();

        let metadata = entry.metadata().map_err(|e| NoctoError::Unexpected {
            detail: format!("failed to read metadata for {}: {}", rel_path, e),
        })?;

        let extension = if is_dir {
            None
        } else {
            entry_path
                .extension()
                .map(|e| e.to_string_lossy().to_string())
        };

        let size = if is_dir { None } else { Some(metadata.len() as i64) };

        let modified_at = metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs() as i64);

        // Extract title and aliases from markdown files.
        let (title, aliases) = if !is_dir && is_markdown(&name) {
            match fs::read_to_string(entry_path) {
                Ok(content) => (extract_title(&content), extract_aliases(&content)),
                Err(e) => {
                    warn!(path = %rel_path, error = %e, "failed to read file for title extraction");
                    (None, Vec::new())
                }
            }
        } else {
            (None, Vec::new())
        };

        // Compute content hash for files within size limit.
        let content_hash = if !is_dir {
            compute_hash(entry_path)
        } else {
            None
        };

        trace!(path = %rel_path, is_dir, "indexed entry");

        files.push(FileInfo {
            path: rel_path,
            parent_dir,
            name,
            extension,
            title,
            size,
            modified_at,
            content_hash,
            is_directory: is_dir,
            aliases,
        });
    }

    debug!(count = files.len(), "directory scan complete");
    Ok(files)
}

/// Build a `FileInfo` for a single file given its absolute path and the
/// Core root. Used by the incremental indexer when processing individual
/// file change events.
pub fn scan_single_file(core_path: &Path, abs_path: &Path) -> Result<FileInfo, NoctoError> {
    let rel_path = normalize_path(&abs_path
        .strip_prefix(core_path)
        .unwrap_or(abs_path)
        .to_string_lossy());

    let parent_dir = abs_path
        .parent()
        .map(|p| {
            let rel = normalize_path(&p
                .strip_prefix(core_path)
                .unwrap_or(p)
                .to_string_lossy());
            if rel.is_empty() { ".".to_string() } else { rel }
        })
        .unwrap_or_else(|| ".".to_string());

    let name = abs_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    let metadata = fs::metadata(abs_path)?;
    let is_dir = metadata.is_dir();

    let extension = if is_dir {
        None
    } else {
        abs_path.extension().map(|e| e.to_string_lossy().to_string())
    };

    let size = if is_dir { None } else { Some(metadata.len() as i64) };

    let modified_at = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs() as i64);

    let (title, aliases) = if !is_dir && is_markdown(&name) {
        match fs::read_to_string(abs_path) {
            Ok(content) => (extract_title(&content), extract_aliases(&content)),
            Err(_) => (None, Vec::new()),
        }
    } else {
        (None, Vec::new())
    };

    let content_hash = if !is_dir {
        compute_hash(abs_path)
    } else {
        None
    };

    Ok(FileInfo {
        path: rel_path,
        parent_dir,
        name,
        extension,
        title,
        size,
        modified_at,
        content_hash,
        is_directory: is_dir,
        aliases,
    })
}

/// Extract a title from markdown content.
///
/// Tries in order:
/// 1. YAML frontmatter: `---\ntitle: ...\n---`
/// 2. First ATX heading: `# Title`
///
/// Returns `None` if neither is found.
pub fn extract_title(content: &str) -> Option<String> {
    // Try YAML frontmatter first.
    if let Some(title) = extract_frontmatter_title(content) {
        return Some(title);
    }

    // Try first ATX heading.
    extract_first_heading(content)
}

/// Parse YAML frontmatter for a `title` field.
///
/// Expects frontmatter delimited by `---` on its own line at the start
/// of the file.
fn extract_frontmatter_title(content: &str) -> Option<String> {
    let trimmed = content.trim_start();
    if !trimmed.starts_with("---") {
        return None;
    }

    // Find the closing `---`.
    let after_opening = &trimmed[3..];
    let closing_pos = after_opening.find("\n---")?;
    let frontmatter = &after_opening[..closing_pos];

    // Simple line-by-line parse for `title:` (avoids pulling in a full YAML parser).
    for line in frontmatter.lines() {
        let line = line.trim();
        if let Some(rest) = line.strip_prefix("title:") {
            let value = rest.trim();
            // Strip surrounding quotes if present.
            let value = value
                .strip_prefix('"')
                .and_then(|v| v.strip_suffix('"'))
                .or_else(|| value.strip_prefix('\'').and_then(|v| v.strip_suffix('\'')))
                .unwrap_or(value);
            if !value.is_empty() {
                return Some(value.to_string());
            }
        }
    }

    None
}

/// Find the first ATX heading (`# Title`) in the content.
fn extract_first_heading(content: &str) -> Option<String> {
    for line in content.lines() {
        let trimmed = line.trim();
        if let Some(rest) = trimmed.strip_prefix('#') {
            // Must be followed by a space (ATX heading rule).
            // Also handle ##, ###, etc. -- we only want the text after
            // the last `#` and the space.
            let rest = rest.trim_start_matches('#');
            if let Some(title) = rest.strip_prefix(' ') {
                let title = title.trim();
                if !title.is_empty() {
                    return Some(title.to_string());
                }
            }
        }
    }
    None
}

/// Extract aliases from YAML frontmatter (`aliases: [a, b, c]`).
pub fn extract_aliases(content: &str) -> Vec<String> {
    let trimmed = content.trim_start();
    if !trimmed.starts_with("---") {
        return Vec::new();
    }
    let after_opening = &trimmed[3..];
    let closing_pos = match after_opening.find("\n---") {
        Some(p) => p,
        None => return Vec::new(),
    };
    let frontmatter = &after_opening[..closing_pos];

    for line in frontmatter.lines() {
        let line = line.trim();
        if let Some(rest) = line.strip_prefix("aliases:") {
            let rest = rest.trim();
            if rest.starts_with('[') && rest.ends_with(']') {
                return rest[1..rest.len() - 1]
                    .split(',')
                    .map(|s| {
                        let s = s.trim();
                        s.strip_prefix('"')
                            .and_then(|v| v.strip_suffix('"'))
                            .or_else(|| s.strip_prefix('\'').and_then(|v| v.strip_suffix('\'')))
                            .unwrap_or(s)
                            .to_string()
                    })
                    .filter(|s| !s.is_empty())
                    .collect();
            }
        }
    }
    Vec::new()
}

/// Compute SHA-256 hash of a byte slice, returned as hex string.
pub fn hash_bytes(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    hex::encode(hasher.finalize())
}

/// Compute SHA-256 hash of a file's content, hex-encoded.
/// Returns `None` for files larger than `MAX_HASH_SIZE` or on read errors.
fn compute_hash(path: &Path) -> Option<String> {
    let metadata = fs::metadata(path).ok()?;
    if metadata.len() > MAX_HASH_SIZE {
        trace!(path = %path.display(), size = metadata.len(), "skipping hash for large file");
        return None;
    }

    let content = fs::read(path).ok()?;
    let mut hasher = Sha256::new();
    hasher.update(&content);
    let hash = hasher.finalize();
    Some(hex::encode(hash))
}

use crate::indexer::util::is_markdown;

/// Filter predicate for `WalkDir`: skip `.noctodeus/` directories.
fn is_noctodeus_dir(entry: &walkdir::DirEntry) -> bool {
    entry.file_type().is_dir() && entry.file_name() == ".noctodeus"
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_extract_frontmatter_title() {
        let content = "---\ntitle: My Note\ndate: 2026-01-01\n---\n\n# Heading\n\nBody text.";
        assert_eq!(extract_title(content), Some("My Note".into()));
    }

    #[test]
    fn test_extract_frontmatter_title_quoted() {
        let content = "---\ntitle: \"Quoted Title\"\n---\n\nBody.";
        assert_eq!(extract_title(content), Some("Quoted Title".into()));
    }

    #[test]
    fn test_extract_frontmatter_title_single_quoted() {
        let content = "---\ntitle: 'Single Quoted'\n---\n\nBody.";
        assert_eq!(extract_title(content), Some("Single Quoted".into()));
    }

    #[test]
    fn test_extract_heading_no_frontmatter() {
        let content = "# Hello World\n\nSome text.";
        assert_eq!(extract_title(content), Some("Hello World".into()));
    }

    #[test]
    fn test_extract_heading_h2() {
        let content = "## Second Level\n\nText.";
        assert_eq!(extract_title(content), Some("Second Level".into()));
    }

    #[test]
    fn test_extract_no_title() {
        let content = "Just some plain text without any heading or frontmatter.";
        assert_eq!(extract_title(content), None);
    }

    #[test]
    fn test_extract_empty_content() {
        assert_eq!(extract_title(""), None);
    }

    #[test]
    fn test_frontmatter_takes_precedence_over_heading() {
        let content = "---\ntitle: From Frontmatter\n---\n\n# From Heading\n\nBody.";
        assert_eq!(extract_title(content), Some("From Frontmatter".into()));
    }

    #[test]
    fn test_is_markdown() {
        assert!(is_markdown("note.md"));
        assert!(is_markdown("README.MD"));
        assert!(is_markdown("doc.markdown"));
        assert!(is_markdown("page.mdx"));
        assert!(!is_markdown("image.png"));
        assert!(!is_markdown("script.js"));
    }

    #[test]
    fn test_scan_directory_skips_noctodeus() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();

        // Create a normal file.
        fs::write(root.join("note.md"), "# Test Note\n\nContent.").unwrap();

        // Create .noctodeus directory with a file inside.
        let noctodeus = root.join(".noctodeus");
        fs::create_dir_all(&noctodeus).unwrap();
        fs::write(noctodeus.join("meta.db"), "fake db").unwrap();

        // Create a subdirectory with a file.
        let subdir = root.join("folder");
        fs::create_dir_all(&subdir).unwrap();
        fs::write(subdir.join("nested.md"), "# Nested\n\nMore content.").unwrap();

        let files = scan_directory(root).unwrap();

        // Should have: note.md, folder/, folder/nested.md -- NOT .noctodeus/
        let paths: Vec<&str> = files.iter().map(|f| f.path.as_str()).collect();
        assert!(paths.contains(&"note.md"));
        assert!(paths.contains(&"folder"));
        assert!(paths.contains(&"folder/nested.md"));
        assert!(!paths.iter().any(|p| p.contains(".noctodeus")));
    }

    #[test]
    fn test_scan_extracts_title() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();

        fs::write(
            root.join("with-frontmatter.md"),
            "---\ntitle: My Title\n---\n\nBody.",
        )
        .unwrap();

        let files = scan_directory(root).unwrap();
        let file = files.iter().find(|f| f.name == "with-frontmatter.md").unwrap();
        assert_eq!(file.title, Some("My Title".into()));
    }

    #[test]
    fn test_scan_computes_hash() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();

        fs::write(root.join("test.txt"), "hello").unwrap();

        let files = scan_directory(root).unwrap();
        let file = files.iter().find(|f| f.name == "test.txt").unwrap();
        assert!(file.content_hash.is_some());
        // SHA-256 of "hello" is well-known.
        assert_eq!(
            file.content_hash.as_deref().unwrap(),
            "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
        );
    }
}
