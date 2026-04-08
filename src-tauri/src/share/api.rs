use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;

use crate::errors::NoctoError;

#[derive(Debug, Serialize)]
pub struct NotePayload {
    pub contents: String,
    pub meta: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub views: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expiration: Option<u32>,
}

#[derive(Debug, Deserialize)]
pub struct NoteResponse {
    pub id: String,
}

/// Server status from cryptgeon API (snake_case from server, camelCase to frontend).
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ServerStatus {
    pub version: String,
    pub max_size: u64,
    pub max_views: u32,
    pub max_expiration: u32,
    #[serde(default)]
    pub allow_advanced: bool,
    #[serde(default)]
    pub allow_files: bool,
}

fn client() -> Result<Client, NoctoError> {
    Client::builder()
        .timeout(Duration::from_secs(15))
        .redirect(reqwest::redirect::Policy::none())
        .user_agent(format!("noctodeus/{}", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|e| NoctoError::ShareFailed {
            detail: format!("HTTP client error: {e}"),
        })
}

/// Post an encrypted note to the cryptgeon server. Returns the note ID.
pub async fn post_note(server: &str, payload: &NotePayload) -> Result<String, NoctoError> {
    let url = format!("{}/api/notes/", server.trim_end_matches('/'));
    let resp = client()?
        .post(&url)
        .json(payload)
        .send()
        .await
        .map_err(|e| NoctoError::ShareFailed {
            detail: if e.is_timeout() {
                "Could not reach the sharing server. Check your connection.".to_string()
            } else {
                format!("Share request failed: {e}")
            },
        })?;

    if resp.status() == 413 {
        return Err(NoctoError::ShareFailed {
            detail: "Note is too large for this server. Try a shorter selection or use a self-hosted instance.".to_string(),
        });
    }

    if !resp.status().is_success() {
        return Err(NoctoError::ShareFailed {
            detail: format!("Server returned {}", resp.status()),
        });
    }

    let body: NoteResponse = resp.json().await.map_err(|e| NoctoError::ShareFailed {
        detail: format!("Invalid server response: {e}"),
    })?;

    Ok(body.id)
}

/// Check if the cryptgeon server is reachable and get its configuration.
pub async fn get_status(server: &str) -> Result<ServerStatus, NoctoError> {
    let url = format!("{}/api/status/", server.trim_end_matches('/'));
    let resp = client()?
        .get(&url)
        .send()
        .await
        .map_err(|e| NoctoError::ShareFailed {
            detail: if e.is_timeout() {
                "Could not reach the sharing server. Check your connection.".to_string()
            } else {
                format!("Status check failed: {e}")
            },
        })?;

    resp.json().await.map_err(|e| NoctoError::ShareFailed {
        detail: format!("Invalid server response: {e}"),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::share::crypto;

    /// Integration test: encrypt, POST to cryptgeon.org, verify link is valid.
    /// Ignored by default (requires network). Run with: cargo test test_real_share -- --ignored
    #[tokio::test]
    #[ignore]
    async fn test_real_share_roundtrip() {
        let server = "https://cryptgeon.org";

        // Check server is up
        let status = get_status(server).await.expect("server unreachable");
        println!("Server: cryptgeon v{}", status.version);

        // Encrypt a test message
        let key = crypto::generate_key();
        let plaintext = b"Hello from Noctodeus integration test!";
        let encrypted = crypto::encrypt(plaintext, &key).expect("encrypt failed");
        let meta = crypto::meta_text();

        // POST to server
        let payload = NotePayload {
            contents: encrypted,
            meta,
            views: Some(2), // 2 views so we can verify without consuming it
            expiration: None,
        };

        let id = post_note(server, &payload).await.expect("post failed");
        assert!(!id.is_empty());

        let key_hex = hex::encode(key);
        let link = format!("{}/note/{}#{}", server, id, key_hex);
        println!("Share link: {}", link);

        // Verify the note exists by checking the info endpoint (GET doesn't consume views)
        let info_url = format!("{}/api/notes/{}", server, id);
        let resp = Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .build()
            .unwrap()
            .get(&info_url)
            .send()
            .await
            .expect("info request failed");

        assert!(resp.status().is_success(), "note should exist, got {}", resp.status());
        println!("Note verified on server. Link works: {}", link);
    }
}
