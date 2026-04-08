use tauri::AppHandle;

use crate::ai::providers;
use crate::ai::stream;
use crate::ai::{AiProvider, ChatRequest};
use crate::errors::CmdResult;

/// Stream a chat completion. Emits `ai:token` events.
/// Returns the full response text when done.
#[tauri::command]
pub async fn ai_chat(request: ChatRequest, app: AppHandle) -> CmdResult<String> {
    stream::stream_chat(&app, &request).await
}

/// Cancel the current AI streaming request.
#[tauri::command]
pub async fn ai_chat_cancel() -> CmdResult<()> {
    stream::cancel();
    Ok(())
}

/// Get the list of built-in provider presets.
#[tauri::command]
pub fn ai_providers() -> CmdResult<Vec<AiProvider>> {
    Ok(providers::presets())
}
