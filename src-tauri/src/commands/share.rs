use crate::errors::{CmdResult, NoctoError};
use crate::share::{api, crypto};

/// Encrypt content and post to cryptgeon. Returns the share link.
#[tauri::command]
pub async fn share_note(
    content: String,
    views: Option<u32>,
    expiration: Option<u32>,
    password: Option<String>,
    server: String,
) -> CmdResult<String> {
    if content.is_empty() {
        return Err(NoctoError::ShareFailed {
            detail: "Nothing to share".to_string(),
        });
    }

    let plaintext = content.as_bytes();
    let server = if server.is_empty() {
        "https://cryptgeon.org".to_string()
    } else {
        server
    };

    let (key_bytes, meta) = if let Some(ref pw) = password {
        if pw.is_empty() {
            let key = crypto::generate_key();
            (key, crypto::meta_text())
        } else {
            let salt = crypto::generate_salt();
            let key = crypto::derive_key_from_password(pw, &salt)?;
            (key, crypto::meta_text_with_password(&salt))
        }
    } else {
        let key = crypto::generate_key();
        (key, crypto::meta_text())
    };

    let encrypted = crypto::encrypt(plaintext, &key_bytes)?;

    let payload = api::NotePayload {
        contents: encrypted,
        meta,
        views: if expiration.is_some() { None } else { views.or(Some(1)) },
        expiration: if views.is_some() { None } else { expiration },
    };

    let id = api::post_note(&server, &payload).await?;

    // Construct the link
    let link = if password.as_ref().map_or(true, |p| p.is_empty()) {
        let key_hex = hex::encode(key_bytes);
        format!("{}/note/{}#{}", server.trim_end_matches('/'), id, key_hex)
    } else {
        format!("{}/note/{}", server.trim_end_matches('/'), id)
    };

    Ok(link)
}

/// Check if a cryptgeon server is reachable.
#[tauri::command]
pub async fn share_status(server: String) -> CmdResult<api::ServerStatus> {
    let server = if server.is_empty() {
        "https://cryptgeon.org".to_string()
    } else {
        server
    };
    let status = api::get_status(&server).await?;
    Ok(status)
}
