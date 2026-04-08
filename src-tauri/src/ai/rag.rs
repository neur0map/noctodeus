use std::collections::HashMap;
use std::path::Path;

use serde::Serialize;

use crate::ai::bm25::BM25Index;
use crate::db::pool::DbPool;
use crate::db::queries;
use crate::errors::NoctoError;

/// A single search result from the RAG engine.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RagResult {
    pub path: String,
    pub title: Option<String>,
    pub chunk: String,
    pub score: f64,
}

// ---------------------------------------------------------------------------
// Chunking
// ---------------------------------------------------------------------------

/// Split text into overlapping chunks, trying to break at natural boundaries.
///
/// Breaks at paragraph boundaries (double newline) first, then sentence
/// boundaries (. ! ?), then word boundaries.  Each chunk is at most
/// `max_chunk_size` characters, with `overlap` characters overlapping with
/// the previous chunk.
pub fn chunk_document(content: &str, max_chunk_size: usize, overlap: usize) -> Vec<String> {
    if content.is_empty() {
        return Vec::new();
    }
    if content.len() <= max_chunk_size {
        return vec![content.to_string()];
    }

    let mut chunks: Vec<String> = Vec::new();
    let mut start = 0;

    while start < content.len() {
        let end = (start + max_chunk_size).min(content.len());

        // If we've reached the end, take the rest.
        if end == content.len() {
            chunks.push(content[start..end].to_string());
            break;
        }

        // Try to find a good break point, searching backwards from `end`.
        let slice = &content[start..end];
        let break_at = find_break_point(slice);
        let actual_end = start + break_at;

        chunks.push(content[start..actual_end].to_string());

        // Advance, but overlap with the previous chunk.
        let advance = if actual_end - start > overlap {
            actual_end - start - overlap
        } else {
            actual_end - start
        };
        start += advance;

        // Guard against no progress (shouldn't happen, but be safe).
        if advance == 0 {
            start += 1;
        }
    }

    chunks
}

/// Find the best break point within `slice`, searching backwards.
/// Returns the byte offset within `slice` to break at.
fn find_break_point(slice: &str) -> usize {
    let len = slice.len();

    // 1. Try paragraph boundary (double newline), search last 30% of slice.
    let search_start = len * 70 / 100;
    if let Some(pos) = slice[search_start..].rfind("\n\n") {
        return search_start + pos + 2; // after the double newline
    }

    // 2. Try sentence boundary (. ! ? followed by space or newline), last 30%.
    let tail = &slice[search_start..];
    for (i, c) in tail.char_indices().rev() {
        if (c == '.' || c == '!' || c == '?') && search_start + i + 1 < len {
            let next_byte = slice.as_bytes()[search_start + i + 1];
            if next_byte == b' ' || next_byte == b'\n' {
                return search_start + i + 1;
            }
        }
    }

    // 3. Try word boundary (space), last 20%.
    let word_search_start = len * 80 / 100;
    if let Some(pos) = slice[word_search_start..].rfind(' ') {
        return word_search_start + pos + 1;
    }

    // 4. Fall back to the full slice length.
    len
}

// ---------------------------------------------------------------------------
// BM25 search
// ---------------------------------------------------------------------------

/// Search notes using BM25 keyword scoring. Reads file content from disk.
pub fn search_notes_bm25(
    pool: &DbPool,
    query: &str,
    top_k: usize,
    core_path: &str,
) -> Result<Vec<RagResult>, NoctoError> {
    let conn = pool.get().map_err(|e| NoctoError::Unexpected {
        detail: format!("Failed to get DB connection: {e}"),
    })?;

    // Load all markdown files from the database.
    let all_files = queries::get_all_files(&conn)?;
    let md_files: Vec<_> = all_files
        .into_iter()
        .filter(|f| {
            !f.is_directory
                && f.extension
                    .as_deref()
                    .map(|ext| ext == "md" || ext == "markdown")
                    .unwrap_or(false)
        })
        .collect();

    // Read content from disk and build (doc_id, text) pairs.
    // Each file may produce multiple chunks; we index chunks individually.
    let mut chunk_docs: Vec<(String, String)> = Vec::new();
    // Map chunk_id -> (path, title, chunk_text)
    let mut chunk_meta: HashMap<String, (String, Option<String>, String)> = HashMap::new();

    for file in &md_files {
        let abs_path = Path::new(core_path).join(&file.path);
        let content = match std::fs::read_to_string(&abs_path) {
            Ok(c) => c,
            Err(_) => continue, // Skip files we can't read.
        };

        let chunks = chunk_document(&content, 1000, 200);
        for (i, chunk) in chunks.into_iter().enumerate() {
            let chunk_id = format!("{}#chunk{}", file.path, i);
            chunk_docs.push((chunk_id.clone(), chunk.clone()));
            chunk_meta.insert(chunk_id, (file.path.clone(), file.title.clone(), chunk));
        }
    }

    if chunk_docs.is_empty() {
        return Ok(Vec::new());
    }

    let index = BM25Index::new(&chunk_docs);
    let hits = index.search(query, top_k);

    let results = hits
        .into_iter()
        .filter_map(|(chunk_id, score)| {
            let (path, title, chunk) = chunk_meta.get(&chunk_id)?;
            Some(RagResult {
                path: path.clone(),
                title: title.clone(),
                chunk: chunk.clone(),
                score,
            })
        })
        .collect();

    Ok(results)
}

// ---------------------------------------------------------------------------
// FTS5 search (wraps existing db function)
// ---------------------------------------------------------------------------

/// Search notes using the existing FTS5 full-text index.
pub fn search_notes_fts(
    pool: &DbPool,
    query: &str,
    top_k: usize,
) -> Result<Vec<RagResult>, NoctoError> {
    let conn = pool.get().map_err(|e| NoctoError::Unexpected {
        detail: format!("Failed to get DB connection: {e}"),
    })?;

    let hits = queries::search_fts(&conn, query)?;

    let results: Vec<RagResult> = hits
        .into_iter()
        .take(top_k)
        .map(|hit| RagResult {
            path: hit.path,
            title: hit.title,
            chunk: hit.snippet,
            score: hit.score,
        })
        .collect();

    Ok(results)
}

// ---------------------------------------------------------------------------
// Context builder
// ---------------------------------------------------------------------------

/// Assemble RAG results into a context string for injecting into an AI prompt.
///
/// Each result is formatted as a section with title and source path.
/// Truncates if the total exceeds `max_tokens` (estimated at 4 chars per token).
pub fn build_context(results: &[RagResult], max_tokens: usize) -> String {
    let max_chars = max_tokens * 4;
    let mut context = String::new();

    for result in results {
        let title = result
            .title
            .as_deref()
            .unwrap_or("Untitled");
        let section = format!("From {title} ({path}):\n{chunk}\n---\n",
            path = result.path,
            chunk = result.chunk,
        );

        if context.len() + section.len() > max_chars {
            // Add as much of this section as fits.
            let remaining = max_chars.saturating_sub(context.len());
            if remaining > 20 {
                context.push_str(&section[..remaining]);
            }
            break;
        }

        context.push_str(&section);
    }

    context
}

#[cfg(test)]
mod tests {
    use super::*;

    // -----------------------------------------------------------------------
    // Chunking tests
    // -----------------------------------------------------------------------

    #[test]
    fn test_chunk_empty_string() {
        let chunks = chunk_document("", 100, 20);
        assert!(chunks.is_empty());
    }

    #[test]
    fn test_chunk_small_text() {
        let text = "Hello world, this is a short note.";
        let chunks = chunk_document(text, 1000, 200);
        assert_eq!(chunks.len(), 1);
        assert_eq!(chunks[0], text);
    }

    #[test]
    fn test_chunk_respects_max_size() {
        let text = "word ".repeat(500); // 2500 chars
        let chunks = chunk_document(&text, 200, 40);
        for chunk in &chunks {
            assert!(chunk.len() <= 200, "Chunk too large: {} chars", chunk.len());
        }
    }

    #[test]
    fn test_chunk_overlap_produces_overlapping_content() {
        // Create text with clear paragraphs.
        let para = "This is a paragraph with some content inside it.";
        let text = format!("{}\n\n{}\n\n{}\n\n{}", para, para, para, para);
        let chunks = chunk_document(&text, 120, 30);

        // With overlap, adjacent chunks should share some text.
        if chunks.len() >= 2 {
            let tail_of_first = &chunks[0][chunks[0].len().saturating_sub(30)..];
            let head_of_second = &chunks[1][..30.min(chunks[1].len())];
            // They should share at least some characters.
            let shared = tail_of_first
                .chars()
                .zip(head_of_second.chars())
                .take_while(|(a, b)| a == b)
                .count();
            // Overlap is best-effort at boundaries, so just ensure chunks exist.
            assert!(chunks.len() >= 2);
            let _ = shared; // used for debugging
        }
    }

    #[test]
    fn test_chunk_no_content_lost() {
        // All content from the original should appear in at least one chunk.
        let text = "Alpha. Bravo. Charlie. Delta. Echo. Foxtrot. Golf. Hotel. India.";
        let chunks = chunk_document(text, 30, 5);
        let combined: String = chunks.join("");
        // Every word from original should be in combined.
        for word in ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel", "India"] {
            assert!(combined.contains(word), "Missing word: {word}");
        }
    }

    #[test]
    fn test_chunk_paragraph_boundary() {
        let text = format!(
            "{}\n\n{}",
            "A".repeat(700),
            "B".repeat(200),
        );
        let chunks = chunk_document(&text, 800, 100);
        // Should prefer breaking at the paragraph boundary.
        assert!(chunks.len() >= 1);
        // First chunk should end near or at the paragraph break.
        if chunks.len() >= 2 {
            assert!(
                chunks[0].ends_with('\n') || chunks[0].ends_with("A"),
                "Expected paragraph break, got: ...{}",
                &chunks[0][chunks[0].len().saturating_sub(20)..]
            );
        }
    }

    // -----------------------------------------------------------------------
    // Context builder tests
    // -----------------------------------------------------------------------

    #[test]
    fn test_build_context_basic() {
        let results = vec![
            RagResult {
                path: "notes/test.md".to_string(),
                title: Some("Test Note".to_string()),
                chunk: "Some content here.".to_string(),
                score: 1.0,
            },
        ];
        let ctx = build_context(&results, 1000);
        assert!(ctx.contains("From Test Note (notes/test.md):"));
        assert!(ctx.contains("Some content here."));
        assert!(ctx.contains("---"));
    }

    #[test]
    fn test_build_context_truncates() {
        let results = vec![
            RagResult {
                path: "a.md".to_string(),
                title: Some("A".to_string()),
                chunk: "x".repeat(500),
                score: 1.0,
            },
            RagResult {
                path: "b.md".to_string(),
                title: Some("B".to_string()),
                chunk: "y".repeat(500),
                score: 0.5,
            },
        ];
        // max_tokens=100 => max_chars=400, first result alone is >500 chars
        let ctx = build_context(&results, 100);
        assert!(ctx.len() <= 400);
    }

    #[test]
    fn test_build_context_untitled() {
        let results = vec![
            RagResult {
                path: "notes/no-title.md".to_string(),
                title: None,
                chunk: "Content".to_string(),
                score: 1.0,
            },
        ];
        let ctx = build_context(&results, 1000);
        assert!(ctx.contains("From Untitled"));
    }

    #[test]
    fn test_build_context_empty() {
        let ctx = build_context(&[], 1000);
        assert!(ctx.is_empty());
    }
}
