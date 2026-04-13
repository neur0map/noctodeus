//! Memvid-backed note memory for semantic/lexical RAG.
//!
//! Wraps `memvid_core::Memvid` to provide Nodeus-specific operations:
//! indexing markdown notes into an `.mv2` file, searching them, and
//! managing the lifecycle of the memory store.

use std::path::{Path, PathBuf};

use memvid_core::{Memvid, PutOptions, LocalTextEmbedder, TextEmbedConfig, EmbeddingProvider};
use serde::Serialize;
use tracing::{debug, info, warn};

use crate::db::pool::DbPool;
use crate::db::queries;
use crate::errors::NoctoError;

// ---------------------------------------------------------------------------
// Embedding model
// ---------------------------------------------------------------------------

/// Create a text embedder using bge-small-en-v1.5 (384 dims).
/// On first call, downloads the model from HuggingFace (~133MB) and caches it.
pub fn create_embedder() -> Result<LocalTextEmbedder, NoctoError> {
    let config = TextEmbedConfig {
        model_name: "bge-small-en-v1.5".to_string(),
        offline: false, // allow download on first use
        enable_cache: true,
        cache_capacity: 2000,
        ..Default::default()
    };

    LocalTextEmbedder::new(config).map_err(|e| NoctoError::Unexpected {
        detail: format!("Failed to create text embedder: {e}"),
    })
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/// A single search result returned to the frontend.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryResult {
    pub path: String,
    pub title: Option<String>,
    pub chunk: String,
    pub score: f64,
}

/// Status snapshot of the memory index.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryStatus {
    pub indexed_frames: usize,
    pub file_size_bytes: u64,
    pub file_path: String,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Return the canonical path for the `.mv2` memory file inside a core.
pub fn memory_path(core_path: &Path) -> PathBuf {
    core_path.join(".nodeus").join("memory.mv2")
}

/// Ensure the `.nodeus` directory exists.
fn ensure_nodeus_dir(core_path: &Path) -> Result<(), NoctoError> {
    let dir = core_path.join(".nodeus");
    if !dir.exists() {
        std::fs::create_dir_all(&dir)?;
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Open / Create
// ---------------------------------------------------------------------------

/// Open the memory file, creating it if it doesn't exist.
///
/// The returned `Memvid` handle holds an exclusive file lock. Callers must
/// drop it when done to release the lock.
pub fn open_memory(core_path: &Path) -> Result<Memvid, NoctoError> {
    ensure_nodeus_dir(core_path)?;
    let path = memory_path(core_path);

    let mut mv = if path.exists() {
        Memvid::open(&path).map_err(|e| NoctoError::Unexpected {
            detail: format!("Failed to open memory: {e}"),
        })?
    } else {
        info!(?path, "creating new memory file");
        Memvid::create(&path).map_err(|e| NoctoError::Unexpected {
            detail: format!("Failed to create memory: {e}"),
        })?
    };

    // Enable vector index if not already
    if let Err(e) = mv.enable_vec() {
        debug!("enable_vec: {e} (may already be enabled)");
    }

    Ok(mv)
}

// ---------------------------------------------------------------------------
// Index a single note
// ---------------------------------------------------------------------------

/// Add or update a single note in the memory.
///
/// The note content is stored as a frame with the file path as URI and the
/// first heading (if any) as title.  When a frame with the same URI already
/// exists, it is not duplicated — memvid's internal deduplication handles
/// this during commit.
pub fn index_note(
    mv: &mut Memvid,
    path: &str,
    title: Option<&str>,
    content: &str,
    embedder: Option<&LocalTextEmbedder>,
) -> Result<(), NoctoError> {
    if content.trim().is_empty() {
        return Ok(());
    }

    let mut opts = PutOptions::default();
    opts.uri = Some(path.to_string());
    opts.title = title.map(ToString::to_string);
    opts.search_text = Some(content.to_string());

    // Generate embedding if embedder is available
    if let Some(emb) = embedder {
        // Truncate content for embedding (model has 512 token limit)
        let embed_text = if content.len() > 2000 {
            &content[..2000]
        } else {
            content
        };

        match emb.embed_text(embed_text) {
            Ok(vector) => {
                // Use put_with_embedding for vector-indexed storage
                mv.put_with_embedding(content.as_bytes(), vector)
                    .map_err(|e| NoctoError::Unexpected {
                        detail: format!("Failed to index note {path} with embedding: {e}"),
                    })?;
                return Ok(());
            }
            Err(e) => {
                warn!(path, error = %e, "embedding failed, falling back to lexical-only");
            }
        }
    }

    // Fallback: lexical-only indexing
    mv.put_bytes_with_options(content.as_bytes(), opts)
        .map_err(|e| NoctoError::Unexpected {
            detail: format!("Failed to index note {path}: {e}"),
        })?;

    Ok(())
}

// ---------------------------------------------------------------------------
// Bulk index
// ---------------------------------------------------------------------------

/// Index all markdown files from the database into the memory.
///
/// Returns the number of notes successfully indexed.
pub fn index_all_notes(
    mv: &mut Memvid,
    core_path: &Path,
    pool: &DbPool,
    use_embeddings: bool,
) -> Result<u32, NoctoError> {
    let conn = pool.get().map_err(|e| NoctoError::Unexpected {
        detail: format!("Failed to get DB connection: {e}"),
    })?;

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

    // Create embedder if requested
    let embedder = if use_embeddings {
        match create_embedder() {
            Ok(emb) => {
                info!("text embedder loaded, indexing with vectors");
                Some(emb)
            }
            Err(e) => {
                warn!(error = %e, "failed to load text embedder, indexing lexical-only");
                None
            }
        }
    } else {
        None
    };

    let mut count: u32 = 0;

    for file in &md_files {
        let abs_path = core_path.join(&file.path);
        let content = match std::fs::read_to_string(&abs_path) {
            Ok(c) => c,
            Err(e) => {
                warn!(path = %file.path, error = %e, "skipping unreadable file");
                continue;
            }
        };

        if content.trim().is_empty() {
            continue;
        }

        if let Err(e) = index_note(mv, &file.path, file.title.as_deref(), &content, embedder.as_ref()) {
            warn!(path = %file.path, error = %e, "failed to index note");
            continue;
        }

        count += 1;
    }

    // Commit all pending inserts so the lex index is rebuilt.
    mv.commit().map_err(|e| NoctoError::Unexpected {
        detail: format!("Failed to commit memory: {e}"),
    })?;

    info!(count, "indexed notes into memory");
    Ok(count)
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/// Search the memory using the Tantivy-backed lexical search engine.
///
/// Falls back to the low-level `search_lex` when the full `search()` method
/// is unavailable (e.g. because Tantivy hasn't been initialized).
pub fn search_memory(
    mv: &mut Memvid,
    query: &str,
    top_k: usize,
    embedder: Option<&LocalTextEmbedder>,
) -> Result<Vec<MemoryResult>, NoctoError> {
    if query.trim().is_empty() {
        return Ok(Vec::new());
    }

    // Try vector search if embedder available
    let mut vec_results: Vec<MemoryResult> = Vec::new();
    if let Some(emb) = embedder {
        if let Ok(query_vec) = emb.embed_text(query) {
            if let Ok(hits) = mv.search_vec(&query_vec, top_k) {
                for hit in hits {
                    vec_results.push(MemoryResult {
                        path: format!("frame:{}", hit.frame_id),
                        title: None,
                        chunk: format!("[Vector match, frame {}]", hit.frame_id),
                        score: 1.0 / (1.0 + hit.distance as f64), // convert distance to similarity
                    });
                }
            }
        }
    }

    // Try the full Tantivy search first (provides richer results).
    match mv.search(memvid_core::SearchRequest {
        query: query.to_string(),
        top_k,
        snippet_chars: 300,
        uri: None,
        scope: None,
        cursor: None,
        as_of_frame: None,
        as_of_ts: None,
        no_sketch: false,
        acl_context: None,
        acl_enforcement_mode: Default::default(),
    }) {
        Ok(response) => {
            let results = response
                .hits
                .into_iter()
                .map(|hit| MemoryResult {
                    path: hit.uri.clone(),
                    title: hit.title.clone(),
                    chunk: if let Some(ref ct) = hit.chunk_text {
                        ct.clone()
                    } else {
                        hit.text.clone()
                    },
                    score: hit.score.map(|s| s as f64).unwrap_or(0.0),
                })
                .collect();
            return Ok(results);
        }
        Err(e) => {
            debug!(error = %e, "full search failed, falling back to search_lex");
        }
    }

    // Fallback: raw lexical search.
    let hits = mv
        .search_lex(query, top_k)
        .map_err(|e| NoctoError::Unexpected {
            detail: format!("Lexical search failed: {e}"),
        })?;

    let mut results: Vec<MemoryResult> = hits
        .into_iter()
        .map(|hit| MemoryResult {
            path: String::new(),
            title: None,
            chunk: hit
                .snippets
                .first()
                .cloned()
                .unwrap_or_default(),
            score: hit.score as f64,
        })
        .collect();

    // Merge vector results with lexical results (dedup by content prefix)
    if !vec_results.is_empty() && results.len() < top_k {
        for vr in vec_results {
            if results.len() >= top_k { break; }
            let prefix = &vr.chunk[..vr.chunk.len().min(50)];
            if !results.iter().any(|r| r.chunk.starts_with(prefix)) {
                results.push(vr);
            }
        }
    }

    Ok(results)
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

/// Return a status snapshot of the memory index.
pub fn memory_status(core_path: &Path) -> Result<MemoryStatus, NoctoError> {
    let path = memory_path(core_path);

    if !path.exists() {
        return Ok(MemoryStatus {
            indexed_frames: 0,
            file_size_bytes: 0,
            file_path: path.to_string_lossy().into_owned(),
        });
    }

    let metadata = std::fs::metadata(&path)?;
    let file_size_bytes = metadata.len();

    // Open read-only to get frame count without holding a write lock.
    let mv = Memvid::open_read_only(&path).map_err(|e| NoctoError::Unexpected {
        detail: format!("Failed to open memory read-only: {e}"),
    })?;

    Ok(MemoryStatus {
        indexed_frames: mv.frame_count(),
        file_size_bytes,
        file_path: path.to_string_lossy().into_owned(),
    })
}

// ---------------------------------------------------------------------------
// Context builder
// ---------------------------------------------------------------------------

/// Assemble memory results into a context string for injecting into an AI prompt.
///
/// Each result is formatted as a section with title and source path.
/// Truncates if the total exceeds `max_tokens` (estimated at 4 chars per token).
pub fn build_context(results: &[MemoryResult], max_tokens: usize) -> String {
    let max_chars = max_tokens * 4;
    let mut context = String::new();

    for result in results {
        let title = result.title.as_deref().unwrap_or("Untitled");
        let section = format!(
            "From {title} ({path}):\n{chunk}\n---\n",
            path = result.path,
            chunk = result.chunk,
        );

        if context.len() + section.len() > max_chars {
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
