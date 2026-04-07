# GitHub Sync — Design Spec

## Goal

Add a sync feature to Noctodeus that lets users push and pull their cores to a GitHub repository. Sync is manual (single button), trustworthy (zero data loss), and extensible to other backends later.

## Principles

- **Local-first** — user's files are always the source of truth. Sync repo is a disposable staging area.
- **Zero data loss** — conflicts are resolved by forking, never by overwriting.
- **No git terminology** — the user sees "Sync," not "commit," "rebase," or "merge."
- **One button** — a single smart Sync button handles pull, push, retries, and error recovery.

---

## Architecture

### Sync Backend Trait

```rust
#[async_trait]
pub trait SyncBackend: Send + Sync {
    async fn init(&self, config: &SyncConfig) -> Result<(), SyncError>;
    async fn push(&self, cores: &[SyncCore]) -> Result<PushResult, SyncError>;
    async fn pull(&self, cores: &[SyncCore]) -> Result<PullResult, SyncError>;
    async fn status(&self) -> Result<SyncStatus, SyncError>;
}
```

Methods are async (via `async-trait` crate). Git CLI calls are wrapped in `tokio::task::spawn_blocking` internally to avoid blocking the async runtime.

v1 ships `GitHubSync` which implements this trait using the git CLI. Future backends (S3, WebDAV, etc.) implement the same trait.

### Git CLI, Not libgit2

Sync shells out to the `git` binary. Reasons:
- Battle-tested, handles auth natively (credential helpers, PATs)
- `libgit2`/`git2-rs` has incomplete support for modern features and painful auth
- Proven pattern (Obsidian Git, VSCode, etc.)

### Prerequisite: Git Must Be Installed

On `sync_setup`, run `git --version` as a preflight check. If git is not found, show a clear message: "Git is required for sync. Install it from git-scm.com." On macOS this may trigger the Xcode command-line tools prompt, which is acceptable.

### Module Layout

```
src-tauri/src/sync/
├── mod.rs         — SyncBackend trait, SyncConfig, SyncError, public API, concurrency guard
├── git.rs         — git CLI wrapper (clone, fetch, push, commit, merge-file, status, diff)
├── github.rs      — GitHubSync implements SyncBackend
├── manifest.rs    — sync.toml read/write (core registry within repo)
├── copy.rs        — bidirectional file copy (core path ↔ repo subdirectory) with mtime guards
└── conflict.rs    — three-way merge via git merge-file + fork-on-conflict fallback
```

### Concurrency Guard

A `tokio::sync::Mutex<()>` is held for the duration of any sync operation. If the user clicks Sync while a sync is in progress, the command returns immediately with "Sync already in progress." This prevents two git operations from racing on the same clone directory.

---

## Repo Structure

One GitHub repo holds multiple cores as subdirectories:

```
noctodeus-vault/                  # user's GitHub repo
├── .noctodeus-sync/
│   ├── sync.toml                 # manifest: lists synced cores
│   └── .gitignore                # excludes DB, logs, cache
├── my-vault/
│   ├── .noctodeus/
│   │   └── config.toml
│   ├── notes/
│   ├── journal/
│   └── media/
└── work-notes/
    ├── .noctodeus/
    │   └── config.toml
    └── projects/
```

### sync.toml

```toml
[sync]
version = 1
created_at = "2026-04-07T16:00:00Z"

[[cores]]
id = "550e8400-..."
name = "my-vault"
path = "my-vault"
added_at = "2026-04-07T16:00:00Z"

[[cores]]
id = "7a2b3c4d-..."
name = "work-notes"
path = "work-notes"
added_at = "2026-04-08T10:00:00Z"
```

During pull, validate that each `sync.toml` entry's `id` matches the `config.toml` inside the corresponding core subdirectory. If they diverge, surface an error rather than proceeding with mismatched identities.

### .gitignore

```
**/.noctodeus/meta.db
**/.noctodeus/meta.db-wal
**/.noctodeus/meta.db-shm
**/.noctodeus/logs/
**/.noctodeus/cache/
```

### What Gets Synced

| Synced | Excluded |
|--------|----------|
| All user content files (markdown, media, etc.) | `.noctodeus/meta.db` + WAL/SHM |
| `.noctodeus/config.toml` | `.noctodeus/logs/` |
| `.noctodeus-sync/sync.toml` | `.noctodeus/cache/` |

The SQLite database is a derived index rebuilt from files on every `core_scan`. It is never synced.

**Media note:** Large binary files (images, video) will be committed normally. Git is not ideal for large binaries — repo size will grow. For v1, warn in the UI when repo size approaches 500MB. Git-LFS is a future consideration.

---

## Local Clone Location

The git repo clone lives in app data, separate from the user's vault paths:

```
~/Library/Application Support/com.noctodeus.app/
├── cores.json
├── sync.json              # app-level sync config (NOT per-core)
├── logs/
└── sync/
    └── noctodeus-vault/   # the git clone
        ├── .git/
        ├── .noctodeus-sync/
        ├── my-vault/
        └── work-notes/
```

### Why Separate From the Vault?

- Cores live at user-chosen paths (different drives, Dropbox, etc.) — can't be inside one git tree
- Multiple cores share one repo
- `.git/` never appears in the user's note folders
- If sync breaks, user's files are untouched — the clone is disposable and can be re-cloned

### Copy-Based Staging

- **Push:** copy files from core's local path → repo subdirectory → commit → push
- **Pull:** fetch → merge → copy changed files from repo subdirectory → core's local path (with mtime guards)

---

## Sync State Storage

Sync configuration is **app-level, not per-core**. It lives in `sync.json` alongside `cores.json` in the app data directory:

```json
{
  "remote_url": "https://github.com/user/noctodeus-vault.git",
  "repo_local_path": "/Users/.../com.noctodeus.app/sync/noctodeus-vault",
  "last_push_at": "2026-04-07T16:30:00Z",
  "last_pull_at": "2026-04-07T16:30:00Z",
  "synced_core_ids": ["550e8400-...", "7a2b3c4d-..."]
}
```

Auth token is stored in OS keychain (via `tauri-plugin-stronghold` or equivalent), NOT in `sync.json` or SQLite.

Per-core sync enable/disable is derived from `synced_core_ids` in `sync.json` cross-referenced with `sync.toml` in the repo.

**No V3 migration to meta.db.** Sync state does not belong in the per-core database.

---

## Sync Operations

### Smart Sync Button (Single Click)

One button does pull-then-push. The operation handles edge cases automatically:

| Problem | Auto-resolution |
|---------|----------------|
| Remote ahead | Pull first, then push |
| Diverged histories | Reset-and-reapply strategy (see Pull Flow) |
| File conflicts | Fork conflicted files (see Conflict Resolution) |
| Push rejected after pull | Retry push (max 3 attempts) |
| Network offline | Toast "No connection" |
| Auth expired/invalid | Toast "Check GitHub token in Settings" |
| Dirty state from prior failure | Smart recovery (see Error Recovery) |
| Unborn branch (fresh repo) | Initial commit + push |

### Push Flow

1. Acquire sync mutex
2. For each synced core: copy changed files from core path → repo subdirectory
3. `git add -A` (stages additions, modifications, AND deletions)
4. If nothing to commit (`git status --porcelain` is empty), skip
5. Commit: `sync: my-vault, work-notes @ 2026-04-07T16:30:00Z`
6. `git push origin main`
7. If rejected, switch to pull-then-push
8. Release sync mutex

### Pull Flow (Reset-and-Reapply Strategy)

This avoids the complexity of `git rebase` and gives full control over conflict resolution:

1. Acquire sync mutex
2. `git fetch origin main`
3. If `origin/main` == `HEAD`, nothing to pull — done
4. Compute diff: `git diff --name-status -M HEAD origin/main` to identify changed, deleted, and renamed files
5. **Snapshot local changes:** for each synced core, hash the files currently in the repo subdirectory (these are the files from the last sync)
6. **Reset to remote:** `git reset --hard origin/main`
7. **Re-apply local changes:** for each file that was locally modified (different from the snapshot taken at last sync):
   - If the file was NOT changed on remote → copy local version into repo, stage it
   - If the file WAS also changed on remote → run `git merge-file` three-way merge:
     - Ancestor = snapshot version (last synced state)
     - Ours = local version (from core path)
     - Theirs = remote version (now in repo after reset)
     - If merge succeeds → use merged result
     - If merge has conflicts → fork (see Conflict Resolution)
8. **Handle deletions:** for files with status `D` in the diff, delete them from the core path (move to OS trash via the `trash` crate, consistent with existing delete behavior)
9. **Handle renames:** for files with status `R` in the diff (detected via `-M` flag), rename the file in the core path rather than delete + create
10. **Copy back to core paths:** copy changed files from repo subdirectory → core paths, with mtime guard (see Race Condition Protection)
11. Commit any re-applied local changes
12. `git push origin main`
13. Update `sync.json` timestamps
14. Trigger `core_scan` for affected cores to rebuild DB index
15. Release sync mutex

### Race Condition Protection

During the copy-back phase (pull step 10), the user may edit a file in the core path. To prevent overwriting their edits:

1. Before overwriting a file in the core path, snapshot its current `mtime` and `content_hash`
2. Compare against the values recorded when sync started
3. If the file changed since sync started, treat it as a new conflict — apply fork-on-conflict instead of overwriting
4. The file watcher is NOT paused during sync — instead, this mtime check provides a non-blocking safety net

---

## Conflict Resolution

### Three-Way Merge With Fork Fallback

1. Get the common ancestor version (snapshot from last sync)
2. Attempt `git merge-file --diff3 local_version ancestor_version remote_version`
3. If merge succeeds cleanly (exit code 0) → use merged result
4. If merge has conflicts (exit code > 0) → **fork**:
   - Keep remote version as `note.md`
   - Save local version as `note.conflict-2026-04-07.md`
   - Add both to the repo
   - Copy both back to the core's local path
   - Toast: "Conflict in note.md — your version saved as note.conflict-2026-04-07.md"

### Why Remote Wins + Local Forked

- Remote version is already published — other devices may reference it
- Local version is preserved with zero data loss
- No merge markers pollute any file
- The `.conflict` file appears in the file tree immediately — visible, not hidden

---

## Authentication

### v1: Personal Access Token (PAT)

- User generates a fine-grained PAT on GitHub with repo read/write scope
- Pastes token in Settings → Sync
- Token stored securely in OS keychain (via `tauri-plugin-stronghold` or equivalent)

### Secure Token Usage

The token is NEVER embedded in `.git/config` or remote URLs. Instead, use `GIT_ASKPASS`:

1. On sync setup, write a tiny helper script to a temp file that echoes the token
2. Set `GIT_ASKPASS=/path/to/helper` environment variable for all git commands
3. This prevents the token from appearing in `.git/config`, `git reflog`, process arguments, or error messages

### Future: OAuth Device Flow

The `SyncBackend` trait abstracts auth — adding OAuth is a new implementation without changing the sync logic.

---

## UI

### Settings: New Sync Tab

- GitHub PAT input (masked, with "Test connection" button)
- Repo URL field + "Connect existing" / "Create new repo" buttons
- List of cores with per-core sync enable/disable toggle
- Last sync timestamp display

### Sidebar Footer: Sync Button

Single button with 4 visual states:
- **Idle** (checkmark) — everything synced
- **Pending** (dot indicator) — local changes not yet pushed
- **Syncing** (spinner) — operation in progress
- **Error** (warning icon) — last sync failed, click to retry

### Command Palette

- `Sync Now` — same as clicking the button
- `Sync: Push Only` — commit + push without pulling
- `Sync: Pull Only` — fetch + merge without pushing
- `Sync: Open Settings` — jump to sync tab

### Toast Notifications

User-facing messages, no git terminology:
- "Synced — 3 files updated"
- "Conflict in note.md — your version saved as note.conflict-2026-04-07.md"
- "Sync failed — check your internet connection"
- "Sync failed — check your GitHub token in Settings"

---

## Tauri Commands

```
sync_setup         — preflight (git check), configure repo URL + PAT, clone repo, create sync.toml
sync_status        — returns current state (synced, pending, behind, error)
sync_push          — copy local → repo → commit → push
sync_pull          — fetch → merge → copy repo → local, returns changes
sync_smart         — the full pull-then-push with auto-recovery (what the button calls)
sync_enable_core   — add a core to sync.toml + copy into repo
sync_disable_core  — remove a core from sync.toml (files stay in repo)
sync_resolve       — user has resolved a conflict, delete the .conflict file
sync_disconnect    — remove local clone, clear PAT from keychain, reset sync state
```

---

## Setup Flow

### First Device (New Sync)

1. User opens Settings → Sync tab
2. Pastes GitHub PAT → clicks "Test connection" → preflight validates git + token
3. Either:
   - "Create new repo" → creates `noctodeus-vault` on GitHub via API, clones locally
   - "Connect existing" → enters repo URL, clones locally
4. Toggles sync ON for desired cores
5. First sync: copies core files into repo subdirectory, commits, pushes
6. Sync button appears in sidebar footer

### Second Device (Restore From Sync)

1. User installs Noctodeus on Device B
2. Opens Settings → Sync → enters PAT + repo URL → "Connect existing"
3. App clones the repo, reads `sync.toml` to discover available cores
4. Presents list: "These cores are available from sync. Choose where to place each one:"
   - `my-vault` → user picks `/Users/me/Documents/my-vault`
   - `work-notes` → user picks `/Users/me/work-notes`
5. For each selected core:
   - Copies files from repo subdirectory to the chosen local path
   - Ensures `.noctodeus/` directory exists
   - Registers core in `cores.json`
   - Runs `core_scan` to build `meta.db` from the synced files
6. Cores are now available locally and synced

---

## Error Recovery

The sync module must be resilient to interrupted operations:

- **Dirty working tree:** Before sync, run `git status --porcelain`. If dirty:
  - If mid-rebase state detected (`.git/rebase-merge/` or `.git/rebase-apply/` exists) → `git rebase --abort`
  - If dirty files match current core path contents (same hash) → commit them and continue (likely a prior crash between copy and commit)
  - Otherwise → `git reset --hard HEAD` as last resort, log a warning
- **Atomic file copies:** All file copies use write-to-temp-then-rename to prevent partial files
- **Push failure after pull:** Local state is already updated — next sync will push the changes
- **Corrupted clone:** If clone is unrecoverable, delete the entire sync directory and re-clone from remote. Local core files are unaffected.
- **Network failures:** All git commands have a 30-second timeout. Timeout surfaces as "Sync failed — check your internet connection."

---

## Future Considerations

- **OAuth Device Flow** — more polished auth UX
- **Auto-sync** — optional periodic or on-save sync as a setting
- **Other backends** — S3, WebDAV, custom server via the `SyncBackend` trait
- **Selective sync** — sync specific folders within a core, not everything
- **Git-LFS** — for repos with heavy media content
- **cr-sqlite / libSQL** — if DB-level sync is ever needed (CRDT-based)
- **E2E encryption** — encrypt files before pushing to repo
- **Progress reporting** — emit `sync:progress` Tauri events for long operations
