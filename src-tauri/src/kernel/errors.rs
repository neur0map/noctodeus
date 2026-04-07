use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct KernelError {
    pub kind: String,
    pub message: String,
    pub platform_hint: Option<String>,
}

impl KernelError {
    pub fn not_found() -> Self {
        let hint = if cfg!(target_os = "macos") {
            Some("brew install python3".into())
        } else if cfg!(target_os = "linux") {
            Some("sudo apt install python3".into())
        } else {
            Some("Download from https://python.org".into())
        };
        Self {
            kind: "not_found".into(),
            message: "Python 3 is not installed or not in PATH.".into(),
            platform_hint: hint,
        }
    }
    pub fn spawn_failed(msg: impl Into<String>) -> Self {
        Self {
            kind: "spawn_failed".into(),
            message: msg.into(),
            platform_hint: None,
        }
    }
    pub fn execution_error(msg: impl Into<String>) -> Self {
        Self {
            kind: "execution_error".into(),
            message: msg.into(),
            platform_hint: None,
        }
    }
    pub fn crashed(msg: impl Into<String>) -> Self {
        Self {
            kind: "crashed".into(),
            message: msg.into(),
            platform_hint: None,
        }
    }
    pub fn timeout() -> Self {
        Self {
            kind: "timeout".into(),
            message: "Execution timed out (30s).".into(),
            platform_hint: None,
        }
    }
}

impl std::fmt::Display for KernelError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.kind, self.message)
    }
}
impl std::error::Error for KernelError {}
