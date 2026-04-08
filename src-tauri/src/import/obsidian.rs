use std::fs;
use std::io::Read;
use std::path::Path;

use serde::Serialize;
use walkdir::WalkDir;

use crate::errors::NoctoError;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultScan {
    pub path: String,
    pub name: String,
    pub markdown_count: u32,
    pub media_count: u32,
    pub folder_count: u32,
    pub other_count: u32,
    pub total_size_bytes: u64,
    pub has_wiki_links: bool,
    pub has_frontmatter: bool,
    pub sample_files: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportProgress {
    pub current: u32,
    pub total: u32,
    pub current_file: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub files_imported: u32,
    pub folders_created: u32,
    pub skipped: u32,
    pub total_size_bytes: u64,
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SKIP_DIRS: &[&str] = &[".obsidian", ".trash", ".git"];
const SKIP_FILES: &[&str] = &[".DS_Store", "Thumbs.db", "desktop.ini"];

const MARKDOWN_EXTENSIONS: &[&str] = &["md", "markdown", "mdx"];
const MEDIA_EXTENSIONS: &[&str] = &[
    "png", "jpg", "jpeg", "gif", "svg", "webp", "mp4", "mp3", "wav", "pdf",
];

/// Max number of markdown files to inspect for wiki-links / frontmatter.
const CONTENT_SCAN_LIMIT: usize = 10;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn extension_lower(path: &Path) -> Option<String> {
    path.extension()
        .map(|e| e.to_string_lossy().to_ascii_lowercase())
}

fn is_markdown_ext(ext: &str) -> bool {
    MARKDOWN_EXTENSIONS.contains(&ext)
}

fn is_media_ext(ext: &str) -> bool {
    MEDIA_EXTENSIONS.contains(&ext)
}

/// Returns true if the entry should be skipped during import.
fn should_skip_entry(entry: &walkdir::DirEntry) -> bool {
    let name = entry.file_name().to_string_lossy();

    if entry.file_type().is_dir() {
        // Skip known directories and hidden directories (starting with .)
        if SKIP_DIRS.contains(&name.as_ref()) {
            return true;
        }
        if name.starts_with('.') {
            return true;
        }
        return false;
    }

    // Skip known junk files
    if SKIP_FILES.contains(&name.as_ref()) {
        return true;
    }

    false
}

/// Returns true if the entry should be filtered OUT of walkdir traversal
/// (i.e., don't descend into this directory at all).
fn filter_entry(entry: &walkdir::DirEntry) -> bool {
    // Always keep the root entry (depth 0) — even if the temp dir name
    // happens to start with '.'.
    if entry.depth() == 0 {
        return true;
    }
    let name = entry.file_name().to_string_lossy();
    if entry.file_type().is_dir() {
        if SKIP_DIRS.contains(&name.as_ref()) {
            return false; // don't descend
        }
        if name.starts_with('.') {
            return false; // don't descend into hidden dirs
        }
    }
    true // keep
}

// ---------------------------------------------------------------------------
// scan_vault
// ---------------------------------------------------------------------------

/// Walk an Obsidian vault directory and return a summary of its contents.
pub fn scan_vault(vault_path: &Path) -> Result<VaultScan, NoctoError> {
    if !vault_path.is_dir() {
        return Err(NoctoError::FileNotFound {
            path: vault_path.display().to_string(),
        });
    }

    let vault_name = vault_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "Unnamed Vault".to_string());

    let mut markdown_count: u32 = 0;
    let mut media_count: u32 = 0;
    let mut folder_count: u32 = 0;
    let mut other_count: u32 = 0;
    let mut total_size_bytes: u64 = 0;
    let mut has_wiki_links = false;
    let mut has_frontmatter = false;
    let mut sample_files: Vec<String> = Vec::new();
    let mut markdown_paths_to_scan: Vec<std::path::PathBuf> = Vec::new();

    for entry in WalkDir::new(vault_path)
        .follow_links(false)
        .into_iter()
        .filter_entry(filter_entry)
    {
        let entry = entry?;
        let entry_path = entry.path();

        // Skip the root itself.
        if entry_path == vault_path {
            continue;
        }

        if entry.file_type().is_dir() {
            folder_count += 1;
            continue;
        }

        // Skip junk files (same set as import).
        let file_name = entry.file_name().to_string_lossy();
        if SKIP_FILES.contains(&file_name.as_ref()) {
            continue;
        }

        // It's a file — get metadata for size.
        if let Ok(meta) = entry.metadata() {
            total_size_bytes += meta.len();
        }

        let rel_path = entry_path
            .strip_prefix(vault_path)
            .unwrap_or(entry_path)
            .to_string_lossy()
            .to_string();

        // Categorise by extension.
        if let Some(ext) = extension_lower(entry_path) {
            if is_markdown_ext(&ext) {
                markdown_count += 1;
                if sample_files.len() < 5 {
                    sample_files.push(rel_path);
                }
                if markdown_paths_to_scan.len() < CONTENT_SCAN_LIMIT {
                    markdown_paths_to_scan.push(entry_path.to_path_buf());
                }
            } else if is_media_ext(&ext) {
                media_count += 1;
            } else {
                other_count += 1;
            }
        } else {
            other_count += 1;
        }
    }

    // Quick-scan a limited number of markdown files for wiki-links and frontmatter.
    for md_path in &markdown_paths_to_scan {
        if has_wiki_links && has_frontmatter {
            break; // already found both
        }
        if let Ok(content) = read_head(md_path, 4096) {
            if !has_wiki_links && content.contains("[[") {
                has_wiki_links = true;
            }
            if !has_frontmatter && content.trim_start().starts_with("---") {
                has_frontmatter = true;
            }
        }
    }

    Ok(VaultScan {
        path: vault_path.display().to_string(),
        name: vault_name,
        markdown_count,
        media_count,
        folder_count,
        other_count,
        total_size_bytes,
        has_wiki_links,
        has_frontmatter,
        sample_files,
    })
}

/// Read at most `limit` bytes from the beginning of a file as a UTF-8 string.
fn read_head(path: &Path, limit: usize) -> Result<String, std::io::Error> {
    let mut file = fs::File::open(path)?;
    let mut buf = vec![0u8; limit];
    let n = file.read(&mut buf)?;
    buf.truncate(n);
    Ok(String::from_utf8_lossy(&buf).to_string())
}

// ---------------------------------------------------------------------------
// import_vault
// ---------------------------------------------------------------------------

/// Copy files from an Obsidian vault into a Noctodeus core directory.
///
/// Preserves the folder structure. Skips `.obsidian/`, `.trash/`, `.git/`,
/// hidden directories, and common junk files. Uses atomic writes (write to
/// `.tmp` then rename) to avoid partial copies.
///
/// The `on_progress` callback is invoked for each file copied.
pub fn import_vault(
    vault_path: &Path,
    target_core_path: &Path,
    on_progress: impl Fn(ImportProgress),
) -> Result<ImportResult, NoctoError> {
    if !vault_path.is_dir() {
        return Err(NoctoError::FileNotFound {
            path: vault_path.display().to_string(),
        });
    }

    // First pass: collect all files to import so we know the total count.
    let mut files_to_copy: Vec<(std::path::PathBuf, std::path::PathBuf)> = Vec::new();
    let mut dirs_to_create: Vec<std::path::PathBuf> = Vec::new();
    let mut skipped: u32 = 0;

    for entry in WalkDir::new(vault_path)
        .follow_links(false)
        .into_iter()
        .filter_entry(filter_entry)
    {
        let entry = entry?;
        let entry_path = entry.path();

        if entry_path == vault_path {
            continue;
        }

        let rel = entry_path
            .strip_prefix(vault_path)
            .unwrap_or(entry_path);
        let target = target_core_path.join(rel);

        if entry.file_type().is_dir() {
            dirs_to_create.push(target);
            continue;
        }

        // Skip junk files.
        if should_skip_entry(&entry) {
            skipped += 1;
            continue;
        }

        files_to_copy.push((entry_path.to_path_buf(), target));
    }

    // Create all directories first.
    let mut folders_created: u32 = 0;
    for dir in &dirs_to_create {
        if !dir.exists() {
            fs::create_dir_all(dir)?;
            folders_created += 1;
        }
    }

    // Copy files with atomic write.
    let total = files_to_copy.len() as u32;
    let mut files_imported: u32 = 0;
    let mut total_size_bytes: u64 = 0;

    for (i, (src, dst)) in files_to_copy.iter().enumerate() {
        let rel_display = src
            .strip_prefix(vault_path)
            .unwrap_or(src)
            .to_string_lossy()
            .to_string();

        on_progress(ImportProgress {
            current: (i as u32) + 1,
            total,
            current_file: rel_display,
        });

        // Ensure parent directory exists (in case walkdir ordering produced
        // a file before its parent in some edge case).
        if let Some(parent) = dst.parent() {
            if !parent.exists() {
                fs::create_dir_all(parent)?;
            }
        }

        // Atomic copy: write to .tmp, then rename.
        let tmp_path = dst.with_extension(
            format!(
                "{}.tmp",
                dst.extension()
                    .map(|e| e.to_string_lossy().to_string())
                    .unwrap_or_default()
            ),
        );

        fs::copy(src, &tmp_path)?;
        fs::rename(&tmp_path, dst)?;

        if let Ok(meta) = fs::metadata(dst) {
            total_size_bytes += meta.len();
        }
        files_imported += 1;
    }

    Ok(ImportResult {
        files_imported,
        folders_created,
        skipped,
        total_size_bytes,
    })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    /// Build a mock Obsidian vault structure inside a tempdir.
    fn create_mock_vault(root: &Path) {
        // .obsidian directory (should be skipped)
        let obsidian_dir = root.join(".obsidian");
        fs::create_dir_all(&obsidian_dir).unwrap();
        fs::write(obsidian_dir.join("app.json"), "{}").unwrap();

        // .trash directory (should be skipped)
        let trash_dir = root.join(".trash");
        fs::create_dir_all(&trash_dir).unwrap();
        fs::write(trash_dir.join("deleted.md"), "# Deleted").unwrap();

        // .git directory (should be skipped)
        let git_dir = root.join(".git");
        fs::create_dir_all(&git_dir).unwrap();
        fs::write(git_dir.join("HEAD"), "ref: refs/heads/main").unwrap();

        // Regular markdown files
        fs::write(
            root.join("note1.md"),
            "---\ntitle: First Note\n---\n\nSome content with [[wiki link]].",
        )
        .unwrap();
        fs::write(root.join("note2.md"), "# Second Note\n\nPlain note.").unwrap();
        fs::write(root.join("note3.markdown"), "# Third Note").unwrap();

        // Subfolder with notes
        let subfolder = root.join("projects");
        fs::create_dir_all(&subfolder).unwrap();
        fs::write(subfolder.join("project-a.md"), "# Project A").unwrap();
        fs::write(subfolder.join("project-b.md"), "# Project B").unwrap();

        // Media files
        let attachments = root.join("attachments");
        fs::create_dir_all(&attachments).unwrap();
        fs::write(attachments.join("image.png"), "fake png bytes").unwrap();
        fs::write(attachments.join("diagram.svg"), "<svg></svg>").unwrap();
        fs::write(attachments.join("doc.pdf"), "fake pdf bytes").unwrap();

        // Other files
        fs::write(root.join("data.csv"), "a,b,c").unwrap();

        // Junk files (should be skipped during import)
        fs::write(root.join(".DS_Store"), "junk").unwrap();
    }

    #[test]
    fn test_scan_vault_counts() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        create_mock_vault(root);

        let scan = scan_vault(root).unwrap();

        assert_eq!(scan.markdown_count, 5); // note1.md, note2.md, note3.markdown, project-a.md, project-b.md
        assert_eq!(scan.media_count, 3); // image.png, diagram.svg, doc.pdf
        assert_eq!(scan.folder_count, 2); // projects, attachments
        assert_eq!(scan.other_count, 1); // data.csv
        assert!(scan.total_size_bytes > 0);
        assert_eq!(scan.name, root.file_name().unwrap().to_string_lossy());
    }

    #[test]
    fn test_scan_vault_detects_wiki_links() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        create_mock_vault(root);

        let scan = scan_vault(root).unwrap();
        assert!(scan.has_wiki_links);
    }

    #[test]
    fn test_scan_vault_detects_frontmatter() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        create_mock_vault(root);

        let scan = scan_vault(root).unwrap();
        assert!(scan.has_frontmatter);
    }

    #[test]
    fn test_scan_vault_sample_files() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        create_mock_vault(root);

        let scan = scan_vault(root).unwrap();
        assert!(scan.sample_files.len() <= 5);
        assert!(!scan.sample_files.is_empty());
        // All samples should be markdown
        for sample in &scan.sample_files {
            let lower = sample.to_ascii_lowercase();
            assert!(
                lower.ends_with(".md") || lower.ends_with(".markdown") || lower.ends_with(".mdx"),
                "sample file is not markdown: {}",
                sample,
            );
        }
    }

    #[test]
    fn test_scan_vault_skips_hidden_dirs() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        create_mock_vault(root);

        let scan = scan_vault(root).unwrap();
        // .obsidian, .trash, .git should not be counted as folders
        // Only projects and attachments should count
        assert_eq!(scan.folder_count, 2);
    }

    #[test]
    fn test_scan_vault_nonexistent_path() {
        let result = scan_vault(Path::new("/nonexistent/path/to/vault"));
        assert!(result.is_err());
    }

    #[test]
    fn test_import_vault_copies_files() {
        let vault_dir = tempdir().unwrap();
        let target_dir = tempdir().unwrap();
        create_mock_vault(vault_dir.path());

        let result = import_vault(vault_dir.path(), target_dir.path(), |_progress| {}).unwrap();

        // Should import all non-skipped files
        assert!(result.files_imported > 0);
        assert!(result.total_size_bytes > 0);

        // Verify key files exist in target
        assert!(target_dir.path().join("note1.md").exists());
        assert!(target_dir.path().join("note2.md").exists());
        assert!(target_dir.path().join("projects").join("project-a.md").exists());
        assert!(target_dir.path().join("attachments").join("image.png").exists());

        // Verify skipped directories are NOT present
        assert!(!target_dir.path().join(".obsidian").exists());
        assert!(!target_dir.path().join(".trash").exists());
        assert!(!target_dir.path().join(".git").exists());

        // .DS_Store should be skipped
        assert!(!target_dir.path().join(".DS_Store").exists());
    }

    #[test]
    fn test_import_vault_preserves_content() {
        let vault_dir = tempdir().unwrap();
        let target_dir = tempdir().unwrap();
        create_mock_vault(vault_dir.path());

        import_vault(vault_dir.path(), target_dir.path(), |_| {}).unwrap();

        let original = fs::read_to_string(vault_dir.path().join("note1.md")).unwrap();
        let imported = fs::read_to_string(target_dir.path().join("note1.md")).unwrap();
        assert_eq!(original, imported);
    }

    #[test]
    fn test_import_vault_reports_progress() {
        let vault_dir = tempdir().unwrap();
        let target_dir = tempdir().unwrap();
        create_mock_vault(vault_dir.path());

        let progress_calls = std::sync::Arc::new(std::sync::atomic::AtomicU32::new(0));
        let counter = progress_calls.clone();

        import_vault(vault_dir.path(), target_dir.path(), move |_p| {
            counter.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        })
        .unwrap();

        assert!(progress_calls.load(std::sync::atomic::Ordering::Relaxed) > 0);
    }

    #[test]
    fn test_import_vault_skipped_count() {
        let vault_dir = tempdir().unwrap();
        let target_dir = tempdir().unwrap();
        create_mock_vault(vault_dir.path());

        let result = import_vault(vault_dir.path(), target_dir.path(), |_| {}).unwrap();

        // .DS_Store should be counted as skipped
        assert!(result.skipped >= 1);
    }
}
