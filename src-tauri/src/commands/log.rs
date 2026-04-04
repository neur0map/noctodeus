use crate::errors::NoctoError;
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

#[tauri::command]
pub async fn log_write(
    level: String,
    message: String,
    ctx: Option<String>,
) -> Result<(), NoctoError> {
    // Forward frontend log to tracing
    match level.as_str() {
        "error" => tracing::error!(ctx = ?ctx, "{}", message),
        "warn" => tracing::warn!(ctx = ?ctx, "{}", message),
        "info" => tracing::info!(ctx = ?ctx, "{}", message),
        "debug" => tracing::debug!(ctx = ?ctx, "{}", message),
        _ => tracing::trace!(ctx = ?ctx, "{}", message),
    }
    Ok(())
}

#[tauri::command]
pub async fn log_export(app: tauri::AppHandle) -> Result<String, NoctoError> {
    // Create a zip of all log files in the logs directory
    // For now, just return the path to the logs directory
    // (ZIP support can be added later)
    let logs_dir = get_logs_dir(&app)?;
    Ok(logs_dir.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn log_clear(app: tauri::AppHandle) -> Result<(), NoctoError> {
    // Delete all .log files in the logs directory
    let logs_dir = get_logs_dir(&app)?;
    if logs_dir.exists() {
        for entry in fs::read_dir(&logs_dir)
            .map_err(|e| NoctoError::Unexpected {
                detail: e.to_string(),
            })?
        {
            let entry = entry.map_err(|e| NoctoError::Unexpected {
                detail: e.to_string(),
            })?;
            let path = entry.path();
            if path.extension().map_or(false, |ext| ext == "log") {
                fs::remove_file(&path).ok();
            }
        }
    }
    Ok(())
}

fn get_logs_dir(app: &tauri::AppHandle) -> Result<PathBuf, NoctoError> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| NoctoError::Unexpected {
            detail: e.to_string(),
        })?;
    Ok(app_data.join("logs"))
}
