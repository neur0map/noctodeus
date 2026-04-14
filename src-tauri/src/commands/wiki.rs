use tauri::State;

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
