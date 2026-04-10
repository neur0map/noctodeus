use std::time::Duration;

use reqwest::Client;
use serde::{Deserialize, Serialize};

use crate::ai::providers;
use crate::ai::AiProvider;
use crate::errors::{CmdResult, NoctoError};

/// Get the list of built-in provider presets.
///
/// Chat completions themselves happen JS-side via the Vercel AI SDK —
/// there is no longer a Rust `ai_chat` command. Rust only surfaces the
/// provider preset list and the /models endpoint helper.
#[tauri::command]
pub fn ai_providers() -> CmdResult<Vec<AiProvider>> {
    Ok(providers::presets())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelInfo {
    pub id: String,
    pub owned_by: Option<String>,
}

/// Fetch available models from the provider's /models endpoint.
#[tauri::command]
pub async fn ai_models(base_url: String, api_key: String) -> CmdResult<Vec<ModelInfo>> {
    let url = format!("{}/models", base_url.trim_end_matches('/'));

    let client = Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| NoctoError::AiFailed { detail: e.to_string() })?;

    let resp = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await
        .map_err(|e| NoctoError::AiFailed {
            detail: format!("Failed to fetch models: {e}"),
        })?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(NoctoError::AiFailed {
            detail: format!("Models endpoint returned {status}: {body}"),
        });
    }

    #[derive(Deserialize)]
    struct ModelsResponse {
        data: Vec<ModelEntry>,
    }

    #[derive(Deserialize)]
    struct ModelEntry {
        id: String,
        owned_by: Option<String>,
    }

    let body: ModelsResponse = resp.json().await.map_err(|e| NoctoError::AiFailed {
        detail: format!("Invalid models response: {e}"),
    })?;

    let mut models: Vec<ModelInfo> = body
        .data
        .into_iter()
        .map(|m| ModelInfo {
            id: m.id,
            owned_by: m.owned_by,
        })
        .collect();

    models.sort_by(|a, b| a.id.cmp(&b.id));

    Ok(models)
}
