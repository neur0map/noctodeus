use std::sync::Arc;
use std::time::Instant;

use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::Mutex;

use super::errors::KernelError;
use super::protocol;

/// Python bootstrap script that runs a controlled REPL loop.
///
/// - Reads code blocks delimited by sentinels from stdin
/// - Executes them in a persistent namespace (`__ns`)
/// - Prints output between sentinels to stdout
/// - No interactive mode, no `>>>` prompts
const KERNEL_BOOTSTRAP: &str = r#"
import sys, traceback
__ns = {}
while True:
    try:
        line = sys.stdin.readline()
        if not line:
            break
        line = line.strip()
        if line.startswith("__NOCT_EXEC__"):
            block_id = line[len("__NOCT_EXEC__"):]
            code_lines = []
            for l in sys.stdin:
                l2 = l.rstrip('\n')
                if l2 == "__NOCT_CODE_END__":
                    break
                code_lines.append(l2)
            code = "\n".join(code_lines)
            sys.stdout.write("__NOCT_START_" + block_id + "__\n")
            sys.stdout.flush()
            try:
                compiled = compile(code, "<block-" + block_id + ">", "exec")
                exec(compiled, __ns)
            except:
                traceback.print_exc()
            sys.stdout.write("__NOCT_END_" + block_id + "__\n")
            sys.stdout.flush()
    except EOFError:
        break
    except Exception as e:
        sys.stderr.write("Kernel error: " + str(e) + "\n")
        sys.stderr.flush()
"#;

#[derive(Debug, Clone, serde::Serialize)]
pub struct ExecutionResult {
    pub stdout: String,
    pub stderr: String,
    pub duration_ms: u64,
    pub success: bool,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct KernelStatus {
    pub running: bool,
    pub uptime_seconds: u64,
}

pub struct KernelHandle {
    child: Arc<Mutex<Child>>,
    stdin: Arc<Mutex<tokio::process::ChildStdin>>,
    stdout: Arc<Mutex<BufReader<tokio::process::ChildStdout>>>,
    stderr: Arc<Mutex<BufReader<tokio::process::ChildStderr>>>,
    spawned_at: Instant,
}

impl KernelHandle {
    /// Spawn a new persistent Python 3 kernel process using the bootstrap script.
    pub async fn spawn() -> Result<Self, KernelError> {
        let mut child = Command::new("python3")
            .args(["-u", "-c", KERNEL_BOOTSTRAP])
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .kill_on_drop(true)
            .spawn()
            .map_err(|e| {
                if e.kind() == std::io::ErrorKind::NotFound {
                    KernelError::not_found()
                } else {
                    KernelError::spawn_failed(e.to_string())
                }
            })?;

        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| KernelError::spawn_failed("Failed to capture stdin"))?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| KernelError::spawn_failed("Failed to capture stdout"))?;
        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| KernelError::spawn_failed("Failed to capture stderr"))?;

        Ok(Self {
            child: Arc::new(Mutex::new(child)),
            stdin: Arc::new(Mutex::new(stdin)),
            stdout: Arc::new(Mutex::new(BufReader::new(stdout))),
            stderr: Arc::new(Mutex::new(BufReader::new(stderr))),
            spawned_at: Instant::now(),
        })
    }

    /// Execute a code block and return the captured output.
    pub async fn execute(
        &self,
        block_id: &str,
        code: &str,
    ) -> Result<ExecutionResult, KernelError> {
        let start = Instant::now();

        // 1. Build the sentinel-delimited payload
        let payload = protocol::wrap_code(block_id, code);

        // 2. Write to stdin
        {
            let mut stdin = self.stdin.lock().await;
            stdin
                .write_all(payload.as_bytes())
                .await
                .map_err(|e| KernelError::crashed(format!("stdin write failed: {e}")))?;
            stdin
                .flush()
                .await
                .map_err(|e| KernelError::crashed(format!("stdin flush failed: {e}")))?;
        }

        // 3. Read stdout line by line until end sentinel (with 30s timeout)
        let end_marker = format!("__NOCT_END_{}__", block_id);
        let mut raw_output = String::new();

        let read_result = tokio::time::timeout(std::time::Duration::from_secs(30), async {
            let mut stdout = self.stdout.lock().await;
            let mut line = String::new();
            loop {
                line.clear();
                let bytes_read = stdout
                    .read_line(&mut line)
                    .await
                    .map_err(|e| KernelError::crashed(format!("stdout read failed: {e}")))?;

                if bytes_read == 0 {
                    return Err(KernelError::crashed("Process ended unexpectedly (EOF)"));
                }

                raw_output.push_str(&line);

                if line.contains(&end_marker) {
                    break;
                }
            }
            Ok(())
        })
        .await;

        match read_result {
            Err(_) => return Err(KernelError::timeout()),
            Ok(Err(e)) => return Err(e),
            Ok(Ok(())) => {}
        }

        // 4. Drain stderr (only real errors/tracebacks now, no >>> prompts)
        let stderr_output = self.drain_stderr().await;

        // 5. Parse output
        let stdout_parsed = protocol::parse_output(&raw_output, block_id)
            .unwrap_or_default();

        let duration_ms = start.elapsed().as_millis() as u64;
        let success = stderr_output.is_empty()
            || !stderr_output.contains("Traceback")
                && !stderr_output.contains("Error");

        Ok(ExecutionResult {
            stdout: stdout_parsed,
            stderr: stderr_output,
            duration_ms,
            success,
        })
    }

    /// Check if the child process is still running.
    pub async fn is_alive(&self) -> bool {
        let mut child = self.child.lock().await;
        match child.try_wait() {
            Ok(None) => true,     // still running
            Ok(Some(_)) => false, // exited
            Err(_) => false,      // error checking
        }
    }

    /// Kill the child process.
    pub async fn kill(&self) {
        let mut child = self.child.lock().await;
        let _ = child.kill().await;
    }

    /// Returns seconds since the process was spawned.
    pub fn uptime_seconds(&self) -> u64 {
        self.spawned_at.elapsed().as_secs()
    }

    /// Drain any available stderr output with a short timeout.
    async fn drain_stderr(&self) -> String {
        let mut output = String::new();
        let drain = async {
            let mut stderr = self.stderr.lock().await;
            let mut line = String::new();
            loop {
                line.clear();
                match tokio::time::timeout(
                    std::time::Duration::from_millis(50),
                    stderr.read_line(&mut line),
                )
                .await
                {
                    Ok(Ok(0)) => break,      // EOF
                    Ok(Ok(_)) => output.push_str(&line),
                    Ok(Err(_)) => break,      // read error
                    Err(_) => break,          // timeout — no more data
                }
            }
        };
        // Overall drain timeout: don't spend more than 200ms
        let _ = tokio::time::timeout(std::time::Duration::from_millis(200), drain).await;
        output
    }
}
