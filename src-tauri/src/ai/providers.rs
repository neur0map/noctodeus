use crate::ai::AiProvider;

/// Built-in provider presets. User still needs to supply API key.
pub fn presets() -> Vec<AiProvider> {
    vec![
        AiProvider {
            id: "openai".into(),
            name: "OpenAI".into(),
            base_url: "https://api.openai.com/v1".into(),
            api_key: String::new(),
            model: "gpt-4o".into(),
        },
        AiProvider {
            id: "anthropic-openai".into(),
            name: "Anthropic (OpenAI-compatible)".into(),
            base_url: "https://api.anthropic.com/v1".into(),
            api_key: String::new(),
            model: "claude-sonnet-4-20250514".into(),
        },
        AiProvider {
            id: "ollama".into(),
            name: "Ollama (local)".into(),
            base_url: "http://localhost:11434/v1".into(),
            api_key: "ollama".into(),
            model: "llama3.2".into(),
        },
        AiProvider {
            id: "openrouter".into(),
            name: "OpenRouter".into(),
            base_url: "https://openrouter.ai/api/v1".into(),
            api_key: String::new(),
            model: "anthropic/claude-sonnet-4".into(),
        },
        AiProvider {
            id: "groq".into(),
            name: "Groq".into(),
            base_url: "https://api.groq.com/openai/v1".into(),
            api_key: String::new(),
            model: "llama-3.3-70b-versatile".into(),
        },
        AiProvider {
            id: "custom".into(),
            name: "Custom (OpenAI-compatible)".into(),
            base_url: String::new(),
            api_key: String::new(),
            model: String::new(),
        },
    ]
}
