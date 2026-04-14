use tauri::State;

use crate::ai::memory::{self, MemoryResult};
use crate::core::state::AppState;
use crate::db::mutations;
use crate::db::queries::{self, WikiMeta};
use crate::errors::{CmdResult, NoctoError};

async fn get_db(
    state: &State<'_, AppState>,
) -> Result<crate::db::pool::DbPool, NoctoError> {
    let core = state.active_core.read().await;
    match core.as_ref() {
        Some(active) => Ok(active.db.clone()),
        None => Err(NoctoError::CoreNotFound {
            path: String::new(),
        }),
    }
}

#[tauri::command]
pub async fn wiki_get_meta(state: State<'_, AppState>) -> CmdResult<WikiMeta> {
    let db = get_db(&state).await?;
    let conn = db.get().map_err(|e| NoctoError::Unexpected { detail: e.to_string() })?;
    Ok(queries::get_wiki_meta(&conn)?)
}

#[tauri::command]
pub async fn wiki_get_ingest_hash(
    source_path: String,
    state: State<'_, AppState>,
) -> CmdResult<Option<String>> {
    let db = get_db(&state).await?;
    let conn = db.get().map_err(|e| NoctoError::Unexpected { detail: e.to_string() })?;
    Ok(queries::get_wiki_ingest_hash(&conn, &source_path)?)
}

#[tauri::command]
pub async fn wiki_get_page_hash(
    page_path: String,
    state: State<'_, AppState>,
) -> CmdResult<Option<String>> {
    let db = get_db(&state).await?;
    let conn = db.get().map_err(|e| NoctoError::Unexpected { detail: e.to_string() })?;
    Ok(queries::get_wiki_page_hash(&conn, &page_path)?)
}

#[tauri::command]
pub async fn wiki_record_ingest(
    id: String,
    source_path: String,
    source_type: String,
    content_hash: String,
    wiki_pages_affected: String,
    state: State<'_, AppState>,
) -> CmdResult<()> {
    let db = get_db(&state).await?;
    let conn = db.get().map_err(|e| NoctoError::Unexpected { detail: e.to_string() })?;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;
    mutations::insert_wiki_ingest_entry(
        &conn,
        &id,
        &source_path,
        &source_type,
        &content_hash,
        now,
        &wiki_pages_affected,
    )?;
    Ok(())
}

#[tauri::command]
pub async fn wiki_update_meta(
    page_count: i64,
    link_count: i64,
    state: State<'_, AppState>,
) -> CmdResult<()> {
    let db = get_db(&state).await?;
    let conn = db.get().map_err(|e| NoctoError::Unexpected { detail: e.to_string() })?;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;
    mutations::upsert_wiki_meta(&conn, now, page_count, link_count)?;
    Ok(())
}

#[tauri::command]
pub async fn wiki_set_page_hash(
    page_path: String,
    written_hash: String,
    state: State<'_, AppState>,
) -> CmdResult<()> {
    let db = get_db(&state).await?;
    let conn = db.get().map_err(|e| NoctoError::Unexpected { detail: e.to_string() })?;
    mutations::upsert_wiki_page_hash(&conn, &page_path, &written_hash)?;
    Ok(())
}

#[tauri::command]
pub async fn wiki_reset(state: State<'_, AppState>) -> CmdResult<()> {
    let db = get_db(&state).await?;
    let conn = db.get().map_err(|e| NoctoError::Unexpected { detail: e.to_string() })?;
    mutations::clear_wiki_data(&conn)?;
    Ok(())
}

/// Search wiki pages by query. Returns ranked results from wiki/ folder only.
#[tauri::command]
pub async fn wiki_search(
    query: String,
    top_k: Option<usize>,
    core_path: String,
    state: State<'_, AppState>,
) -> CmdResult<Vec<MemoryResult>> {
    let k = top_k.unwrap_or(5);
    let cp = std::path::PathBuf::from(&core_path);

    // Search using memvid/FTS5 then filter to wiki/ paths
    let mv_path = memory::memory_path(&cp);
    let results = if mv_path.exists() {
        tokio::task::spawn_blocking(move || {
            let mut mv = memory::open_memory(&cp)?;
            let embedder = memory::create_embedder().ok();
            memory::search_memory(&mut mv, &query, k * 3, embedder.as_ref())
        })
        .await
        .map_err(|e| NoctoError::Unexpected {
            detail: format!("Wiki search task failed: {e}"),
        })??
    } else {
        // FTS5 fallback — search_notes_fts takes &DbPool directly
        let db = get_db(&state).await?;
        use crate::ai::rag;
        let fts_results = rag::search_notes_fts(&db, &query, k * 3).unwrap_or_default();
        fts_results.into_iter().map(|r| MemoryResult {
            path: r.path,
            title: r.title,
            chunk: r.chunk,
            score: r.score,
        }).collect()
    };

    // Filter to wiki/ paths only
    let wiki_results: Vec<MemoryResult> = results
        .into_iter()
        .filter(|r| r.path.starts_with("wiki/"))
        .take(k)
        .collect();

    Ok(wiki_results)
}
