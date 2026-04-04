use std::fs;
use std::path::{Path, PathBuf};

use chrono::Utc;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::errors::NoctoError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoreManifest {
    pub core: CoreConfig,
    pub logging: LoggingConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoreConfig {
    pub name: String,
    pub id: String,
    pub created_at: String,
    pub version: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoggingConfig {
    pub level: String,
    pub max_file_size: u64,
    pub max_rotations: u32,
}

/// Creates the `.noctodeus/` directory and required subdirectories if they
/// don't already exist. Returns the path to the `.noctodeus/` directory.
pub fn ensure_noctodeus_dir(core_path: &Path) -> Result<PathBuf, NoctoError> {
    let noctodeus_dir = core_path.join(".noctodeus");

    let subdirs = [
        noctodeus_dir.clone(),
        noctodeus_dir.join("logs"),
        noctodeus_dir.join("cache"),
        noctodeus_dir.join("cache").join("thumbnails"),
    ];

    for dir in &subdirs {
        if !dir.exists() {
            fs::create_dir_all(dir)?;
        }
    }

    Ok(noctodeus_dir)
}

/// Creates a new `config.toml` manifest inside `.noctodeus/`. Generates a
/// fresh UUID and records the current UTC timestamp.
pub fn create_manifest(path: &Path, name: &str) -> Result<CoreManifest, NoctoError> {
    let manifest = CoreManifest {
        core: CoreConfig {
            name: name.to_string(),
            id: Uuid::new_v4().to_string(),
            created_at: Utc::now().to_rfc3339(),
            version: 1,
        },
        logging: LoggingConfig {
            level: "info".to_string(),
            max_file_size: 5_242_880, // 5 MB
            max_rotations: 3,
        },
    };

    let noctodeus_dir = path.join(".noctodeus");
    let config_path = noctodeus_dir.join("config.toml");
    let toml_str = toml::to_string_pretty(&manifest)?;
    fs::write(&config_path, toml_str)?;

    Ok(manifest)
}

/// Reads and parses the existing `config.toml` from the `.noctodeus/`
/// directory inside `path`.
pub fn load_manifest(path: &Path) -> Result<CoreManifest, NoctoError> {
    let config_path = path.join(".noctodeus").join("config.toml");

    if !config_path.exists() {
        return Err(NoctoError::CoreCorrupted {
            detail: format!("config.toml not found at {}", config_path.display()),
        });
    }

    let contents = fs::read_to_string(&config_path)?;
    let manifest: CoreManifest = toml::from_str(&contents)?;
    Ok(manifest)
}
