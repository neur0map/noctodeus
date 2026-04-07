use std::collections::HashMap;

use tokio::sync::Mutex;

use super::errors::KernelError;
use super::process::{ExecutionResult, KernelHandle, KernelStatus};

pub struct KernelManager {
    kernels: Mutex<HashMap<String, KernelHandle>>,
}

impl KernelManager {
    pub fn new() -> Self {
        Self {
            kernels: Mutex::new(HashMap::new()),
        }
    }

    /// Start a new kernel for a note. Kills any existing kernel for that note first.
    pub async fn start(&self, note_path: &str) -> Result<(), KernelError> {
        let mut kernels = self.kernels.lock().await;

        // Kill existing kernel if present
        if let Some(existing) = kernels.remove(note_path) {
            existing.kill().await;
        }

        let handle = KernelHandle::spawn().await?;
        kernels.insert(note_path.to_string(), handle);
        Ok(())
    }

    /// Execute code in the kernel for a given note.
    pub async fn execute(
        &self,
        note_path: &str,
        block_id: &str,
        code: &str,
    ) -> Result<ExecutionResult, KernelError> {
        let kernels = self.kernels.lock().await;
        let handle = kernels
            .get(note_path)
            .ok_or_else(|| KernelError::execution_error("No kernel running for this note"))?;

        if !handle.is_alive().await {
            return Err(KernelError::crashed("Kernel process has exited"));
        }

        handle.execute(block_id, code).await
    }

    /// Stop the kernel for a given note.
    pub async fn stop(&self, note_path: &str) -> Result<(), KernelError> {
        let mut kernels = self.kernels.lock().await;
        if let Some(handle) = kernels.remove(note_path) {
            handle.kill().await;
        }
        Ok(())
    }

    /// Get the status of the kernel for a given note.
    pub async fn status(&self, note_path: &str) -> KernelStatus {
        let kernels = self.kernels.lock().await;
        match kernels.get(note_path) {
            Some(handle) => KernelStatus {
                running: handle.is_alive().await,
                uptime_seconds: handle.uptime_seconds(),
            },
            None => KernelStatus {
                running: false,
                uptime_seconds: 0,
            },
        }
    }

    /// Restart the kernel for a given note.
    pub async fn restart(&self, note_path: &str) -> Result<(), KernelError> {
        self.stop(note_path).await?;
        self.start(note_path).await
    }

    /// Stop all running kernels. Called on app shutdown.
    pub async fn stop_all(&self) {
        let mut kernels = self.kernels.lock().await;
        for (_, handle) in kernels.drain() {
            handle.kill().await;
        }
    }
}
