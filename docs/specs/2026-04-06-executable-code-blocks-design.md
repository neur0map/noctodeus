# Executable Code Blocks

**Date:** 2026-04-06
**Status:** Approved

## Problem

Noctodeus is a note-taking app for technical minds — developers, researchers, hackers, students. These users write notes about code but can't run it. They have to switch to a terminal or REPL to test what they're writing about. The "creative IDE for thought" vision means notes should be alive — you write prose, then write code, then run it right there.

## Goal

Embed executable code blocks in notes. Each block is a multi-tab container where the user creates files (Python scripts, HTML/CSS/JS pages), runs them, and sees output in an expandable drawer below — all inline in the note flow. Python uses a persistent kernel per note (variables carry across blocks, like Jupyter). Web blocks render in a sandboxed iframe.

## Languages (V1)

- **Python** — via system `python3`, persistent kernel per note
- **Web** — HTML + CSS + JS combined into an iframe preview

Architecture designed for easy addition of future languages (Rust, Go, Bash, etc.).

---

## 1. Code Block Structure

Each executable block is a custom TipTap node — a tabbed container with a code editor, and an output drawer.

### Tabs

- Each tab represents a file: a name + a language
- User adds tabs with a "+" button
- Each tab has a language selector (small dropdown): `python`, `html`, `css`, `js`
- Tabs can be renamed, reordered, deleted
- The active tab's code is shown in the editor

### Tab Connection on Execution

**Python tabs:** Concatenated in tab order and executed as one script in the persistent kernel. Tab 1 defines `x = 5`, Tab 2 can use `x` within the same block. Across blocks in the same note, the kernel persists — variables carry over.

**Web tabs:** All `.html`, `.css`, `.js` tabs combined into one page. HTML as body content, CSS in `<style>`, JS in `<script>`. Rendered in a sandboxed iframe in the output drawer.

**Mixed Python + Web:** Python runs first. If stdout contains HTML markup (detected by `<html>`, `<div>`, or `<!doctype>` prefix), output renders as an iframe instead of text.

### Visual Layout

```
┌──────────────────────────────────────────────────────────┐
│  [main.py ▾]  [utils.py ▾]  [+]            ▶ Run   [1] │
├──────────────────────────────────────────────────────────┤
│                                                          │
│   (syntax-highlighted code editor for active tab)        │
│                                                          │
├──────────────────────────────────────────────────────────┤
│  ▸ Output                                                │
└──────────────────────────────────────────────────────────┘
```

---

## 2. Execution Engine (Rust Backend)

### Persistent Python Kernel

A long-running `python3 -i -u` child process per note. Managed by the Rust backend.

| Event | Action |
|-------|--------|
| Open note with `:exec` blocks | Spawn `python3 -i -u`, store handle keyed by note path |
| Run a block | Write code to stdin with sentinel delimiters. Capture stdout/stderr between sentinels. Stream back via IPC. |
| Run another block | Same process — variables persist |
| Close/switch note | SIGTERM → wait 2s → SIGKILL. Clean up handle. |
| Process crash | Detect exit. Show restart prompt with error details. |
| App quit | Kill all child processes |

### Sentinel Protocol

```python
# Rust wraps user code before sending to stdin:
print("__NOCT_START_{block_id}__")
try:
    exec("""
{user_code}
""")
except Exception as __e:
    import traceback; traceback.print_exc()
print("__NOCT_END_{block_id}__")
```

Rust captures everything between START and END as that block's output. Stderr captured in parallel via separate pipe.

### Web Execution

No backend needed. Frontend combines the HTML/CSS/JS tabs and renders in a sandboxed iframe with `sandbox="allow-scripts"`. Console output captured via injected `console` override script.

### Directory Structure (Rust)

```
src-tauri/src/
├── kernel/
│   ├── mod.rs          — public API: start, execute, stop, status, restart
│   ├── manager.rs      — KernelManager: HashMap<String, KernelHandle>
│   ├── process.rs      — KernelHandle: spawn, write, read, kill
│   ├── protocol.rs     — Sentinel wrapping, output parsing
│   └── errors.rs       — KernelError enum, Python-not-found detection
```

### Tauri IPC Commands

| Command | Args | Returns |
|---------|------|---------|
| `kernel_start` | `note_path` | `Result<KernelInfo, KernelError>` |
| `kernel_execute` | `note_path, block_id, code` | `Result<ExecutionResult, KernelError>` |
| `kernel_stop` | `note_path` | `()` |
| `kernel_status` | `note_path` | `KernelStatus` |
| `kernel_restart` | `note_path` | `Result<KernelInfo, KernelError>` |

```typescript
interface ExecutionResult {
  stdout: string;
  stderr: string;
  duration_ms: number;
  success: boolean;
}

interface KernelStatus {
  running: boolean;
  pid: number | null;
  uptime_seconds: number;
}

interface KernelError {
  kind: 'not_found' | 'spawn_failed' | 'execution_error' | 'timeout' | 'crashed';
  message: string;
  platform_hint?: string; // "brew install python3" on macOS
}
```

---

## 3. Frontend Components

### Directory Structure (Svelte)

```
src/lib/components/codeblock/
├── ExecutableBlock.svelte     — TipTap node view wrapper, manages tabs + state
├── CodeTab.svelte             — single tab: name, language, code content
├── CodeTabBar.svelte          — tab bar with +/rename/reorder/delete
├── CodeEditor.svelte          — syntax-highlighted editor pane
├── OutputDrawer.svelte        — expandable drawer: text output or iframe preview
├── LanguagePicker.svelte      — small dropdown for selecting tab language
├── ErrorCard.svelte           — Python-not-found and crash recovery UI
├── StatusDot.svelte           — tiny animated status indicator
└── types.ts                   — interfaces for ExecutableBlockData, CodeTabData
```

### TipTap Integration

Custom node type `executableBlock` registered as a TipTap extension:
- Node schema defines attributes: `tabs` (array of tab data), `output` (last execution output), `executionCount` (number)
- Node view renders `ExecutableBlock.svelte` as the visual component
- Serializes to/from markdown via custom serializer rules

### Component Details

**ExecutableBlock.svelte** — the main container:
- Manages tab state (active tab, add/remove/rename)
- Handles Run action: collects code from all tabs, sends to kernel or iframe
- Manages output drawer open/close state
- Keyboard: Cmd+Enter to run when any code area is focused

**CodeTabBar.svelte** — tab bar:
- Renders tabs with filename + language icon
- "+" button opens a new tab with `LanguagePicker`
- Tab context menu (click ▾): rename, change language, delete
- Drag to reorder

**CodeEditor.svelte** — code pane:
- Wraps a `<textarea>` or a minimal code editor with syntax highlighting
- Uses existing lowlight (highlight.js) for syntax coloring
- Line numbers
- Tab key inserts spaces (not focus change)

**OutputDrawer.svelte** — expandable output:
- Collapsed: 28px bar, "Output" label, chevron icon
- Expanded: shows content, resizable via drag handle
- Python mode: scrollable monospace text with ANSI color support
- Web mode: sandboxed iframe + console output tab
- Auto-expands on Run with anime.js spring animation
- Clear button to reset output

**ErrorCard.svelte** — premium error state:
- Python not found: icon + heading + body + platform-specific install command
- Kernel crashed: error message + "Restart Kernel" button
- Styled as a card, not a raw error dump. anime.js fade-in.

**StatusDot.svelte** — tiny indicator:
- Gray (idle), pulsing blue (running), green (success), red (error)
- Breathing animation when running via CSS

---

## 4. Visual Design

### Block Appearance

- Rounded container (12px radius), `surface-1` background
- Subtle left border: `2px solid` at `border-subtle`, shifts to `accent-blue` when focused
- Block header (tab bar area): slightly darker than code area
- Glow-trace animation on the active/focused block

### Tab Bar

- Tabs: monospace filename, small language icon (Nerd Font or Lucide)
- Active tab: brighter text (our established pattern — no background rectangles)
- "+" button: muted, monospace "+"
- Run button: `▶` icon, accent-blue on hover. Morphs to spinner → checkmark via anime.js
- Execution counter: `[n]` muted monospace, right-aligned

### Output Drawer

- Collapsed bar: `surface-2` background, "Output" in muted monospace, chevron
- Expanded: smooth spring animation
- Text output: monospace, theme-appropriate colors for ANSI
- Iframe preview: white background with subtle border, rounded corners
- Resize handle: thin line at bottom, cursor changes on hover

### Animations (anime.js)

| Moment | Animation |
|--------|-----------|
| Block appears | Fade in + scale 0.98 → 1 |
| Run clicked | ▶ morphs to spinner (rotate). Status dot pulses blue. |
| Output arrives | Drawer expands with spring animation. Text streams in. |
| Execution complete | Spinner → ✓ (scale pop). Status dot → green. |
| Error | Spinner → ✗. Status dot → red. Error card fades in. |
| Drawer toggle | Spring height animation |
| Tab switch | Code area cross-fades |

### Error Card

- `surface-2` background, rounded, icon + heading + body
- "Python not found" — install guidance with platform-specific command
- "Kernel crashed" — error + restart button
- Not a red banner — informative, styled, anime.js entrance

---

## 5. Markdown Serialization

Each executable block serializes as a single fenced block with `exec` language tag:

````markdown
```exec
--- main.py [python] ---
import math
print(math.pi)

--- utils.py [python] ---
def helper():
    return 42
```
````

Web example:

````markdown
```exec
--- index.html [html] ---
<h1>Hello World</h1>
<p id="output"></p>

--- style.css [css] ---
h1 { color: coral; font-family: monospace; }

--- app.js [js] ---
document.getElementById('output').textContent = 'Loaded!';
```
````

Parser rules:
- `--- filename [lang] ---` delimiter separates tabs
- Filename and language extracted from the delimiter
- Content between delimiters is the tab's code
- The `exec` language tag triggers TipTap to render as `ExecutableBlock` instead of regular code block

---

## 6. Logging & Debug

### Rust-side (tracing)

- `info`: kernel spawn, kill, restart
- `debug`: code sent to stdin, output captured, timing
- `error`: spawn failures, crashes, timeouts
- All logs go through the existing `tracing` + `tracing-appender` setup (file rotation in `.noctodeus/logs/`)

### User-facing — Kernel tab in PanelModal

New tab in the PanelModal (alongside Statistics/Outline/Backlinks):

- **Kernel status**: running/stopped, PID, uptime
- **Execution history**: list of recent executions (block ID, duration, success/fail)
- **Last error**: full error message if kernel crashed
- **Restart Kernel** button
- **Clear History** button

---

## 7. Language Plugin Architecture

The kernel system is designed for future language additions. Each language is a "runner" that implements:

```typescript
interface LanguageRunner {
  id: string;                    // 'python', 'web', 'rust', etc.
  name: string;                  // 'Python', 'Web (HTML/CSS/JS)', etc.
  extensions: string[];          // ['.py'], ['.html', '.css', '.js']
  icon: string;                  // Nerd Font glyph or Lucide icon name
  mode: 'kernel' | 'oneshot' | 'browser';  // persistent, per-run, or in-browser
  checkAvailability(): Promise<boolean>;
  getInstallHint(): string;
}
```

- `kernel` mode: persistent process (Python, future: Julia, R)
- `oneshot` mode: fresh process per run (future: Rust `cargo run`, Go `go run`)
- `browser` mode: runs in WebView (Web/JS, future: WASM languages)

For V1, two runners: `PythonRunner` and `WebRunner`. The architecture is ready for more.

---

## 8. Out of Scope (V1)

- Rich output (matplotlib plots, DataFrames as tables) — future enhancement
- Interactive widgets / live bindings
- File system access from code blocks
- Multi-note kernel sharing
- Code block version history
- Collaborative editing of code blocks
- Package manager integration (pip install from UI)
