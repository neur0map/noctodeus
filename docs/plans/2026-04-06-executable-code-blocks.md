# Executable Code Blocks — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Embed multi-tab executable code blocks in notes with persistent Python kernel and live web preview, featuring premium UI with anime.js animations.

**Architecture:** Rust backend manages persistent Python child processes per note via a KernelManager. Frontend has a custom TipTap node (`executableBlock`) rendering a tabbed code editor with expandable output drawer. Web blocks execute in sandboxed iframes. Communication via Tauri IPC commands.

**Tech Stack:** Rust (tokio, tauri), TipTap 3/ProseMirror, Svelte 5, anime.js, highlight.js/lowlight

**Spec:** `docs/specs/2026-04-06-executable-code-blocks-design.md`

---

## Chunk 1: Rust Kernel Engine

### Task 1: Create kernel module structure

**Files:**
- Create: `src-tauri/src/kernel/mod.rs`
- Create: `src-tauri/src/kernel/errors.rs`
- Create: `src-tauri/src/kernel/process.rs`
- Create: `src-tauri/src/kernel/protocol.rs`
- Create: `src-tauri/src/kernel/manager.rs`
- Modify: `src-tauri/src/lib.rs` — add `pub mod kernel;`

- [ ] **Step 1: Create `kernel/errors.rs`**

Define the error types for the kernel system:

```rust
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct KernelError {
    pub kind: String,       // "not_found", "spawn_failed", "execution_error", "timeout", "crashed"
    pub message: String,
    pub platform_hint: Option<String>,
}

impl KernelError {
    pub fn not_found() -> Self {
        let hint = if cfg!(target_os = "macos") {
            Some("brew install python3".into())
        } else if cfg!(target_os = "linux") {
            Some("sudo apt install python3".into())
        } else {
            Some("Download from https://python.org".into())
        };
        Self {
            kind: "not_found".into(),
            message: "Python 3 is not installed or not in PATH.".into(),
            platform_hint: hint,
        }
    }

    pub fn spawn_failed(msg: impl Into<String>) -> Self {
        Self { kind: "spawn_failed".into(), message: msg.into(), platform_hint: None }
    }

    pub fn execution_error(msg: impl Into<String>) -> Self {
        Self { kind: "execution_error".into(), message: msg.into(), platform_hint: None }
    }

    pub fn crashed(msg: impl Into<String>) -> Self {
        Self { kind: "crashed".into(), message: msg.into(), platform_hint: None }
    }

    pub fn timeout() -> Self {
        Self { kind: "timeout".into(), message: "Execution timed out.".into(), platform_hint: None }
    }
}

impl std::fmt::Display for KernelError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.kind, self.message)
    }
}

impl std::error::Error for KernelError {}
```

- [ ] **Step 2: Create `kernel/protocol.rs`**

Sentinel wrapping and output parsing:

```rust
/// Wrap user code in sentinel markers for output capture.
pub fn wrap_code(block_id: &str, code: &str) -> String {
    format!(
        r#"print("__NOCT_START_{bid}__")
try:
    exec("""{code}""")
except Exception as __noct_e:
    import traceback; traceback.print_exc()
print("__NOCT_END_{bid}__")
"#,
        bid = block_id,
        code = code.replace("\"\"\"", "\\\"\\\"\\\""),
    )
}

/// Parse captured output to extract content between sentinels.
pub fn parse_output(raw: &str, block_id: &str) -> Option<String> {
    let start = format!("__NOCT_START_{}__", block_id);
    let end = format!("__NOCT_END_{}__", block_id);

    let start_idx = raw.find(&start)?;
    let end_idx = raw.find(&end)?;

    let content_start = start_idx + start.len();
    if content_start >= end_idx {
        return Some(String::new());
    }

    Some(raw[content_start..end_idx].trim().to_string())
}
```

- [ ] **Step 3: Create `kernel/process.rs`**

The KernelHandle that manages a single Python child process:

```rust
use std::process::Stdio;
use tokio::process::{Child, Command};
use tokio::io::{AsyncWriteExt, AsyncReadExt, BufReader, AsyncBufReadExt};
use tokio::sync::Mutex;
use std::sync::Arc;
use std::time::Instant;
use crate::kernel::errors::KernelError;
use crate::kernel::protocol;

pub struct KernelHandle {
    child: Arc<Mutex<Child>>,
    stdin: Arc<Mutex<tokio::process::ChildStdin>>,
    stdout: Arc<Mutex<BufReader<tokio::process::ChildStdout>>>,
    stderr: Arc<Mutex<BufReader<tokio::process::ChildStderr>>>,
    pub started_at: Instant,
}

impl KernelHandle {
    pub async fn spawn() -> Result<Self, KernelError> {
        let mut child = Command::new("python3")
            .args(["-i", "-u"])
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true)
            .spawn()
            .map_err(|e| {
                if e.kind() == std::io::ErrorKind::NotFound {
                    KernelError::not_found()
                } else {
                    KernelError::spawn_failed(e.to_string())
                }
            })?;

        let stdin = child.stdin.take().ok_or_else(|| KernelError::spawn_failed("Failed to capture stdin"))?;
        let stdout = child.stdout.take().ok_or_else(|| KernelError::spawn_failed("Failed to capture stdout"))?;
        let stderr = child.stderr.take().ok_or_else(|| KernelError::spawn_failed("Failed to capture stderr"))?;

        tracing::info!("Python kernel spawned (pid: {:?})", child.id());

        Ok(Self {
            child: Arc::new(Mutex::new(child)),
            stdin: Arc::new(Mutex::new(stdin)),
            stdout: Arc::new(Mutex::new(BufReader::new(stdout))),
            stderr: Arc::new(Mutex::new(BufReader::new(stderr))),
            started_at: Instant::now(),
        })
    }

    pub async fn execute(&self, block_id: &str, code: &str) -> Result<ExecutionResult, KernelError> {
        let wrapped = protocol::wrap_code(block_id, code);
        let start = Instant::now();

        // Write to stdin
        {
            let mut stdin = self.stdin.lock().await;
            stdin.write_all(wrapped.as_bytes()).await
                .map_err(|e| KernelError::execution_error(e.to_string()))?;
            stdin.write_all(b"\n").await
                .map_err(|e| KernelError::execution_error(e.to_string()))?;
            stdin.flush().await
                .map_err(|e| KernelError::execution_error(e.to_string()))?;
        }

        // Read stdout until we see the end sentinel
        let end_marker = format!("__NOCT_END_{}__", block_id);
        let mut raw_output = String::new();

        {
            let mut stdout = self.stdout.lock().await;
            let mut line = String::new();
            loop {
                line.clear();
                match tokio::time::timeout(
                    std::time::Duration::from_secs(30),
                    stdout.read_line(&mut line),
                ).await {
                    Ok(Ok(0)) => {
                        return Err(KernelError::crashed("Python process exited unexpectedly"));
                    }
                    Ok(Ok(_)) => {
                        raw_output.push_str(&line);
                        if line.contains(&end_marker) {
                            break;
                        }
                    }
                    Ok(Err(e)) => {
                        return Err(KernelError::execution_error(e.to_string()));
                    }
                    Err(_) => {
                        return Err(KernelError::timeout());
                    }
                }
            }
        }

        // Try to read any stderr (non-blocking)
        let mut stderr_output = String::new();
        {
            let mut stderr = self.stderr.lock().await;
            let mut buf = [0u8; 4096];
            // Non-blocking read attempt
            match tokio::time::timeout(
                std::time::Duration::from_millis(50),
                stderr.read(&mut buf),
            ).await {
                Ok(Ok(n)) if n > 0 => {
                    stderr_output = String::from_utf8_lossy(&buf[..n]).to_string();
                }
                _ => {}
            }
        }

        let stdout = protocol::parse_output(&raw_output, block_id).unwrap_or_default();
        let duration_ms = start.elapsed().as_millis() as u64;

        Ok(ExecutionResult {
            stdout,
            stderr: stderr_output,
            duration_ms,
            success: stderr_output.is_empty(),
        })
    }

    pub async fn is_alive(&self) -> bool {
        let mut child = self.child.lock().await;
        matches!(child.try_wait(), Ok(None))
    }

    pub async fn kill(&self) {
        let mut child = self.child.lock().await;
        let _ = child.kill().await;
        tracing::info!("Python kernel killed");
    }

    pub fn pid(&self) -> Option<u32> {
        // Can't easily get pid from locked child without blocking
        // Return None for now — pid is logged on spawn
        None
    }

    pub fn uptime_seconds(&self) -> u64 {
        self.started_at.elapsed().as_secs()
    }
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct ExecutionResult {
    pub stdout: String,
    pub stderr: String,
    pub duration_ms: u64,
    pub success: bool,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct KernelStatus {
    pub running: bool,
    pub uptime_seconds: u64,
}
```

- [ ] **Step 4: Create `kernel/manager.rs`**

```rust
use std::collections::HashMap;
use tokio::sync::Mutex;
use crate::kernel::process::{KernelHandle, ExecutionResult, KernelStatus};
use crate::kernel::errors::KernelError;

pub struct KernelManager {
    kernels: Mutex<HashMap<String, KernelHandle>>,
}

impl KernelManager {
    pub fn new() -> Self {
        Self { kernels: Mutex::new(HashMap::new()) }
    }

    pub async fn start(&self, note_path: &str) -> Result<KernelStatus, KernelError> {
        let mut kernels = self.kernels.lock().await;

        // Kill existing kernel for this note if any
        if let Some(old) = kernels.remove(note_path) {
            old.kill().await;
        }

        let handle = KernelHandle::spawn().await?;
        let status = KernelStatus {
            running: true,
            uptime_seconds: 0,
        };
        kernels.insert(note_path.to_string(), handle);
        tracing::info!("Kernel started for note: {}", note_path);
        Ok(status)
    }

    pub async fn execute(&self, note_path: &str, block_id: &str, code: &str) -> Result<ExecutionResult, KernelError> {
        let kernels = self.kernels.lock().await;
        let handle = kernels.get(note_path)
            .ok_or_else(|| KernelError::execution_error("No kernel running for this note. Run a code block to start one."))?;

        if !handle.is_alive().await {
            return Err(KernelError::crashed("Python kernel has exited. Restart the kernel."));
        }

        handle.execute(block_id, code).await
    }

    pub async fn stop(&self, note_path: &str) {
        let mut kernels = self.kernels.lock().await;
        if let Some(handle) = kernels.remove(note_path) {
            handle.kill().await;
            tracing::info!("Kernel stopped for note: {}", note_path);
        }
    }

    pub async fn status(&self, note_path: &str) -> KernelStatus {
        let kernels = self.kernels.lock().await;
        match kernels.get(note_path) {
            Some(handle) => KernelStatus {
                running: handle.is_alive().await,
                uptime_seconds: handle.uptime_seconds(),
            },
            None => KernelStatus {
                running: false,
                uptime_seconds: 0,
            },
        }
    }

    pub async fn restart(&self, note_path: &str) -> Result<KernelStatus, KernelError> {
        self.stop(note_path).await;
        self.start(note_path).await
    }

    pub async fn stop_all(&self) {
        let mut kernels = self.kernels.lock().await;
        for (path, handle) in kernels.drain() {
            handle.kill().await;
            tracing::info!("Kernel stopped for note: {}", path);
        }
    }
}
```

- [ ] **Step 5: Create `kernel/mod.rs`**

```rust
pub mod errors;
pub mod manager;
pub mod process;
pub mod protocol;
```

- [ ] **Step 6: Register kernel module and add KernelManager to app state**

Modify `src-tauri/src/lib.rs`: add `pub mod kernel;`

Modify `src-tauri/src/core/state.rs` (or wherever `AppState` is defined): add `KernelManager` as a field.

If `AppState` doesn't hold the kernel manager directly, add it as a separate Tauri managed state: `.manage(kernel::manager::KernelManager::new())`

- [ ] **Step 7: Verify compilation**

Run: `cd src-tauri && cargo check`
Expected: compiles with no errors.

- [ ] **Step 8: Commit**

```bash
git add src-tauri/src/kernel/ src-tauri/src/lib.rs
git commit -m "feat: add Rust kernel engine for persistent Python process management"
```

---

### Task 2: Create Tauri IPC commands for kernel

**Files:**
- Create: `src-tauri/src/commands/kernel.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs` (register commands)

- [ ] **Step 1: Create `commands/kernel.rs`**

```rust
use tauri::State;
use crate::kernel::manager::KernelManager;
use crate::kernel::process::{ExecutionResult, KernelStatus};
use crate::kernel::errors::KernelError;

#[tauri::command]
pub async fn kernel_start(
    note_path: String,
    manager: State<'_, KernelManager>,
) -> Result<KernelStatus, KernelError> {
    manager.start(&note_path).await
}

#[tauri::command]
pub async fn kernel_execute(
    note_path: String,
    block_id: String,
    code: String,
    manager: State<'_, KernelManager>,
) -> Result<ExecutionResult, KernelError> {
    manager.execute(&note_path, &block_id, &code).await
}

#[tauri::command]
pub async fn kernel_stop(
    note_path: String,
    manager: State<'_, KernelManager>,
) -> Result<(), ()> {
    manager.stop(&note_path).await;
    Ok(())
}

#[tauri::command]
pub async fn kernel_status(
    note_path: String,
    manager: State<'_, KernelManager>,
) -> Result<KernelStatus, ()> {
    Ok(manager.status(&note_path).await)
}

#[tauri::command]
pub async fn kernel_restart(
    note_path: String,
    manager: State<'_, KernelManager>,
) -> Result<KernelStatus, KernelError> {
    manager.restart(&note_path).await
}
```

- [ ] **Step 2: Register in `commands/mod.rs`**

Add `pub mod kernel;` and `pub use self::kernel::*;`

- [ ] **Step 3: Register commands in `lib.rs`**

Add to the `invoke_handler` macro:
```rust
commands::kernel_start,
commands::kernel_execute,
commands::kernel_stop,
commands::kernel_status,
commands::kernel_restart,
```

Also add `.manage(kernel::manager::KernelManager::new())` to the builder.

- [ ] **Step 4: Verify compilation**

Run: `cd src-tauri && cargo check`

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands/ src-tauri/src/lib.rs
git commit -m "feat: add Tauri IPC commands for kernel management"
```

---

### Task 3: Create frontend bridge functions for kernel

**Files:**
- Modify: `src/lib/bridge/commands.ts`
- Create: `src/lib/types/kernel.ts`

- [ ] **Step 1: Create `types/kernel.ts`**

```typescript
export interface ExecutionResult {
  stdout: string;
  stderr: string;
  duration_ms: number;
  success: boolean;
}

export interface KernelStatus {
  running: boolean;
  uptime_seconds: number;
}

export interface KernelError {
  kind: 'not_found' | 'spawn_failed' | 'execution_error' | 'timeout' | 'crashed';
  message: string;
  platform_hint?: string;
}
```

- [ ] **Step 2: Add kernel commands to `bridge/commands.ts`**

```typescript
import type { ExecutionResult, KernelStatus } from '../types/kernel';

export async function kernelStart(notePath: string): Promise<KernelStatus> {
  return invoke("kernel_start", { notePath });
}

export async function kernelExecute(notePath: string, blockId: string, code: string): Promise<ExecutionResult> {
  return invoke("kernel_execute", { notePath, blockId, code });
}

export async function kernelStop(notePath: string): Promise<void> {
  return invoke("kernel_stop", { notePath });
}

export async function kernelStatus(notePath: string): Promise<KernelStatus> {
  return invoke("kernel_status", { notePath });
}

export async function kernelRestart(notePath: string): Promise<KernelStatus> {
  return invoke("kernel_restart", { notePath });
}
```

- [ ] **Step 3: Verify**

Run: `npm run check`

- [ ] **Step 4: Commit**

```bash
git add src/lib/bridge/commands.ts src/lib/types/kernel.ts
git commit -m "feat: add frontend bridge functions for kernel IPC"
```

---

## Chunk 2: Frontend Code Block Components

### Task 4: Create code block types and component structure

**Files:**
- Create: `src/lib/components/codeblock/types.ts`
- Create: `src/lib/components/codeblock/ExecutableBlock.svelte`
- Create: `src/lib/components/codeblock/CodeTabBar.svelte`
- Create: `src/lib/components/codeblock/CodeEditor.svelte`
- Create: `src/lib/components/codeblock/OutputDrawer.svelte`
- Create: `src/lib/components/codeblock/LanguagePicker.svelte`
- Create: `src/lib/components/codeblock/ErrorCard.svelte`
- Create: `src/lib/components/codeblock/StatusDot.svelte`

This task creates the component files with their interfaces. Full implementations follow in subsequent tasks.

- [ ] **Step 1: Create `types.ts`**

```typescript
export interface CodeTab {
  id: string;
  name: string;
  language: 'python' | 'html' | 'css' | 'js';
  content: string;
}

export interface ExecutableBlockData {
  tabs: CodeTab[];
  activeTabId: string;
  output: string;
  stderr: string;
  executionCount: number;
  status: 'idle' | 'running' | 'success' | 'error';
  drawerOpen: boolean;
}

export const SUPPORTED_LANGUAGES = [
  { id: 'python', label: 'Python', ext: '.py', icon: '\ue73e' },
  { id: 'html', label: 'HTML', ext: '.html', icon: '\ue736' },
  { id: 'css', label: 'CSS', ext: '.css', icon: '\ue749' },
  { id: 'js', label: 'JavaScript', ext: '.js', icon: '\ue74e' },
] as const;

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number]['id'];
```

- [ ] **Step 2: Create component stubs for all 7 components**

Each component gets a minimal stub with its prop interface. Full implementation in Tasks 5-8.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/codeblock/
git commit -m "feat: create code block component structure and types"
```

---

### Task 5: Implement ExecutableBlock, CodeTabBar, LanguagePicker

The main container component, tab management, and language selection.

**Files:**
- Modify: `src/lib/components/codeblock/ExecutableBlock.svelte`
- Modify: `src/lib/components/codeblock/CodeTabBar.svelte`
- Modify: `src/lib/components/codeblock/LanguagePicker.svelte`

ExecutableBlock manages:
- Tab state (add, remove, rename, switch, reorder)
- Run action (collects code from tabs, sends to kernel or iframe)
- Output state (stdout, stderr, status, drawer open/close)
- Execution counter

CodeTabBar renders:
- Tab buttons with filename + language indicator
- Active tab: brighter text (established pattern)
- "+" button to add new tab
- Tab context: click ▾ dropdown for rename/change language/delete
- Glow-trace on the active tab

LanguagePicker:
- Small dropdown showing supported languages
- Shows on new tab creation and from tab context menu

- [ ] **Step 1-5: Implement each component, verify with `npm run check`, commit**

```bash
git commit -m "feat: implement ExecutableBlock container with tab management"
```

---

### Task 6: Implement CodeEditor with syntax highlighting

**Files:**
- Modify: `src/lib/components/codeblock/CodeEditor.svelte`

A code editing pane with:
- Syntax highlighting via lowlight (already in the app for regular code blocks)
- Line numbers in `text-faint`
- Tab key inserts 2 spaces (not focus change)
- Monospace font (`--font-mono`)
- `surface-1` background
- Cmd+Enter triggers Run (bubbles event to parent)

- [ ] **Steps: Implement, verify, commit**

```bash
git commit -m "feat: implement CodeEditor with syntax highlighting and line numbers"
```

---

### Task 7: Implement OutputDrawer with animations

**Files:**
- Modify: `src/lib/components/codeblock/OutputDrawer.svelte`
- Modify: `src/lib/components/codeblock/ErrorCard.svelte`
- Modify: `src/lib/components/codeblock/StatusDot.svelte`

OutputDrawer:
- Collapsed: 28px bar, "Output" label, chevron, anime.js spring toggle
- Expanded: scrollable text for Python, iframe for Web
- Auto-expands on Run
- Resizable via drag handle
- ANSI color support for Python output (map to theme accent tokens)

ErrorCard:
- Python-not-found card with icon, heading, platform install command
- Kernel crashed card with restart button
- anime.js fade-in entrance

StatusDot:
- Tiny circle: gray idle, pulsing blue running, green success, red error
- CSS breathing animation

- [ ] **Steps: Implement all three, verify, commit**

```bash
git commit -m "feat: implement OutputDrawer, ErrorCard, StatusDot with animations"
```

---

### Task 8: Create TipTap extension for executable blocks

**Files:**
- Create: `src/lib/editor/extensions/executableBlock.ts`
- Modify: `src/lib/editor/Editor.svelte` (register extension)
- Modify: `src/lib/editor/serializer.ts` (markdown serialization)

The TipTap extension:
- Registers `executableBlock` node type
- Node attributes: `tabs` (JSON array), `activeTabId`, `executionCount`
- Node view: renders `ExecutableBlock.svelte` component
- Input rule: typing ` ```exec ` and Enter creates an executable block
- Slash command: add "Code Block (Executable)" to the slash menu

Serializer:
- Parse: detect ` ```exec\n--- filename [lang] ---\n... ` pattern → create `executableBlock` node
- Serialize: convert `executableBlock` node → ` ```exec\n--- filename [lang] ---\n... ` markdown

- [ ] **Steps: Implement extension, register, add serialization, verify, commit**

```bash
git commit -m "feat: add TipTap extension for executable code blocks with markdown serialization"
```

---

## Chunk 3: Integration & Polish

### Task 9: Wire kernel lifecycle to note open/close

**Files:**
- Modify: `src/routes/+page.svelte` or `+layout.svelte`

When a note with `:exec` blocks is opened:
- Start kernel via `kernelStart(notePath)`
- On note close/switch: `kernelStop(notePath)`

Add kernel status to the PanelModal's Kernel tab (new tab alongside Statistics/Outline/Backlinks).

- [ ] **Steps: Wire lifecycle, add kernel tab to PanelModal, commit**

```bash
git commit -m "feat: wire kernel lifecycle to note open/close, add kernel debug tab"
```

---

### Task 10: Web execution (iframe preview)

**Files:**
- Modify: `src/lib/components/codeblock/OutputDrawer.svelte`
- Modify: `src/lib/components/codeblock/ExecutableBlock.svelte`

When a block has web tabs (html/css/js), Run:
1. Combines all HTML tabs as body content
2. Wraps CSS tabs in `<style>` tags
3. Wraps JS tabs in `<script>` tags (with console override to capture logs)
4. Renders in a sandboxed iframe in the output drawer
5. Console tab shows captured `console.log/warn/error` output

- [ ] **Steps: Implement web runner, add console capture, commit**

```bash
git commit -m "feat: add web execution with iframe preview and console capture"
```

---

### Task 11: Premium animations and visual polish

**Files:**
- Modify: all `src/lib/components/codeblock/*.svelte`

Apply `/frontend-design` principles:
- Block entrance: anime.js fade + scale
- Run button: morph ▶ → spinner → ✓/✗
- Output drawer: spring height animation
- Tab switch: subtle cross-fade
- Error card: fade-in entrance
- Status dot: CSS breathing animation
- Focused block: glow-trace border
- Code area: subtle left accent border when focused

- [ ] **Steps: Add animations to each component, commit**

```bash
git commit -m "feat: add premium anime.js animations to code block components"
```

---

### Task 12: Slash command integration and final testing

**Files:**
- Modify: `src/lib/editor/SlashCommandMenu.svelte`
- Modify: `TODO.md`

Add "Executable Code Block" to the slash command menu (type `/exec` or `/code`).

Full manual test:
- [ ] Create an executable block via slash command
- [ ] Add Python tabs, run, see output
- [ ] Add web tabs (HTML + CSS + JS), run, see iframe preview
- [ ] Variables persist across blocks in same note
- [ ] Close note, reopen — kernel restarts, blocks preserved
- [ ] Python not installed — error card shows with install guidance
- [ ] Kernel crash — restart button works
- [ ] Cmd+Enter runs from within code editor
- [ ] Output drawer collapse/expand/resize works
- [ ] Mark "Executable code blocks" as done in TODO.md

- [ ] **Commit**

```bash
git commit -m "feat: add executable code blocks to slash command menu, mark TODO complete"
```

---

## Summary

| Chunk | Tasks | Focus |
|-------|-------|-------|
| 1 | 1-3 | Rust kernel engine + IPC + bridge |
| 2 | 4-8 | Frontend components + TipTap extension |
| 3 | 9-12 | Integration, web execution, polish |

**Total tasks:** 12
**Key risk:** The TipTap node view integration (Task 8) is the most complex — ProseMirror node views with Svelte components require careful lifecycle management.
