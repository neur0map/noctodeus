use std::collections::HashMap;

use tauri::State;

use crate::ai::rag::{self, RagResult};
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

/// Search notes using hybrid BM25 + FTS5, return ranked results.
///
/// Combines results from both search backends, deduplicates by path,
/// and returns the merged top-k results sorted by score.
#[tauri::command]
pub async fn rag_search(
    query: String,
    top_k: Option<usize>,
    core_path: String,
    state: State<'_, AppState>,
) -> CmdResult<Vec<RagResult>> {
    let k = top_k.unwrap_or(10);
    let db = get_db(&state).await?;

    // Run BM25 search (reads files from disk, chunks them).
    let bm25_results = rag::search_notes_bm25(&db, &query, k, &core_path).unwrap_or_default();

    // Run FTS5 search (uses SQLite FTS index).
    let fts_results = rag::search_notes_fts(&db, &query, k).unwrap_or_default();

    // Merge: deduplicate by path, keeping the higher score.
    let mut best: HashMap<String, RagResult> = HashMap::new();

    for result in bm25_results.into_iter().chain(fts_results.into_iter()) {
        let entry = best.entry(result.path.clone()).or_insert_with(|| result.clone());
        if result.score > entry.score {
            *entry = result;
        }
    }

    let mut merged: Vec<RagResult> = best.into_values().collect();
    merged.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
    merged.truncate(k);

    Ok(merged)
}

/// Build a context string from a query for injecting into an AI system prompt.
///
/// Runs `rag_search` then assembles the results into a formatted context string.
#[tauri::command]
pub async fn rag_context(
    query: String,
    core_path: String,
    max_tokens: Option<usize>,
    state: State<'_, AppState>,
) -> CmdResult<String> {
    let tokens = max_tokens.unwrap_or(2000);
    let db = get_db(&state).await?;

    // Search with both backends.
    let k = 10;
    let bm25_results = rag::search_notes_bm25(&db, &query, k, &core_path).unwrap_or_default();
    let fts_results = rag::search_notes_fts(&db, &query, k).unwrap_or_default();

    // Merge and deduplicate.
    let mut best: HashMap<String, RagResult> = HashMap::new();
    for result in bm25_results.into_iter().chain(fts_results.into_iter()) {
        let entry = best.entry(result.path.clone()).or_insert_with(|| result.clone());
        if result.score > entry.score {
            *entry = result;
        }
    }

    let mut merged: Vec<RagResult> = best.into_values().collect();
    merged.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
    merged.truncate(k);

    Ok(rag::build_context(&merged, tokens))
}
