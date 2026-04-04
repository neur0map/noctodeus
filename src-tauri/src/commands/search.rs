use std::sync::{Arc, Mutex};

use rusqlite::Connection;

use crate::core::state::AppState;
use crate::db::queries::{self, FileInfo, SearchHit};
use crate::db::mutations;
use crate::errors::NoctoError;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Get the DB connection from the active core, or error if no core is open.
async fn get_db(state: &tauri::State<'_, AppState>) -> Result<Arc<Mutex<Connection>>, NoctoError> {
    let core = state.active_core.read().await;
    match core.as_ref() {
        Some(active) => Ok(active.db.clone()),
        None => Err(NoctoError::CoreNotFound {
            path: String::new(),
        }),
    }
}

// ---------------------------------------------------------------------------
// Search commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn search_query(
    text: String,
    scope: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<SearchHit>, NoctoError> {
    let db = get_db(&state).await?;
    let conn = db.lock().map_err(|e| NoctoError::Unexpected {
        detail: format!("DB lock poisoned: {e}"),
    })?;

    // The current search_fts doesn't support scope filtering, so when a scope
    // is provided we filter results after the query.
    let results = queries::search_fts(&conn, &text)?;

    match scope {
        Some(ref scope_dir) => {
            let prefix = if scope_dir.ends_with('/') {
                scope_dir.clone()
            } else {
                format!("{scope_dir}/")
            };
            Ok(results
                .into_iter()
                .filter(|hit| hit.path.starts_with(&prefix) || hit.path == *scope_dir)
                .collect())
        }
        None => Ok(results),
    }
}

#[tauri::command]
pub async fn search_recent(
    limit: u32,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<FileInfo>, NoctoError> {
    let db = get_db(&state).await?;
    let conn = db.lock().map_err(|e| NoctoError::Unexpected {
        detail: format!("DB lock poisoned: {e}"),
    })?;
    queries::get_recent(&conn, limit)
}

#[tauri::command]
pub async fn search_pinned(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<FileInfo>, NoctoError> {
    let db = get_db(&state).await?;
    let conn = db.lock().map_err(|e| NoctoError::Unexpected {
        detail: format!("DB lock poisoned: {e}"),
    })?;
    queries::get_pinned(&conn)
}

// ---------------------------------------------------------------------------
// Pin commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn pin_add(
    path: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), NoctoError> {
    let db = get_db(&state).await?;
    let conn = db.lock().map_err(|e| NoctoError::Unexpected {
        detail: format!("DB lock poisoned: {e}"),
    })?;
    mutations::add_pinned(&conn, &path)
}

#[tauri::command]
pub async fn pin_remove(
    path: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), NoctoError> {
    let db = get_db(&state).await?;
    let conn = db.lock().map_err(|e| NoctoError::Unexpected {
        detail: format!("DB lock poisoned: {e}"),
    })?;
    mutations::remove_pinned(&conn, &path)
}

// ---------------------------------------------------------------------------
// State commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn state_save(
    key: String,
    value: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), NoctoError> {
    let db = get_db(&state).await?;
    let conn = db.lock().map_err(|e| NoctoError::Unexpected {
        detail: format!("DB lock poisoned: {e}"),
    })?;
    mutations::save_state(&conn, &key, &value)
}

#[tauri::command]
pub async fn state_load(
    key: String,
    state: tauri::State<'_, AppState>,
) -> Result<Option<String>, NoctoError> {
    let db = get_db(&state).await?;
    let conn = db.lock().map_err(|e| NoctoError::Unexpected {
        detail: format!("DB lock poisoned: {e}"),
    })?;
    queries::load_state(&conn, &key)
}
