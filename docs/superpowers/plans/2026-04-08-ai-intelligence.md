# AI Intelligence Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add AI chat, MCP tool support, RAG (search notes with AI), a skill/prompt system, and S3/WebDAV sync backends to Noctodeus.

**Architecture:** Five chunks built sequentially. Each produces working software. Chunk 1 (AI chat) is the foundation — a sidebar panel where users configure any OpenAI-compatible provider and chat with streaming responses. Chunk 2 (MCP) adds tool use — the AI can call external tools via MCP servers. Chunk 3 (RAG) lets the AI search and reference the user's notes. Chunk 4 (Skills) adds a prompt template system for specialized AI behaviors. Chunk 5 (Sync backends) adds S3 and WebDAV as alternatives to GitHub.

**Tech Stack:** Rust (reqwest for HTTP/SSE, tokio::process for MCP, rusqlite for vectors), Tauri 2, Svelte 5, TypeScript

**Reference:** Architecture inspired by [note-gen](https://github.com/codexu/note-gen) (GPL-3.0). Clean-room reimplementation — no code copied.

---

## Dependency Chain

```
Chunk 1: AI Chat (standalone)
    ↓
Chunk 2: MCP Tools (extends AI chat with tool calling)
    ↓
Chunk 3: RAG (extends AI chat with note context)
    ↓
Chunk 4: Skills (extends AI chat with prompt templates)

Chunk 5: Sync Backends (standalone, no AI dependency)
```

---

## File Structure

### Chunk 1: AI Chat
**New Rust files:**
- `src-tauri/src/ai/mod.rs` — types (AiConfig, AiMessage, AiProvider), public API
- `src-tauri/src/ai/stream.rs` — SSE streaming proxy with cancellation support
- `src-tauri/src/ai/providers.rs` — provider presets (OpenAI, Anthropic, Ollama, etc.)
- `src-tauri/src/commands/ai.rs` — Tauri commands: ai_chat, ai_chat_cancel, ai_providers

**New frontend files:**
- `src/lib/ai/types.ts` — TypeScript interfaces for AI types
- `src/lib/bridge/ai.ts` — Tauri invoke wrappers
- `src/lib/stores/ai.svelte.ts` — conversation state, provider config, message history
- `src/lib/components/ai/ChatPanel.svelte` — the sidebar chat panel
- `src/lib/components/ai/ChatMessage.svelte` — individual message bubble
- `src/lib/components/ai/ChatInput.svelte` — input area with send button
- `src/lib/components/ai/ProviderConfig.svelte` — provider setup in settings

### Chunk 2: MCP
**New Rust files:**
- `src-tauri/src/mcp/mod.rs` — types, MCP server registry
- `src-tauri/src/mcp/process.rs` — spawn/manage MCP server subprocesses via stdio
- `src-tauri/src/mcp/protocol.rs` — JSON-RPC message framing for MCP
- `src-tauri/src/mcp/runtime.rs` — detect installed runtimes (node, python, etc.)
- `src-tauri/src/commands/mcp.rs` — Tauri commands: mcp_start, mcp_stop, mcp_list_tools, mcp_call_tool

**New frontend files:**
- `src/lib/bridge/mcp.ts` — invoke wrappers
- `src/lib/stores/mcp.svelte.ts` — server list, tool registry
- `src/lib/components/ai/ToolCallBlock.svelte` — renders tool calls/results in chat

### Chunk 3: RAG
**New Rust files:**
- `src-tauri/src/ai/rag.rs` — document chunking, embedding storage, hybrid search
- `src-tauri/src/ai/bm25.rs` — BM25 keyword scoring

**New frontend files:**
- `src/lib/components/ai/NoteContext.svelte` — shows which notes the AI referenced

**DB changes:**
- V4 migration: `embeddings` table (path, chunk_index, content, vector JSON, content_hash)

### Chunk 4: Skills
**New Rust files:**
- `src-tauri/src/ai/skills.rs` — SKILL.md parser, directory scanner, skill matching
- `src-tauri/src/commands/skills.rs` — Tauri commands: skills_list, skills_match

**New frontend files:**
- `src/lib/components/ai/SkillBadge.svelte` — shows active skill in chat

### Chunk 5: Sync Backends
**New Rust files:**
- `src-tauri/src/sync/s3.rs` — AWS Signature V4 signing, S3 put/get/list/delete
- `src-tauri/src/sync/webdav.rs` — PROPFIND/PUT/GET/DELETE via reqwest

**Modified files:**
- `src-tauri/src/sync/mod.rs` — add S3Sync, WebDavSync implementations of SyncBackend
- Settings UI — add backend picker (GitHub / S3 / WebDAV)

---

## Chunk 1: AI Chat Sidebar

### Task 1: Add dependencies

**Files:**
- Modify: `src-tauri/Cargo.toml`

- [ ] **Step 1: Add streaming + eventsource deps**

`reqwest` is already present. Add `futures-util` for stream processing and enable `reqwest` streaming:

```toml
futures-util = "0.3"
```

Update `reqwest` features to include `stream`:

```toml
reqwest = { version = "0.12", features = ["json", "rustls-tls", "stream"], default-features = false }
```

- [ ] **Step 2: Verify compiles**

Run: `cd src-tauri && cargo check`

- [ ] **Step 3: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "feat(ai): add futures-util, enable reqwest streaming"
```

---

### Task 2: Create AI module with types and SSE streaming

**Files:**
- Create: `src-tauri/src/ai/mod.rs`
- Create: `src-tauri/src/ai/stream.rs`
- Create: `src-tauri/src/ai/providers.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/errors.rs`

- [ ] **Step 1: Add AiFailed error variant**

In `errors.rs`, after ShareFailed:

```rust
    // AI
    #[error("AI request failed: {detail}")]
    AiFailed { detail: String },
```

Add to `code()`: `NoctoError::AiFailed { .. } => "ai_failed",`

- [ ] **Step 2: Create `ai/mod.rs` with types**

```rust
pub mod providers;
pub mod stream;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiProvider {
    pub id: String,
    pub name: String,
    pub base_url: String,
    pub api_key: String,
    pub model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiMessage {
    pub role: String,    // "system", "user", "assistant", "tool"
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatRequest {
    pub provider: AiProvider,
    pub messages: Vec<AiMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system_prompt: Option<String>,
    #[serde(default)]
    pub temperature: Option<f32>,
    #[serde(default)]
    pub max_tokens: Option<u32>,
}

/// Streamed token event sent to the frontend via Tauri events.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamToken {
    pub delta: String,
    pub done: bool,
}
```

- [ ] **Step 3: Create `ai/stream.rs` — SSE streaming proxy**

This is the core: sends a request to the AI provider's `/chat/completions` endpoint with `stream: true`, parses SSE `data:` lines, and emits tokens to the frontend via Tauri events.

```rust
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use futures_util::StreamExt;
use reqwest::Client;
use serde_json::json;
use tauri::{AppHandle, Emitter};
use tracing::{debug, warn};

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

    let body = json!({
        "model": request.provider.model,
        "messages": messages,
        "stream": true,
        "temperature": request.temperature.unwrap_or(0.7),
        "max_tokens": request.max_tokens.unwrap_or(4096),
    });

    let url = format!("{}/chat/completions",
        request.provider.base_url.trim_end_matches('/'));

    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| NoctoError::AiFailed { detail: e.to_string() })?;

    let response = client
        .post(&url)
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {}", request.provider.api_key))
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
            let _ = app.emit("ai:token", StreamToken { delta: String::new(), done: true });
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
                    let _ = app.emit("ai:token", StreamToken { delta: String::new(), done: true });
                    return Ok(full_response);
                }

                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(data) {
                    if let Some(delta) = parsed["choices"][0]["delta"]["content"].as_str() {
                        if !delta.is_empty() {
                            full_response.push_str(delta);
                            let _ = app.emit("ai:token", StreamToken {
                                delta: delta.to_string(),
                                done: false,
                            });
                        }
                    }
                }
            }
        }
    }

    // Final done signal
    let _ = app.emit("ai:token", StreamToken { delta: String::new(), done: true });

    Ok(full_response)
}
```

- [ ] **Step 4: Create `ai/providers.rs` — provider presets**

```rust
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
```

- [ ] **Step 5: Register module in `lib.rs`**

Add `pub mod ai;` after `pub mod sync;`.

- [ ] **Step 6: Verify compiles**

Run: `cd src-tauri && cargo check`

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/ai/ src-tauri/src/errors.rs src-tauri/src/lib.rs
git commit -m "feat(ai): add AI module with SSE streaming, provider presets, and types"
```

---

### Task 3: Create AI Tauri commands

**Files:**
- Create: `src-tauri/src/commands/ai.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Write the AI commands**

```rust
use tauri::AppHandle;

use crate::ai::providers;
use crate::ai::stream;
use crate::ai::{AiProvider, ChatRequest};
use crate::errors::{CmdResult, NoctoError};

/// Stream a chat completion. Emits `ai:token` events.
/// Returns the full response text when done.
#[tauri::command]
pub async fn ai_chat(
    request: ChatRequest,
    app: AppHandle,
) -> CmdResult<String> {
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
```

- [ ] **Step 2: Register commands**

In `commands/mod.rs`: add `pub mod ai;` and `pub use self::ai::*;`

In `lib.rs` invoke_handler: add `commands::ai_chat`, `commands::ai_chat_cancel`, `commands::ai_providers`

- [ ] **Step 3: Build**

Run: `cd src-tauri && cargo build`

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/commands/ai.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs
git commit -m "feat(ai): add ai_chat, ai_chat_cancel, ai_providers Tauri commands"
```

---

### Task 4: Create frontend AI bridge, store, and types

**Files:**
- Create: `src/lib/ai/types.ts`
- Create: `src/lib/bridge/ai.ts`
- Create: `src/lib/stores/ai.svelte.ts`

- [ ] **Step 1: Create types**

```typescript
// src/lib/ai/types.ts

export interface AiProvider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface AiMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolCalls?: any;
  // Frontend-only fields
  timestamp?: number;
  streaming?: boolean;
}

export interface ChatRequest {
  provider: AiProvider;
  messages: AiMessage[];
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface StreamToken {
  delta: string;
  done: boolean;
}
```

- [ ] **Step 2: Create bridge**

```typescript
// src/lib/bridge/ai.ts

import { invoke } from '@tauri-apps/api/core';
import type { AiProvider, ChatRequest } from '$lib/ai/types';

export async function aiChat(request: ChatRequest): Promise<string> {
  return invoke<string>('ai_chat', { request });
}

export async function aiChatCancel(): Promise<void> {
  return invoke('ai_chat_cancel');
}

export async function aiProviders(): Promise<AiProvider[]> {
  return invoke<AiProvider[]>('ai_providers');
}
```

- [ ] **Step 3: Create store**

```typescript
// src/lib/stores/ai.svelte.ts

import type { AiMessage, AiProvider, StreamToken } from '$lib/ai/types';
import { aiChat, aiChatCancel } from '$lib/bridge/ai';
import { listen } from '@tauri-apps/api/event';

let messages = $state<AiMessage[]>([]);
let streaming = $state(false);
let provider = $state<AiProvider | null>(null);
let error = $state<string | null>(null);

// Listen for streaming tokens
let unlistenToken: (() => void) | null = null;

async function setupListener() {
  if (unlistenToken) return;
  unlistenToken = await listen<StreamToken>('ai:token', (event) => {
    const { delta, done } = event.payload;
    if (done) {
      streaming = false;
      // Mark last assistant message as not streaming
      const last = messages[messages.length - 1];
      if (last?.role === 'assistant') {
        last.streaming = false;
      }
      return;
    }
    // Append delta to last assistant message
    const last = messages[messages.length - 1];
    if (last?.role === 'assistant' && last.streaming) {
      last.content += delta;
    }
  });
}

export function getAiState() {
  setupListener();

  return {
    get messages() { return messages; },
    get streaming() { return streaming; },
    get provider() { return provider; },
    get error() { return error; },

    setProvider(p: AiProvider) {
      provider = p;
    },

    async send(content: string, systemPrompt?: string) {
      if (!provider || streaming) return;
      error = null;

      // Add user message
      messages.push({
        role: 'user',
        content,
        timestamp: Date.now(),
      });

      // Add empty assistant message for streaming
      messages.push({
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        streaming: true,
      });

      streaming = true;

      try {
        // Send only role+content to backend (strip frontend-only fields)
        const apiMessages = messages
          .filter(m => !m.streaming || m.role !== 'assistant')
          .slice(0, -1) // exclude the empty streaming placeholder
          .map(m => ({ role: m.role, content: m.content }));

        // Add the user message
        apiMessages.push({ role: 'user', content });

        await aiChat({
          provider,
          messages: apiMessages,
          systemPrompt,
        });
      } catch (err) {
        error = String(err);
        streaming = false;
        // Remove the empty assistant message on error
        if (messages[messages.length - 1]?.role === 'assistant' && !messages[messages.length - 1]?.content) {
          messages.pop();
        }
      }
    },

    async cancel() {
      await aiChatCancel();
      streaming = false;
    },

    clear() {
      messages = [];
      error = null;
      streaming = false;
    },
  };
}
```

- [ ] **Step 4: Verify**

Run: `npm run check`

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/ src/lib/bridge/ai.ts src/lib/stores/ai.svelte.ts
git commit -m "feat(ai): add frontend AI types, bridge, and conversation store"
```

---

### Task 5: Create ChatPanel UI components

**Files:**
- Create: `src/lib/components/ai/ChatPanel.svelte`
- Create: `src/lib/components/ai/ChatMessage.svelte`
- Create: `src/lib/components/ai/ChatInput.svelte`

These are the visible UI. ChatPanel is a sidebar panel containing a message list and input area.

- [ ] **Step 1: Create ChatMessage.svelte**

A single message bubble. User messages right-aligned, assistant messages left-aligned. Assistant messages render markdown content. Streaming messages show a blinking cursor.

- [ ] **Step 2: Create ChatInput.svelte**

Textarea with auto-resize, send button, stop button (visible during streaming). Enter sends, Shift+Enter for newline.

- [ ] **Step 3: Create ChatPanel.svelte**

The container: header with model name + clear button, scrollable message list, input area at bottom. When no provider is configured, show a setup prompt linking to settings.

- [ ] **Step 4: Wire ChatPanel into the app layout**

Add a toggle button in the header bar (next to the share button) or use the existing right panel toggle. The chat panel slides in from the right side.

- [ ] **Step 5: Verify**

Run: `npm run check && npm run test`

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/ai/
git commit -m "feat(ai): add ChatPanel, ChatMessage, ChatInput components"
```

---

### Task 6: Add AI provider config to Settings

**Files:**
- Create: `src/lib/components/common/settings/SettingsAI.svelte`
- Modify: `src/lib/components/common/SettingsModal.svelte`
- Modify: `src/lib/stores/settings.svelte.ts`

- [ ] **Step 1: Add AI settings to the store**

In `AppSettings` interface and `DEFAULTS`:

```typescript
  // AI
  aiProviderId: string;    // selected preset ID
  aiBaseUrl: string;
  aiApiKey: string;
  aiModel: string;
  aiSystemPrompt: string;
```

Defaults: `aiProviderId: ''`, `aiBaseUrl: ''`, `aiApiKey: ''`, `aiModel: ''`, `aiSystemPrompt: 'You are a helpful writing assistant. You help with notes, research, and creative thinking.'`

- [ ] **Step 2: Create SettingsAI.svelte**

Provider preset dropdown (loads from `aiProviders()` bridge call), fields for base URL, API key (masked), model name. A "Test connection" button that sends a quick message and shows success/failure. System prompt textarea.

- [ ] **Step 3: Register in SettingsModal**

Add 'ai' to Section type, add tab with Brain icon, add SettingsAI panel.

- [ ] **Step 4: Verify**

Run: `npm run check`

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/common/settings/SettingsAI.svelte src/lib/components/common/SettingsModal.svelte src/lib/stores/settings.svelte.ts
git commit -m "feat(ai): add AI provider settings tab"
```

---

## Chunk 2: MCP Tool Support

### Task 7: Create MCP Rust module

**Files:**
- Create: `src-tauri/src/mcp/mod.rs`
- Create: `src-tauri/src/mcp/process.rs`
- Create: `src-tauri/src/mcp/protocol.rs`
- Modify: `src-tauri/src/lib.rs`

The MCP module spawns external tool servers as child processes, communicates via stdin/stdout JSON-RPC, and exposes discovered tools to the AI.

- [ ] **Step 1: Create `mcp/protocol.rs` — JSON-RPC types**

JSON-RPC 2.0 request/response/notification types. MCP-specific messages: `initialize`, `tools/list`, `tools/call`.

- [ ] **Step 2: Create `mcp/process.rs` — process manager**

`McpServer` struct that wraps a `tokio::process::Child`. Methods: `spawn(command, args, env)`, `send(request)`, `receive()`, `kill()`. Reads stdout line-by-line, parses JSON-RPC responses. Writes to stdin.

- [ ] **Step 3: Create `mcp/mod.rs` — server registry**

`McpRegistry` that manages multiple running MCP servers. Methods: `add_server(name, command, args)`, `remove_server(name)`, `list_tools() -> Vec<Tool>`, `call_tool(server, tool_name, args) -> Result`.

- [ ] **Step 4: Register module**

Add `pub mod mcp;` to `lib.rs`.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/mcp/ src-tauri/src/lib.rs
git commit -m "feat(mcp): add MCP process manager with JSON-RPC protocol"
```

---

### Task 8: Create MCP Tauri commands

**Files:**
- Create: `src-tauri/src/commands/mcp.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

Commands: `mcp_start_server`, `mcp_stop_server`, `mcp_list_tools`, `mcp_call_tool`, `mcp_list_servers`.

- [ ] **Step 1: Write commands, register, build**
- [ ] **Step 2: Commit**

```bash
git commit -m "feat(mcp): add MCP Tauri commands"
```

---

### Task 9: Create MCP frontend + integrate with AI chat

**Files:**
- Create: `src/lib/bridge/mcp.ts`
- Create: `src/lib/stores/mcp.svelte.ts`
- Create: `src/lib/components/ai/ToolCallBlock.svelte`
- Modify: `src/lib/stores/ai.svelte.ts` — add tool calling flow

When the AI responds with `tool_calls`, the frontend:
1. Renders a `ToolCallBlock` showing the tool name and arguments
2. Calls `mcp_call_tool` via Tauri
3. Appends the tool result as a `tool` role message
4. Sends the updated conversation back to the AI for a follow-up response

- [ ] **Step 1: Create bridge + store**
- [ ] **Step 2: Create ToolCallBlock**
- [ ] **Step 3: Update AI store with tool calling loop**
- [ ] **Step 4: Add MCP server config to Settings (add/remove servers)**
- [ ] **Step 5: Commit**

```bash
git commit -m "feat(mcp): integrate MCP tools into AI chat with tool calling loop"
```

---

## Chunk 3: RAG (Retrieval-Augmented Generation)

### Task 10: Add embeddings table (V4 migration)

**Files:**
- Modify: `src-tauri/src/db/migrations.rs`

- [ ] **Step 1: Add V4 migration**

```rust
fn migrate_v4(conn: &Connection) -> Result<(), NoctoError> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS embeddings (
            path TEXT NOT NULL,
            chunk_index INTEGER NOT NULL,
            content TEXT NOT NULL,
            vector TEXT NOT NULL,       -- JSON array of f32
            content_hash TEXT NOT NULL,
            PRIMARY KEY (path, chunk_index)
        );
        CREATE INDEX IF NOT EXISTS idx_embeddings_path ON embeddings(path);
        CREATE INDEX IF NOT EXISTS idx_embeddings_hash ON embeddings(content_hash);"
    )?;
    Ok(())
}
```

Add `migrate_v4` to the migrations array.

- [ ] **Step 2: Test**

Run: `cargo test db::migrations`

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(rag): add V4 migration for embeddings table"
```

---

### Task 11: Implement RAG engine

**Files:**
- Create: `src-tauri/src/ai/rag.rs`
- Create: `src-tauri/src/ai/bm25.rs`

- [ ] **Step 1: Create `bm25.rs` — keyword scoring**

BM25 implementation: tokenize text (split on whitespace + punctuation), compute term frequencies, inverse document frequencies, score documents against a query.

- [ ] **Step 2: Create `rag.rs` — the RAG engine**

Functions:
- `chunk_document(content, max_chunk_size, overlap)` — split text into overlapping chunks
- `embed_chunks(provider, chunks)` — call embedding API, return vectors
- `index_note(pool, provider, path, content)` — chunk + embed + store in SQLite
- `search_notes(pool, provider, query, top_k)` — embed query, cosine similarity + BM25 hybrid, return ranked chunks
- `cosine_similarity(a, b)` — dot product / magnitude

The vectors are stored as JSON text in SQLite (same pattern as note-gen). Cosine similarity is computed in Rust, which is fast enough for vaults under 10k notes.

- [ ] **Step 3: Tests for chunking and BM25**
- [ ] **Step 4: Commit**

```bash
git commit -m "feat(rag): implement document chunking, BM25, and hybrid vector search"
```

---

### Task 12: Create RAG Tauri commands and wire into chat

**Files:**
- Create: `src-tauri/src/commands/rag.rs` (or add to `commands/ai.rs`)
- Modify: `src/lib/stores/ai.svelte.ts`

Commands:
- `rag_index_note(path)` — index a single note
- `rag_index_all()` — index all markdown files in the active core
- `rag_search(query, top_k)` — search indexed notes

The AI chat store gets a "use notes" toggle. When enabled:
1. Before sending user message, call `rag_search` with the user's question
2. Prepend the top-k relevant chunks as context in the system prompt
3. Show a `NoteContext` component listing which notes were referenced

- [ ] **Step 1: Commands**
- [ ] **Step 2: Wire into AI store**
- [ ] **Step 3: Create NoteContext.svelte**
- [ ] **Step 4: Add "Index notes" button in settings**
- [ ] **Step 5: Commit**

```bash
git commit -m "feat(rag): integrate note search into AI chat with context injection"
```

---

## Chunk 4: Skill System

### Task 13: Implement skill parser and matcher

**Files:**
- Create: `src-tauri/src/ai/skills.rs`

A skill is a directory containing a `SKILL.md` file with YAML frontmatter:

```markdown
---
name: "Code Review"
description: "Reviews code for bugs, style, and best practices"
keywords: ["code", "review", "bug", "refactor"]
model: "gpt-4o"
---

You are a senior software engineer conducting a code review...
```

The skill system:
- Scans `skills/` directory in the active core + global skills dir in app data
- Parses SKILL.md frontmatter (name, description, keywords)
- When user sends a message, matches keywords against the message to find relevant skills
- Injects the matched skill's content into the system prompt

- [ ] **Step 1: Write skill parser + scanner + matcher with tests**
- [ ] **Step 2: Commit**

```bash
git commit -m "feat(skills): implement SKILL.md parser, scanner, and keyword matcher"
```

---

### Task 14: Wire skills into AI chat

**Files:**
- Create: `src-tauri/src/commands/skills.rs`
- Modify: `src/lib/stores/ai.svelte.ts`
- Create: `src/lib/components/ai/SkillBadge.svelte`

Commands: `skills_list`, `skills_match(query)`

Before sending a chat message, call `skills_match` with the user's message. If a skill matches, append its content to the system prompt and show a `SkillBadge` indicating which skill is active.

- [ ] **Step 1: Commands + frontend integration**
- [ ] **Step 2: Commit**

```bash
git commit -m "feat(skills): integrate skill matching into AI chat"
```

---

## Chunk 5: S3 and WebDAV Sync Backends

### Task 15: Implement S3 sync backend

**Files:**
- Create: `src-tauri/src/sync/s3.rs`
- Modify: `src-tauri/src/sync/mod.rs`

Implement `SyncBackend` for S3. Uses AWS Signature V4 signing (SHA-256 HMAC) via the existing `sha2` and `hmac` crates. Operations: put_object, get_object, list_objects, delete_object. Supports AWS S3, MinIO, and any S3-compatible service.

- [ ] **Step 1: Implement S3 client with Sig V4 signing**
- [ ] **Step 2: Implement S3Sync as SyncBackend**
- [ ] **Step 3: Tests for signing**
- [ ] **Step 4: Commit**

```bash
git commit -m "feat(sync): add S3 sync backend with AWS Signature V4"
```

---

### Task 16: Implement WebDAV sync backend

**Files:**
- Create: `src-tauri/src/sync/webdav.rs`
- Modify: `src-tauri/src/sync/mod.rs`

Implement `SyncBackend` for WebDAV. Uses `reqwest` for PROPFIND, PUT, GET, DELETE, MKCOL. Basic auth.

- [ ] **Step 1: Implement WebDAV client**
- [ ] **Step 2: Implement WebDavSync as SyncBackend**
- [ ] **Step 3: Commit**

```bash
git commit -m "feat(sync): add WebDAV sync backend"
```

---

### Task 17: Add backend picker to sync settings

**Files:**
- Modify: `src/lib/components/common/settings/SettingsSync.svelte`
- Modify: `src/lib/stores/settings.svelte.ts`

Add a `syncBackend` setting: `'github' | 's3' | 'webdav'`. The sync settings panel shows different config fields depending on the selected backend:
- GitHub: token + repo URL (existing)
- S3: endpoint, bucket, access key, secret key, region
- WebDAV: server URL, username, password

- [ ] **Step 1: Add settings fields**
- [ ] **Step 2: Update SettingsSync UI**
- [ ] **Step 3: Commit**

```bash
git commit -m "feat(sync): add S3 and WebDAV config to sync settings"
```

---

### Task 18: Final verification

- [ ] **Step 1: Run all Rust tests**

Run: `cd src-tauri && cargo test`

- [ ] **Step 2: Run frontend checks**

Run: `npm run check && npm run test`

- [ ] **Step 3: Manual smoke test**

1. Configure an AI provider (Ollama or OpenAI)
2. Open chat panel, send a message, verify streaming response
3. Cancel mid-stream, verify it stops
4. Enable RAG, index notes, ask about a note's content
5. Add an MCP server, verify tools appear
6. Create a skill, verify it activates on relevant messages

- [ ] **Step 4: Commit**

```bash
git commit --allow-empty -m "milestone: AI intelligence features complete"
```
