pub mod commands;
pub mod core;
pub mod db;
pub mod errors;
pub mod events;
pub mod indexer;
pub mod logging;
pub mod watcher;

use crate::core::state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize app-level logging (before anything else)
    let app_logs = dirs::data_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("com.noctodeus.app")
        .join("logs");
    logging::init_app_logging(&app_logs, "info");

    tracing::info!("Noctodeus starting up");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            // Core commands
            commands::core_create,
            commands::core_open,
            commands::core_close,
            commands::core_list,
            // File commands
            commands::file_create,
            commands::file_read,
            commands::file_write,
            commands::file_delete,
            commands::file_rename,
            commands::file_move,
            commands::file_duplicate,
            // Directory commands
            commands::dir_create,
            commands::dir_delete,
            // Search commands
            commands::search_query,
            commands::search_recent,
            commands::search_pinned,
            // Pin commands
            commands::pin_add,
            commands::pin_remove,
            // State commands
            commands::state_save,
            commands::state_load,
            // Log commands
            commands::log_write,
            commands::log_export,
            commands::log_clear,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
