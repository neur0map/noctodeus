use std::sync::atomic::{AtomicBool, Ordering};

use futures_util::StreamExt;
use reqwest::Client;
use serde_json::json;
use tauri::{AppHandle, Emitter};
use tracing::debug;

use crate::ai::{ChatRequest, StreamToken};
use crate::errors::NoctoError;

/// Global cancellation flag for the current AI request.
static CANCELLED: AtomicBool = AtomicBool::new(false);

pub fn cancel() {
    CANCELLED.store(true, Ordering::Relaxed);
}

pub fn reset_cancel() {
    CANCELLED.store(false, Ordering::Relaxed);
}

pub fn is_cancelled() -> bool {
    CANCELLED.load(Ordering::Relaxed)
}

/// Build the JSON request body.
/// Uses only widely-supported parameters. Avoids `max_tokens` which newer
/// OpenAI models reject — uses `max_completion_tokens` instead.
/// Only includes `temperature` for non-reasoning models.
fn build_request_body(
    model: &str,
    messages: &[serde_json::Value],
    request: &ChatRequest,
) -> serde_json::Value {
    let m = model.to_lowercase();
    let is_reasoning = m.starts_with("o1") || m.starts_with("o3") || m.starts_with("o4")
        || m.contains("reasoning") || m.contains("thinking");

    let mut body = json!({
        "model": model,
        "messages": messages,
        "stream": true,
    });

    // Only set temperature for non-reasoning models
    if !is_reasoning {
        body["temperature"] = json!(request.temperature.unwrap_or(0.7));
    }

    // Always use max_completion_tokens (works on both old and new OpenAI models)
    // Never send max_tokens — it's deprecated on newer models
    if let Some(max) = request.max_tokens {
        body["max_completion_tokens"] = json!(max);
    }

    body
}

/// Stream a chat completion from an OpenAI-compatible API.
/// Emits `ai:token` events with `StreamToken` payloads.
/// Returns the full assembled response text.
pub async fn stream_chat(
    app: &AppHandle,
    request: &ChatRequest,
) -> Result<String, NoctoError> {
    reset_cancel();

    let mut messages = Vec::new();

    // Prepend system prompt if provided
    if let Some(ref system) = request.system_prompt {
        messages.push(json!({
            "role": "system",
            "content": system,
        }));
    }

    // Add conversation messages
    for msg in &request.messages {
        let mut m = json!({
            "role": msg.role,
            "content": msg.content,
        });
        if let Some(ref tc) = msg.tool_calls {
            m["tool_calls"] = tc.clone();
        }
        if let Some(ref id) = msg.tool_call_id {
            m["tool_call_id"] = json!(id);
        }
        messages.push(m);
    }

    let body = build_request_body(&request.provider.model, &messages, &request);

    let url = format!(
        "{}/chat/completions",
        request.provider.base_url.trim_end_matches('/')
    );

    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| NoctoError::AiFailed {
            detail: e.to_string(),
        })?;

    let response = client
        .post(&url)
        .header("Content-Type", "application/json")
        .header(
            "Authorization",
            format!("Bearer {}", request.provider.api_key),
        )
        .json(&body)
        .send()
        .await
        .map_err(|e| NoctoError::AiFailed {
            detail: if e.is_timeout() {
                "Request timed out. Check your provider connection.".to_string()
            } else {
                format!("Failed to reach AI provider: {e}")
            },
        })?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(NoctoError::AiFailed {
            detail: format!("Provider returned {status}: {body}"),
        });
    }

    let mut full_response = String::new();
    let mut stream = response.bytes_stream();

    let mut buffer = String::new();

    while let Some(chunk) = stream.next().await {
        if is_cancelled() {
            debug!("AI stream cancelled by user");
            let _ = app.emit(
                "ai:token",
                StreamToken {
                    delta: String::new(),
                    done: true,
                },
            );
            return Ok(full_response);
        }

        let chunk = chunk.map_err(|e| NoctoError::AiFailed {
            detail: format!("Stream error: {e}"),
        })?;

        buffer.push_str(&String::from_utf8_lossy(&chunk));

        // Process complete SSE lines
        while let Some(line_end) = buffer.find('\n') {
            let line = buffer[..line_end].trim().to_string();
            buffer = buffer[line_end + 1..].to_string();

            if line.is_empty() || line.starts_with(':') {
                continue;
            }

            if let Some(data) = line.strip_prefix("data: ") {
                if data.trim() == "[DONE]" {
                    let _ = app.emit(
                        "ai:token",
                        StreamToken {
                            delta: String::new(),
                            done: true,
                        },
                    );
                    return Ok(full_response);
                }

                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(data) {
                    let delta_obj = &parsed["choices"][0]["delta"];

                    // Check for regular content
                    if let Some(delta) = delta_obj["content"].as_str() {
                        if !delta.is_empty() {
                            full_response.push_str(delta);
                            let _ = app.emit(
                                "ai:token",
                                StreamToken {
                                    delta: delta.to_string(),
                                    done: false,
                                },
                            );
                        }
                    }

                    // Check for reasoning_content (thinking models like o1, o3)
                    // Stream it as regular content so the user sees the thinking
                    if let Some(reasoning) = delta_obj["reasoning_content"].as_str() {
                        if !reasoning.is_empty() {
                            full_response.push_str(reasoning);
                            let _ = app.emit(
                                "ai:token",
                                StreamToken {
                                    delta: reasoning.to_string(),
                                    done: false,
                                },
                            );
                        }
                    }
                }
            }
        }
    }

    // Final done signal
    let _ = app.emit(
        "ai:token",
        StreamToken {
            delta: String::new(),
            done: true,
        },
    );

    Ok(full_response)
}
