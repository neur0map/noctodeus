# Encrypted Note Sharing — Design Spec

## Goal

Share notes or selected text from Noctodeus as self-destructing encrypted links. Recipients open the link in any browser, no app needed. Encryption happens client-side in Noctodeus. The server (cryptgeon) only stores encrypted blobs.

## How It Works

1. User selects text or right-clicks a note
2. "Share encrypted link" opens a modal
3. User picks: view limit OR time expiry, optional password
4. Noctodeus encrypts the content in Rust (AES-256-GCM)
5. POSTs the encrypted blob to the cryptgeon API
6. Constructs the link: `https://server/note/{id}#{hex-key}`
7. Copies to clipboard (or opens in browser)
8. Recipient opens link in any browser, cryptgeon web UI decrypts it
9. After the view/time limit, the note is gone forever

## Encryption

Must produce output compatible with cryptgeon's `occulto` library so the web UI can decrypt it.

### Payload format (must match occulto exactly)

The encrypted output is three base64 segments separated by `--` (double dash):

```
{base64("AES-GCM")}--{base64(iv)}--{base64(ciphertext+tag)}
```

Concretely: `QUVTLUNDTQ==--{base64-iv}--{base64-ciphertext-with-appended-tag}`

- The first segment is always `QUVTLUNDTQ==` (base64 of the UTF-8 string "AES-GCM")
- Use standard base64 with padding (not URL-safe)
- The auth tag is appended to the ciphertext by AES-GCM (Rust `aes-gcm` crate does this by default), then the whole buffer is base64-encoded as one segment
- Hex encoding for the key must be lowercase

### Without password
- Generate random 256-bit AES key (`rand` crate)
- Generate random 12-byte IV
- Encrypt plaintext bytes (UTF-8 encoded via `.as_bytes()`) with AES-256-GCM
- Serialize in the format above
- Lowercase hex-encode the raw key bytes
- Key goes in URL fragment (`#`), never sent to server
- `meta` field: `{"type":"text"}` (no derivation field)

### With password
- Generate random 16-byte salt
- Derive 256-bit key via PBKDF2 (SHA-512, 100,000 iterations, salt)
- Encrypt same as above
- `meta` field stores derivation params. The salt is serialized as a JSON indexed object (how `JSON.stringify(Uint8Array)` works in JS), NOT as base64:
  ```json
  {"type":"text","derivation":{"name":"PBKDF2","hash":"SHA-512","iterations":100000,"salt":{"0":171,"1":205,"2":34,...},"length":256}}
  ```
- URL has no key fragment, recipient enters password in browser

### Content encoding
- Text content: UTF-8 string converted to bytes via `.as_bytes()`, then encrypted
- The `meta.type` field is `"text"` for text notes

## Cryptgeon API

Two endpoints used:

**POST `/api/notes/`** (Content-Type: application/json)
```json
{
  "contents": "QUVTLUNDTQ==--{base64-iv}--{base64-ciphertext+tag}",
  "meta": "{\"type\":\"text\"}",
  "views": 1,
  "expiration": 0
}
```
- `views` and `expiration` are mutually exclusive
- `expiration` is in minutes
- Response: `{"id": "abc123..."}`

**GET `/api/status/`**
- Returns server config: version, max_size, max_views, max_expiration, feature flags
- Used to validate server is reachable and show limits in UI

## Link Format

```
https://cryptgeon.org/note/{id}#{hex-encoded-256-bit-key}
```

With password (no fragment):
```
https://cryptgeon.org/note/{id}
```

## UI

### Trigger points
1. Right-click note in file tree > "Share encrypted link"
2. Select text in editor > bubble toolbar share icon
3. Command palette > "Share: Encrypted Link"

### Share Modal

Modal title: "Share Encrypted Note"

Content preview: first ~80 characters of the content being shared, truncated with ellipsis.

Expiry options (radio group, two rows):
- Row 1 (views): 1 view, 5 views, 10 views
- Row 2 (time): 5 minutes, 1 hour, 6 hours
- Selecting a view option deselects time, and vice versa
- Default: 1 view

Optional password field (type=password, placeholder "Optional password").

Two action buttons:
- "Copy Link" — encrypt, POST, copy link to clipboard, show toast "Encrypted link copied"
- "Open in Browser" — same as above, then open the link via system browser

Footer attribution (small, muted text):
```
Service provided by cryptgeon
github.com/cupcakearmy/cryptgeon · MIT License
```

"cryptgeon" in the footer links to `https://github.com/cupcakearmy/cryptgeon`.

### Settings

Add to Settings > General (or a new "Sharing" section):
- "Cryptgeon server" text input, default: `https://cryptgeon.org`
- Helper text: "For larger notes or private hosting, run your own instance."

The server URL is stored in the settings store alongside other app preferences.

## Rust Modules

```
src-tauri/src/share/
├── mod.rs       — public types (ShareConfig, ShareResult), re-exports
├── crypto.rs    — encrypt(), generate_key(), derive_key_from_password()
└── api.rs       — post_note(), get_status()
```

### crypto.rs

```rust
pub fn encrypt(plaintext: &[u8], key: &[u8; 32]) -> Result<String, ShareError>
// Returns the formatted ciphertext string
// Format: "QUVTLUNDTQ==--{base64-iv}--{base64-ciphertext+tag}"
// Uses standard base64 with padding, lowercase hex for keys

pub fn generate_key() -> [u8; 32]
// Random 256-bit key

pub fn derive_key_from_password(password: &str, salt: &[u8; 16]) -> [u8; 32]
// PBKDF2-SHA512, 100k iterations

pub fn generate_salt() -> [u8; 16]
// Random 16-byte salt
```

### api.rs

```rust
pub async fn post_note(server: &str, payload: &NotePayload) -> Result<String, ShareError>
// Returns note ID

pub async fn get_status(server: &str) -> Result<ServerStatus, ShareError>
// Returns server config

pub struct NotePayload {
    pub contents: String,  // encrypted string
    pub meta: String,      // JSON meta
    pub views: Option<u32>,
    pub expiration: Option<u32>, // minutes
}

pub struct ServerStatus {
    pub version: String,
    pub max_size: u64,
    pub max_views: u32,
    pub max_expiration: u32,
}
```

## Tauri Commands

```
share_note(content, views, expiration, password, server) → { link: String }
share_status(server) → ServerStatus
```

`share_note` does everything: generate key, encrypt, POST, construct link.

## Frontend Files

```
src/lib/components/common/ShareModal.svelte  — the modal UI
src/lib/bridge/share.ts                      — typed invoke wrappers
```

## Modified Files

- `src-tauri/Cargo.toml` — add `aes-gcm`, `rand`, `base64`, `reqwest` (with rustls-tls), `pbkdf2`, `sha2` (already present), `hmac`
- `src-tauri/src/lib.rs` — register share module + commands
- `src-tauri/src/errors.rs` — add ShareFailed error variant
- `src/routes/+layout.svelte` — add "Share encrypted link" to context menu
- `src/lib/stores/settings.svelte.ts` — add `cryptgeonServer` setting (default: "https://cryptgeon.org")

## Dependencies

| Crate | Purpose |
|-------|---------|
| `aes-gcm` | AES-256-GCM encryption |
| `rand` | Key and IV generation |
| `base64` | Encoding ciphertext and IV |
| `reqwest` + `rustls-tls` | HTTP client for cryptgeon API |
| `pbkdf2` | Password-based key derivation |
| `hmac` | Required by pbkdf2 |

`sha2` and `hex` are already in Cargo.toml.

## HTTP Client

`reqwest` with `rustls-tls` feature. Configuration:
- Timeout: 15 seconds
- No redirect following
- User-Agent: `noctodeus/{version}`

## Tauri Permissions

The `src-tauri/capabilities/default.json` needs HTTP permission for the cryptgeon server. Since the server URL is configurable, allow outbound HTTPS:

```json
{
  "identifier": "http:default",
  "allow": [{ "url": "https://*" }]
}
```

## Error Handling

- Server unreachable: "Could not reach the sharing server. Check your connection."
- Server rejected (413 too large): "Note is too large for this server. Try a shorter selection or use a self-hosted instance."
- Encryption failure: "Encryption failed" (should never happen, but handle gracefully)
- No content: button disabled if content is empty

## Attribution

The MIT license requires preserving the copyright notice. The modal footer satisfies this by linking to the cryptgeon repo. Additionally, add a THIRD_PARTY_NOTICES or CREDITS section to the repo acknowledging:

```
Encrypted sharing powered by cryptgeon (https://github.com/cupcakearmy/cryptgeon)
Copyright 2021 Niccolo Borgioli — MIT License
```
