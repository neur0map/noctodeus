use std::path::{Path, PathBuf};
use std::process::Command;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tracing::debug;
use walkdir::WalkDir;

use crate::errors::NoctoError;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ICloudInfo {
    pub available: bool,
    pub path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ICloudVaultStatus {
    pub on_icloud: bool,
    pub evicted_files: Vec<String>,
    pub synced_count: u32,
}

/// Check if iCloud Drive exists on this machine.
pub fn detect() -> ICloudInfo {
    let icloud = icloud_drive_path();
    match icloud {
        Some(p) => ICloudInfo {
            available: true,
            path: Some(p.to_string_lossy().to_string()),
        },
        None => ICloudInfo {
            available: false,
            path: None,
        },
    }
}

/// Get the iCloud Drive root path if it exists.
fn icloud_drive_path() -> Option<PathBuf> {
    #[cfg(target_os = "macos")]
    {
        let home = dirs::home_dir()?;
        let icloud = home.join("Library/Mobile Documents/com~apple~CloudDocs");
        if icloud.is_dir() {
            Some(icloud)
        } else {
            None
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        None
    }
}

/// Check if a vault is inside iCloud Drive and scan for evicted stubs.
pub fn validate_vault(core_path: &Path) -> ICloudVaultStatus {
    let on_icloud = icloud_drive_path()
        .map(|ic| core_path.starts_with(&ic))
        .unwrap_or(false);

    if !on_icloud {
        return ICloudVaultStatus {
            on_icloud: false,
            evicted_files: vec![],
            synced_count: 0,
        };
    }

    let (evicted, synced) = scan_evicted_files(core_path);
    ICloudVaultStatus {
        on_icloud: true,
        evicted_files: evicted,
        synced_count: synced,
    }
}

/// Scan vault directory for .icloud stub files.
/// Returns (evicted_paths, synced_count).
fn scan_evicted_files(core_path: &Path) -> (Vec<String>, u32) {
    let mut evicted = Vec::new();
    let mut synced: u32 = 0;

    for entry in WalkDir::new(core_path)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let name = entry.file_name().to_string_lossy();

        // Skip metadata dirs
        if entry.file_type().is_dir() {
            let n = name.as_ref();
            if matches!(n, ".nodeus" | ".nodeus.nosync" | ".obsidian" | ".git" | ".trash") {
                continue;
            }
        }

        if !entry.file_type().is_file() {
            continue;
        }

        // iCloud stubs: .filename.ext.icloud
        if name.starts_with('.') && name.ends_with(".icloud") {
            if let Some(real_name) = stub_to_real_name(&name) {
                let parent = entry.path().parent().unwrap_or(core_path);
                let rel = parent
                    .strip_prefix(core_path)
                    .unwrap_or(parent)
                    .join(&real_name);
                let rel_str = rel.to_string_lossy().replace('\\', "/");
                evicted.push(rel_str);
            }
        } else if name.ends_with(".md") || name.ends_with(".markdown") || name.ends_with(".mdx") {
            synced += 1;
        }
    }

    (evicted, synced)
}

/// Convert a stub filename like ".note.md.icloud" to "note.md".
pub fn stub_to_real_name(stub_name: &str) -> Option<String> {
    // Format: .<original_name>.icloud
    let without_dot = stub_name.strip_prefix('.')?;
    let real = without_dot.strip_suffix(".icloud")?;
    if real.is_empty() {
        return None;
    }
    Some(real.to_string())
}

/// Trigger download of an evicted file by opening its iCloud stub.
/// macOS Finder hydrates the file asynchronously.
pub fn download_file(core_path: &Path, vault_relative: &str) -> Result<(), NoctoError> {
    let abs_path = core_path.join(vault_relative);
    let parent = abs_path.parent().ok_or_else(|| NoctoError::FileNotFound {
        path: vault_relative.to_string(),
    })?;
    let file_name = abs_path
        .file_name()
        .ok_or_else(|| NoctoError::FileNotFound {
            path: vault_relative.to_string(),
        })?
        .to_string_lossy();

    // The stub is at: <parent>/.<filename>.icloud
    let stub_path = parent.join(format!(".{}.icloud", file_name));

    if !stub_path.exists() {
        // File might already be downloaded
        if abs_path.exists() {
            debug!(path = vault_relative, "file already downloaded");
            return Ok(());
        }
        return Err(NoctoError::FileNotFound {
            path: vault_relative.to_string(),
        });
    }

    // Use `open` to trigger Finder to download the file
    Command::new("open")
        .arg(&stub_path)
        .spawn()
        .map_err(|e| NoctoError::Unexpected {
            detail: format!("Failed to trigger iCloud download: {e}"),
        })?;

    debug!(path = vault_relative, "triggered iCloud download");
    Ok(())
}

/// Compute the local metadata directory for an iCloud vault.
/// ~/Library/Application Support/com.nodeus.app/cores/<sha256[:16]>/
pub fn meta_path(core_path: &Path) -> Result<PathBuf, NoctoError> {
    let base = dirs::data_dir().ok_or_else(|| NoctoError::Unexpected {
        detail: "Could not determine app data directory".to_string(),
    })?;

    let hash = {
        let mut hasher = Sha256::new();
        hasher.update(core_path.to_string_lossy().as_bytes());
        hex::encode(hasher.finalize())
    };
    let truncated = &hash[..16];

    let meta_dir = base
        .join("com.nodeus.app")
        .join("cores")
        .join(truncated);

    if !meta_dir.exists() {
        std::fs::create_dir_all(&meta_dir)?;
    }

    Ok(meta_dir)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_stub_to_real_name() {
        assert_eq!(stub_to_real_name(".note.md.icloud"), Some("note.md".into()));
        assert_eq!(stub_to_real_name(".research-paper.md.icloud"), Some("research-paper.md".into()));
        assert_eq!(stub_to_real_name("..icloud"), None); // empty name
        assert_eq!(stub_to_real_name("note.md"), None); // not a stub
    }

    #[test]
    fn test_detect_returns_struct() {
        let info = detect();
        // Just verify it doesn't panic -- actual availability depends on machine
        assert!(info.available || !info.available);
    }
}
