use aes_gcm::aead::{Aead, KeyInit, OsRng};
use aes_gcm::{Aes256Gcm, Nonce};
use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine;
use hmac::Hmac;
use pbkdf2::pbkdf2;
use rand::RngCore;
use sha2::Sha512;

use crate::errors::NoctoError;

/// The base64-encoded string "AES-GCM" — first segment of the occulto format.
const ALG_SEGMENT: &str = "QUVTLUdDTQ==";

/// Encrypt plaintext using AES-256-GCM in occulto-compatible format.
///
/// Returns the formatted ciphertext string:
/// `QUVTLUdDTQ==--{base64-iv}--{base64-ciphertext+tag}`
pub fn encrypt(plaintext: &[u8], key: &[u8; 32]) -> Result<String, NoctoError> {
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|e| NoctoError::ShareFailed {
        detail: format!("Failed to create cipher: {e}"),
    })?;

    let mut iv = [0u8; 12];
    OsRng.fill_bytes(&mut iv);
    let nonce = Nonce::from_slice(&iv);

    let ciphertext = cipher.encrypt(nonce, plaintext).map_err(|e| NoctoError::ShareFailed {
        detail: format!("Encryption failed: {e}"),
    })?;

    let iv_b64 = B64.encode(iv);
    let ct_b64 = B64.encode(ciphertext);

    Ok(format!("{ALG_SEGMENT}--{iv_b64}--{ct_b64}"))
}

/// Generate a random 256-bit AES key.
pub fn generate_key() -> [u8; 32] {
    let mut key = [0u8; 32];
    OsRng.fill_bytes(&mut key);
    key
}

/// Generate a random 16-byte salt for PBKDF2.
pub fn generate_salt() -> [u8; 16] {
    let mut salt = [0u8; 16];
    OsRng.fill_bytes(&mut salt);
    salt
}

/// Derive a 256-bit AES key from a password using PBKDF2-SHA512.
/// Matches occulto: 100,000 iterations, SHA-512.
pub fn derive_key_from_password(password: &str, salt: &[u8; 16]) -> Result<[u8; 32], NoctoError> {
    let mut key = [0u8; 32];
    pbkdf2::<Hmac<Sha512>>(password.as_bytes(), salt, 100_000, &mut key)
        .map_err(|e| NoctoError::ShareFailed {
            detail: format!("Key derivation failed: {e}"),
        })?;
    Ok(key)
}

/// Build the JSON `meta` string for a non-password note.
pub fn meta_text() -> String {
    r#"{"type":"text"}"#.to_string()
}

/// Build the JSON `meta` string for a password-protected note.
/// Salt is serialized as a JSON indexed object to match JS `JSON.stringify(Uint8Array)`.
pub fn meta_text_with_password(salt: &[u8; 16]) -> String {
    let salt_obj: String = salt
        .iter()
        .enumerate()
        .map(|(i, b)| format!("\"{}\":{}", i, b))
        .collect::<Vec<_>>()
        .join(",");

    format!(
        r#"{{"type":"text","derivation":{{"name":"PBKDF2","hash":"SHA-512","iterations":100000,"salt":{{{}}},"length":256}}}}"#,
        salt_obj
    )
}

/// Decrypt an occulto-formatted ciphertext string. Used for testing round-trips.
#[cfg(test)]
pub fn decrypt(ciphertext_str: &str, key: &[u8; 32]) -> Result<Vec<u8>, NoctoError> {
    let parts: Vec<&str> = ciphertext_str.split("--").collect();
    if parts.len() != 3 || parts[0] != ALG_SEGMENT {
        return Err(NoctoError::ShareFailed {
            detail: "Invalid occulto format".to_string(),
        });
    }

    let iv = B64.decode(parts[1]).map_err(|e| NoctoError::ShareFailed {
        detail: format!("Invalid IV: {e}"),
    })?;
    let ct = B64.decode(parts[2]).map_err(|e| NoctoError::ShareFailed {
        detail: format!("Invalid ciphertext: {e}"),
    })?;

    let cipher = Aes256Gcm::new_from_slice(key).map_err(|e| NoctoError::ShareFailed {
        detail: format!("Failed to create cipher: {e}"),
    })?;
    let nonce = Nonce::from_slice(&iv);

    cipher.decrypt(nonce, ct.as_ref()).map_err(|e| NoctoError::ShareFailed {
        detail: format!("Decryption failed: {e}"),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_produces_occulto_format() {
        let key = generate_key();
        let result = encrypt(b"hello world", &key).unwrap();
        let parts: Vec<&str> = result.split("--").collect();
        assert_eq!(parts.len(), 3);
        assert_eq!(parts[0], "QUVTLUdDTQ==");
        // IV should be 12 bytes = 16 base64 chars
        let iv_bytes = B64.decode(parts[1]).unwrap();
        assert_eq!(iv_bytes.len(), 12);
        // Ciphertext+tag should be > plaintext length
        let ct_bytes = B64.decode(parts[2]).unwrap();
        assert!(ct_bytes.len() > 11); // 11 bytes plaintext + 16 bytes tag
    }

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let key = generate_key();
        let plaintext = b"Hello from Nodeus!";
        let encrypted = encrypt(plaintext, &key).unwrap();
        let decrypted = decrypt(&encrypted, &key).unwrap();
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_encrypt_decrypt_with_password() {
        let salt = generate_salt();
        let key = derive_key_from_password("test-password", &salt).unwrap();
        let plaintext = b"Password protected content";
        let encrypted = encrypt(plaintext, &key).unwrap();
        let decrypted = decrypt(&encrypted, &key).unwrap();
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_encrypt_different_each_time() {
        let key = generate_key();
        let a = encrypt(b"same", &key).unwrap();
        let b = encrypt(b"same", &key).unwrap();
        assert_ne!(a, b); // different IV each time
    }

    #[test]
    fn test_meta_text() {
        assert_eq!(meta_text(), r#"{"type":"text"}"#);
    }

    #[test]
    fn test_meta_with_password() {
        let salt = [0u8; 16];
        let meta = meta_text_with_password(&salt);
        assert!(meta.contains("\"name\":\"PBKDF2\""));
        assert!(meta.contains("\"hash\":\"SHA-512\""));
        assert!(meta.contains("\"iterations\":100000"));
        assert!(meta.contains("\"length\":256"));
        assert!(meta.contains("\"0\":0"));
        assert!(meta.contains("\"15\":0"));
    }

    #[test]
    fn test_derive_key_from_password() {
        let salt = generate_salt();
        let key1 = derive_key_from_password("test", &salt).unwrap();
        let key2 = derive_key_from_password("test", &salt).unwrap();
        assert_eq!(key1, key2); // deterministic
        let key3 = derive_key_from_password("other", &salt).unwrap();
        assert_ne!(key1, key3); // different password = different key
    }
}
