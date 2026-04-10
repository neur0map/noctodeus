pub mod bm25;
pub mod memory;
pub mod providers;
pub mod rag;

use serde::{Deserialize, Serialize};

/// AI provider preset, still used by `ai_providers` / `ai_models` commands
/// so the frontend can populate the Settings > AI dropdown. Actual chat
/// orchestration runs JS-side via the Vercel AI SDK — the old `ai_chat`
/// streaming command and `stream.rs` module were removed in v0.3.0.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiProvider {
    pub id: String,
    pub name: String,
    pub base_url: String,
    pub api_key: String,
    pub model: String,
}
