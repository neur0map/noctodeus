use serde::{Deserialize, Serialize};
use tauri::State;
use crate::core::state::AppState;
use crate::errors::{CmdResult, NoctoError};

const MAX_SESSIONS: usize = 5;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResearchSession {
    pub id: String,
    pub title: String,
    pub summary: String,
    pub sources: String,   // JSON string
    pub messages: String,  // JSON string
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionMeta {
    pub id: String,
    pub title: String,
    pub summary: String,
    pub source_count: usize,
    pub message_count: usize,
    pub created_at: i64,
    pub updated_at: i64,
}

#[tauri::command]
pub async fn research_save_session(session: ResearchSession, state: State<'_, AppState>) -> CmdResult<()> {
    let core = state.active_core.read().await;
    let active = core.as_ref().ok_or(NoctoError::CoreNotFound { path: String::new() })?;
    let conn = active.db.get().map_err(|e| NoctoError::Unexpected {
        detail: format!("DB connection error: {e}"),
    })?;

    // Upsert the session
    conn.execute(
        "INSERT INTO research_sessions (id, title, summary, sources, messages, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(id) DO UPDATE SET
           title = ?2, summary = ?3, sources = ?4, messages = ?5, updated_at = ?7",
        rusqlite::params![
            session.id,
            session.title,
            session.summary,
            session.sources,
            session.messages,
            session.created_at,
            session.updated_at,
        ],
    )?;

    // Enforce max 5 sessions — delete oldest beyond limit
    conn.execute(
        "DELETE FROM research_sessions WHERE id NOT IN (
            SELECT id FROM research_sessions ORDER BY updated_at DESC LIMIT ?1
        )",
        rusqlite::params![MAX_SESSIONS],
    )?;

    Ok(())
}

#[tauri::command]
pub async fn research_load_session(id: String, state: State<'_, AppState>) -> CmdResult<ResearchSession> {
    let core = state.active_core.read().await;
    let active = core.as_ref().ok_or(NoctoError::CoreNotFound { path: String::new() })?;
    let conn = active.db.get().map_err(|e| NoctoError::Unexpected {
        detail: format!("DB connection error: {e}"),
    })?;

    let session = conn.query_row(
        "SELECT id, title, summary, sources, messages, created_at, updated_at
         FROM research_sessions WHERE id = ?1",
        rusqlite::params![id],
        |row| {
            Ok(ResearchSession {
                id: row.get(0)?,
                title: row.get(1)?,
                summary: row.get(2)?,
                sources: row.get(3)?,
                messages: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        },
    ).map_err(|_| NoctoError::FileNotFound { path: format!("research session: {id}") })?;

    Ok(session)
}

#[tauri::command]
pub async fn research_list_sessions(state: State<'_, AppState>) -> CmdResult<Vec<SessionMeta>> {
    let core = state.active_core.read().await;
    let active = core.as_ref().ok_or(NoctoError::CoreNotFound { path: String::new() })?;
    let conn = active.db.get().map_err(|e| NoctoError::Unexpected {
        detail: format!("DB connection error: {e}"),
    })?;

    let mut stmt = conn.prepare(
        "SELECT id, title, summary, sources, messages, created_at, updated_at
         FROM research_sessions ORDER BY updated_at DESC",
    )?;

    let sessions = stmt.query_map([], |row| {
        let sources_json: String = row.get(3)?;
        let messages_json: String = row.get(4)?;
        // Count items in JSON arrays
        let source_count = sources_json.matches("\"id\"").count();
        let message_count = messages_json.matches("\"role\"").count();
        Ok(SessionMeta {
            id: row.get(0)?,
            title: row.get(1)?,
            summary: row.get(2)?,
            source_count,
            message_count,
            created_at: row.get(5)?,
            updated_at: row.get(6)?,
        })
    })?.filter_map(|r| r.ok()).collect();

    Ok(sessions)
}

#[tauri::command]
pub async fn research_delete_session(id: String, state: State<'_, AppState>) -> CmdResult<()> {
    let core = state.active_core.read().await;
    let active = core.as_ref().ok_or(NoctoError::CoreNotFound { path: String::new() })?;
    let conn = active.db.get().map_err(|e| NoctoError::Unexpected {
        detail: format!("DB connection error: {e}"),
    })?;

    conn.execute("DELETE FROM research_sessions WHERE id = ?1", rusqlite::params![id])?;
    Ok(())
}
