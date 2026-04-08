pub mod commands;
pub mod core;
pub mod db;
pub mod errors;
pub mod events;
pub mod indexer;
pub mod logging;
pub mod mcp;
pub mod share;
pub mod ai;
pub mod sync;
pub mod watcher;

/// Normalize a path string to always use forward slashes.
/// Ensures consistent paths across macOS, Windows, and Linux
/// since the frontend expects `/` as the separator.
pub fn normalize_path(p: &str) -> String {
    p.replace('\\', "/")
}

use tauri::Manager;

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
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(AppState::new())
        .setup(|app| {
            let handle = app.handle().clone();
            let window = app.get_webview_window("main")
                .expect("main window not found");

            window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { .. } = event {
                    let Some(state) = handle.try_state::<AppState>() else { return };
                    let state: tauri::State<'_, AppState> = state;
                    let rt = tokio::runtime::Handle::current();
                    rt.block_on(async {
                        let mut lock = state.active_core.write().await;
                        if let Some(mut active) = lock.take() {
                            if let Some(tx) = active.watcher_shutdown.take() {
                                let _ = tx.send(());
                            }
                            tracing::info!("graceful shutdown: watcher stopped, core released");
                        }
                    });
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Core commands
            commands::core_create,
            commands::core_open,
            commands::core_close,
            commands::core_scan,
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
            // Media commands
            commands::media_copy,
            // Graph commands
            commands::graph_links,
            commands::graph_stats,
            commands::graph_backlinks,
            // Sync commands
            commands::sync_setup,
            commands::sync_status,
            commands::sync_smart,
            commands::sync_push,
            commands::sync_pull,
            commands::sync_enable_core,
            commands::sync_disable_core,
            commands::sync_resolve,
            commands::sync_disconnect,
            // Share commands
            commands::share_note,
            commands::share_status,
            // AI commands
            commands::ai_chat,
            commands::ai_chat_cancel,
            commands::ai_providers,
            commands::ai_models,
            // MCP commands
            commands::mcp_start_server,
            commands::mcp_stop_server,
            commands::mcp_list_servers,
            commands::mcp_list_tools,
            commands::mcp_call_tool,
            // RAG commands
            commands::rag_search,
            commands::rag_context,
            commands::rag_index,
            commands::rag_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
