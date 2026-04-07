use tauri::State;

use crate::kernel::errors::KernelError;
use crate::kernel::manager::KernelManager;
use crate::kernel::process::{ExecutionResult, KernelStatus};

#[tauri::command]
pub async fn kernel_start(
    note_path: String,
    state: State<'_, KernelManager>,
) -> Result<(), KernelError> {
    state.start(&note_path).await
}

#[tauri::command]
pub async fn kernel_execute(
    note_path: String,
    block_id: String,
    code: String,
    state: State<'_, KernelManager>,
) -> Result<ExecutionResult, KernelError> {
    state.execute(&note_path, &block_id, &code).await
}

#[tauri::command]
pub async fn kernel_stop(
    note_path: String,
    state: State<'_, KernelManager>,
) -> Result<(), KernelError> {
    state.stop(&note_path).await
}

#[tauri::command]
pub async fn kernel_status(
    note_path: String,
    state: State<'_, KernelManager>,
) -> Result<KernelStatus, KernelError> {
    Ok(state.status(&note_path).await)
}

#[tauri::command]
pub async fn kernel_restart(
    note_path: String,
    state: State<'_, KernelManager>,
) -> Result<(), KernelError> {
    state.restart(&note_path).await
}
