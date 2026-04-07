use crate::core::state::AppState;
use crate::db::links::{self, Link, LinkStats};
use crate::db::pool::DbPool;
use crate::errors::NoctoError;

/// Get the DB pool from the active core, or error if no core is open.
async fn get_db(state: &tauri::State<'_, AppState>) -> Result<DbPool, NoctoError> {
    let core = state.active_core.read().await;
    match core.as_ref() {
        Some(active) => Ok(active.db.clone()),
        None => Err(NoctoError::CoreNotFound {
            path: String::new(),
        }),
    }
}

/// Get all links for the graph view.
#[tauri::command]
pub async fn graph_links(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Link>, NoctoError> {
    let db = get_db(&state).await?;
    let conn = db.get().map_err(|e| NoctoError::Unexpected {
        detail: format!("Failed to get DB connection: {e}"),
    })?;
    links::get_all_links(&conn)
}

/// Get graph statistics.
#[tauri::command]
pub async fn graph_stats(
    state: tauri::State<'_, AppState>,
) -> Result<LinkStats, NoctoError> {
    let db = get_db(&state).await?;
    let conn = db.get().map_err(|e| NoctoError::Unexpected {
        detail: format!("Failed to get DB connection: {e}"),
    })?;
    links::get_link_stats(&conn)
}

/// Get backlinks for a specific file.
#[tauri::command]
pub async fn graph_backlinks(
    path: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Link>, NoctoError> {
    let db = get_db(&state).await?;
    let conn = db.get().map_err(|e| NoctoError::Unexpected {
        detail: format!("Failed to get DB connection: {e}"),
    })?;
    links::get_backlinks(&conn, &path)
}
