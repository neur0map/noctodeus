use std::fs;
use std::path::PathBuf;

use crate::errors::NoctoError;

/// Build the GIT_ASKPASS environment variable pairs for git commands.
/// This avoids embedding the token in .git/config or remote URLs.
///
/// The askpass script echoes the token when git asks for a password.
/// Git calls it with a prompt argument; we ignore the prompt and always
/// return the token.
pub fn git_auth_env(token: &str) -> Result<Vec<(String, String)>, NoctoError> {
    let askpass_path = askpass_script_path()?;

    // Write the askpass script. On Unix it needs to be executable.
    #[cfg(unix)]
    {
        let script = format!("#!/bin/sh\necho '{}'", token.replace('\'', "'\\''"));
        fs::write(&askpass_path, &script)?;
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&askpass_path, fs::Permissions::from_mode(0o700))?;
    }

    #[cfg(windows)]
    {
        let script = format!("@echo off\necho {}", token);
        let bat_path = askpass_path.with_extension("bat");
        fs::write(&bat_path, &script)?;
        return Ok(vec![
            ("GIT_ASKPASS".to_string(), bat_path.to_string_lossy().to_string()),
            ("GIT_TERMINAL_PROMPT".to_string(), "0".to_string()),
        ]);
    }

    #[cfg(unix)]
    Ok(vec![
        ("GIT_ASKPASS".to_string(), askpass_path.to_string_lossy().to_string()),
        ("GIT_TERMINAL_PROMPT".to_string(), "0".to_string()),
    ])
}

/// Build the remote URL with the token for cloning.
/// We use this only for the initial clone (before the askpass script exists).
/// After clone, all operations use GIT_ASKPASS.
pub fn authenticated_url(remote_url: &str, token: &str) -> String {
    // https://github.com/user/repo.git → https://TOKEN@github.com/user/repo.git
    if let Some(rest) = remote_url.strip_prefix("https://") {
        format!("https://{}@{}", token, rest)
    } else {
        remote_url.to_string()
    }
}

/// After clone, reset the remote URL to the plain HTTPS URL (no token).
pub fn sanitize_remote_url(remote_url: &str) -> String {
    // Remove any embedded credentials
    if let Some(at_pos) = remote_url.find('@') {
        if remote_url.starts_with("https://") {
            return format!("https://{}", &remote_url[at_pos + 1..]);
        }
    }
    remote_url.to_string()
}

fn askpass_script_path() -> Result<PathBuf, NoctoError> {
    let base = dirs::data_dir().ok_or_else(|| NoctoError::Unexpected {
        detail: "Could not determine app data directory".to_string(),
    })?;
    let dir = base.join("com.noctodeus.app").join("sync");
    if !dir.exists() {
        fs::create_dir_all(&dir)?;
    }
    Ok(dir.join("git-askpass"))
}

/// Clean up the askpass script (used by sync_disconnect).
pub fn cleanup_auth() -> Result<(), NoctoError> {
    let path = askpass_script_path()?;
    if path.exists() {
        fs::remove_file(&path)?;
    }
    // Also try .bat on Windows
    let bat = path.with_extension("bat");
    if bat.exists() {
        fs::remove_file(&bat)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_authenticated_url() {
        let url = authenticated_url("https://github.com/user/repo.git", "ghp_abc123");
        assert_eq!(url, "https://ghp_abc123@github.com/user/repo.git");
    }

    #[test]
    fn test_sanitize_remote_url() {
        let url = sanitize_remote_url("https://ghp_abc123@github.com/user/repo.git");
        assert_eq!(url, "https://github.com/user/repo.git");
    }

    #[test]
    fn test_sanitize_clean_url() {
        let url = sanitize_remote_url("https://github.com/user/repo.git");
        assert_eq!(url, "https://github.com/user/repo.git");
    }
}
