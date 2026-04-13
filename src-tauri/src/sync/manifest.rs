use std::fs;
use std::path::{Path, PathBuf};

use chrono::Utc;
use serde::{Deserialize, Serialize};
use tracing::debug;

use crate::errors::NoctoError;
use crate::sync::SyncConfig;

// ── sync.toml (lives inside the git repo) ─────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncManifest {
    pub sync: SyncMeta,
    #[serde(default)]
    pub cores: Vec<SyncManifestCore>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncMeta {
    pub version: u32,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncManifestCore {
    pub id: String,
    pub name: String,
    pub path: String, // subdirectory within repo
    pub added_at: String,
}

/// Read sync.toml from the repo's .nodeus-sync/ directory.
pub fn read_sync_toml(repo_dir: &Path) -> Result<SyncManifest, NoctoError> {
    let path = repo_dir.join(".nodeus-sync").join("sync.toml");
    if !path.exists() {
        return Err(NoctoError::SyncNotConfigured);
    }
    let contents = fs::read_to_string(&path)?;
    let manifest: SyncManifest = toml::from_str(&contents)?;
    Ok(manifest)
}

/// Write sync.toml to the repo's .nodeus-sync/ directory.
pub fn write_sync_toml(repo_dir: &Path, manifest: &SyncManifest) -> Result<(), NoctoError> {
    let dir = repo_dir.join(".nodeus-sync");
    if !dir.exists() {
        fs::create_dir_all(&dir)?;
    }
    let toml_str = toml::to_string_pretty(manifest)?;
    fs::write(dir.join("sync.toml"), toml_str)?;
    Ok(())
}

/// Create a fresh sync.toml with no cores.
pub fn create_sync_toml(repo_dir: &Path) -> Result<SyncManifest, NoctoError> {
    let manifest = SyncManifest {
        sync: SyncMeta {
            version: 1,
            created_at: Utc::now().to_rfc3339(),
        },
        cores: Vec::new(),
    };
    write_sync_toml(repo_dir, &manifest)?;
    Ok(manifest)
}

/// Write the .gitignore for nodeus artifacts.
/// When `sync_media` is true, media file patterns are omitted so git tracks them.
pub fn write_gitignore(repo_dir: &Path, sync_media: bool) -> Result<(), NoctoError> {
    let dir = repo_dir.join(".nodeus-sync");
    if !dir.exists() {
        fs::create_dir_all(&dir)?;
    }
    let mut content = String::from(
        "# Nodeus — machine-specific artifacts\n\
         **/.nodeus/meta.db\n\
         **/.nodeus/meta.db-wal\n\
         **/.nodeus/meta.db-shm\n\
         **/.nodeus/logs/\n\
         **/.nodeus/cache/\n\n",
    );

    if !sync_media {
        content.push_str(
            "# Media files (enable \"Sync images & media\" in Settings to include)\n\
             *.png\n*.jpg\n*.jpeg\n*.gif\n*.bmp\n*.svg\n*.webp\n\
             *.pdf\n*.mp3\n*.mp4\n*.mov\n*.zip\n\n",
        );
    }

    content.push_str(
        "# OS junk\n\
         .DS_Store\nThumbs.db\ndesktop.ini\n\n\
         # Other app metadata (not ours)\n\
         .obsidian/\n.logseq/\nlogseq/\n.trash/\n",
    );
    // Write to repo root, not inside .nodeus-sync
    fs::write(repo_dir.join(".gitignore"), content)?;
    Ok(())
}

/// Add a core to the sync manifest.
pub fn add_core_to_manifest(
    repo_dir: &Path,
    id: &str,
    name: &str,
    subdir: &str,
) -> Result<SyncManifest, NoctoError> {
    let mut manifest = read_sync_toml(repo_dir)?;
    if manifest.cores.iter().any(|c| c.id == id) {
        debug!(id, "core already in sync manifest");
        return Ok(manifest);
    }
    manifest.cores.push(SyncManifestCore {
        id: id.to_string(),
        name: name.to_string(),
        path: subdir.to_string(),
        added_at: Utc::now().to_rfc3339(),
    });
    write_sync_toml(repo_dir, &manifest)?;
    Ok(manifest)
}

/// Remove a core from the sync manifest.
pub fn remove_core_from_manifest(
    repo_dir: &Path,
    id: &str,
) -> Result<SyncManifest, NoctoError> {
    let mut manifest = read_sync_toml(repo_dir)?;
    manifest.cores.retain(|c| c.id != id);
    write_sync_toml(repo_dir, &manifest)?;
    Ok(manifest)
}

// ── sync.json (lives in app data directory) ───────────────────────────

/// Get the path to sync.json in the app data directory.
pub fn sync_json_path() -> Result<PathBuf, NoctoError> {
    let base = dirs::data_dir().ok_or_else(|| NoctoError::Unexpected {
        detail: "Could not determine app data directory".to_string(),
    })?;
    let app_dir = base.join("com.nodeus.app");
    if !app_dir.exists() {
        fs::create_dir_all(&app_dir)?;
    }
    Ok(app_dir.join("sync.json"))
}

/// Read the app-level sync config.
pub fn read_sync_config() -> Result<Option<SyncConfig>, NoctoError> {
    let path = sync_json_path()?;
    if !path.exists() {
        return Ok(None);
    }
    let contents = fs::read_to_string(&path)?;
    let config: SyncConfig = serde_json::from_str(&contents)?;
    Ok(Some(config))
}

/// Write the app-level sync config.
pub fn write_sync_config(config: &SyncConfig) -> Result<(), NoctoError> {
    let path = sync_json_path()?;
    let json = serde_json::to_string_pretty(config)?;
    fs::write(&path, json)?;
    Ok(())
}

/// Delete the sync config (used by sync_disconnect).
pub fn delete_sync_config() -> Result<(), NoctoError> {
    let path = sync_json_path()?;
    if path.exists() {
        fs::remove_file(&path)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sync_toml_roundtrip() {
        let dir = tempfile::tempdir().unwrap();
        let manifest = create_sync_toml(dir.path()).unwrap();
        assert_eq!(manifest.sync.version, 1);
        assert!(manifest.cores.is_empty());

        let manifest = add_core_to_manifest(dir.path(), "abc-123", "my-vault", "my-vault").unwrap();
        assert_eq!(manifest.cores.len(), 1);
        assert_eq!(manifest.cores[0].name, "my-vault");

        let manifest = read_sync_toml(dir.path()).unwrap();
        assert_eq!(manifest.cores.len(), 1);

        let manifest = remove_core_from_manifest(dir.path(), "abc-123").unwrap();
        assert!(manifest.cores.is_empty());
    }

    #[test]
    fn test_gitignore_creation() {
        let dir = tempfile::tempdir().unwrap();
        write_gitignore(dir.path(), false).unwrap();
        let content = fs::read_to_string(dir.path().join(".gitignore")).unwrap();
        assert!(content.contains("meta.db"));
        assert!(content.contains("logs/"));
        assert!(content.contains("cache/"));
    }
}
