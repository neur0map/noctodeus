use std::path::PathBuf;

use tauri::State;

use crate::ai::memory::{self, MemoryResult, MemoryStatus};
use crate::core::state::AppState;
use crate::db::pool::DbPool;
use crate::errors::{CmdResult, NoctoError};

/// Get the DB pool from the active core, or error if no core is open.
async fn get_db(state: &State<'_, AppState>) -> Result<DbPool, NoctoError> {
    let core = state.active_core.read().await;
    match core.as_ref() {
        Some(active) => Ok(active.db.clone()),
        None => Err(NoctoError::CoreNotFound {
            path: String::new(),
        }),
    }
}

/// Search notes using memvid-backed lexical search.
///
/// Opens the `.mv2` memory, runs a Tantivy search, and returns ranked results.
/// Falls back to BM25 + FTS5 if the memory file hasn't been built yet.
#[tauri::command]
pub async fn rag_search(
    query: String,
    top_k: Option<usize>,
    core_path: String,
    state: State<'_, AppState>,
) -> CmdResult<Vec<MemoryResult>> {
    let k = top_k.unwrap_or(10);
    let cp = PathBuf::from(&core_path);

    // Try memvid search first.
    let mv_path = memory::memory_path(&cp);
    if mv_path.exists() {
        let result = tokio::task::spawn_blocking(move || {
            let mut mv = memory::open_memory(&cp)?;
            let embedder = memory::create_embedder().ok();
            memory::search_memory(&mut mv, &query, k, embedder.as_ref())
        })
        .await
        .map_err(|e| NoctoError::Unexpected {
            detail: format!("Search task failed: {e}"),
        })??;
        return Ok(result);
    }

    // Fallback: BM25 + FTS5 (pre-memvid path for un-indexed cores).
    let db = get_db(&state).await?;

    use crate::ai::rag;
    use std::collections::HashMap;

    let bm25_results = rag::search_notes_bm25(&db, &query, k, &core_path).unwrap_or_default();
    let fts_results = rag::search_notes_fts(&db, &query, k).unwrap_or_default();

    let mut best: HashMap<String, rag::RagResult> = HashMap::new();
    for result in bm25_results.into_iter().chain(fts_results.into_iter()) {
        let entry = best
            .entry(result.path.clone())
            .or_insert_with(|| result.clone());
        if result.score > entry.score {
            *entry = result;
        }
    }

    let mut merged: Vec<rag::RagResult> = best.into_values().collect();
    merged.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
    merged.truncate(k);

    // Convert RagResult -> MemoryResult for a uniform return type.
    let results = merged
        .into_iter()
        .map(|r| MemoryResult {
            path: r.path,
            title: r.title,
            chunk: r.chunk,
            score: r.score,
        })
        .collect();

    Ok(results)
}

/// Build a context string from a query for injecting into an AI system prompt.
///
/// Runs `rag_search` logic then assembles the results into a formatted context string.
#[tauri::command]
pub async fn rag_context(
    query: String,
    core_path: String,
    max_tokens: Option<usize>,
    state: State<'_, AppState>,
) -> CmdResult<String> {
    let tokens = max_tokens.unwrap_or(2000);
    let k = 10;

    let cp = PathBuf::from(&core_path);
    let mv_path = memory::memory_path(&cp);

    if mv_path.exists() {
        let result = tokio::task::spawn_blocking(move || {
            let mut mv = memory::open_memory(&cp)?;
            let embedder = memory::create_embedder().ok();
            let results = memory::search_memory(&mut mv, &query, k, embedder.as_ref())?;
            Ok::<String, NoctoError>(memory::build_context(&results, tokens))
        })
        .await
        .map_err(|e| NoctoError::Unexpected {
            detail: format!("Context task failed: {e}"),
        })??;
        return Ok(result);
    }

    // Fallback: old BM25 + FTS5 path.
    let db = get_db(&state).await?;

    use crate::ai::rag;
    use std::collections::HashMap;

    let bm25_results = rag::search_notes_bm25(&db, &query, k, &core_path).unwrap_or_default();
    let fts_results = rag::search_notes_fts(&db, &query, k).unwrap_or_default();

    let mut best: HashMap<String, rag::RagResult> = HashMap::new();
    for result in bm25_results.into_iter().chain(fts_results.into_iter()) {
        let entry = best
            .entry(result.path.clone())
            .or_insert_with(|| result.clone());
        if result.score > entry.score {
            *entry = result;
        }
    }

    let mut merged: Vec<rag::RagResult> = best.into_values().collect();
    merged.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
    merged.truncate(k);

    Ok(rag::build_context(&merged, tokens))
}

/// Trigger a full reindex of all markdown notes into the memvid memory.
///
/// Returns the number of notes indexed.
#[tauri::command]
pub async fn rag_index(
    core_path: String,
    state: State<'_, AppState>,
) -> CmdResult<u32> {
    let db = get_db(&state).await?;
    let cp = PathBuf::from(core_path);

    let count = tokio::task::spawn_blocking(move || {
        let mut mv = memory::open_memory(&cp)?;
        memory::index_all_notes(&mut mv, &cp, &db, true)
    })
    .await
    .map_err(|e| NoctoError::Unexpected {
        detail: format!("Index task failed: {e}"),
    })??;

    Ok(count)
}

/// Return the current status of the memvid memory index.
#[tauri::command]
pub async fn rag_status(
    core_path: String,
    _state: State<'_, AppState>,
) -> CmdResult<MemoryStatus> {
    let cp = PathBuf::from(core_path);
    let status = tokio::task::spawn_blocking(move || {
        memory::memory_status(&cp)
    })
    .await
    .map_err(|e| NoctoError::Unexpected {
        detail: format!("Status task failed: {e}"),
    })??;

    Ok(status)
}
