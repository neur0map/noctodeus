use std::process::Stdio;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;

use serde_json::{json, Value};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::Mutex;
use tracing::{debug, warn};

use crate::errors::NoctoError;
use crate::mcp::protocol::{
    JsonRpcNotification, JsonRpcRequest, JsonRpcResponse, McpTool, McpToolResult,
};

/// Default timeout for waiting on a JSON-RPC response.
/// Set high because npx-based servers can take 30+ seconds on first launch
/// while downloading the package.
const RESPONSE_TIMEOUT: Duration = Duration::from_secs(60);

pub struct McpServer {
    name: String,
    child: Arc<Mutex<Child>>,
    stdin: Arc<Mutex<tokio::process::ChildStdin>>,
    stdout: Arc<Mutex<BufReader<tokio::process::ChildStdout>>>,
    next_id: AtomicU64,
    tools: Vec<McpTool>,
}

impl McpServer {
    /// Spawn a new MCP server child process.
    pub async fn spawn(
        name: &str,
        command: &str,
        args: &[String],
        env: &[(String, String)],
    ) -> Result<Self, NoctoError> {
        let mut cmd = Command::new(command);
        cmd.args(args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        // Add env vars (these ADD to existing env, not replace)
        if !env.is_empty() {
            cmd.envs(env.iter().map(|(k, v)| (k.as_str(), v.as_str())));
        }

        let mut child = cmd.spawn().map_err(|e| NoctoError::AiFailed {
            detail: format!("Failed to spawn MCP server '{}': {}", name, e),
        })?;

        let stdin = child.stdin.take().ok_or_else(|| NoctoError::AiFailed {
            detail: format!("MCP server '{}' has no stdin", name),
        })?;

        let stdout = child.stdout.take().ok_or_else(|| NoctoError::AiFailed {
            detail: format!("MCP server '{}' has no stdout", name),
        })?;

        debug!(name, "MCP server process spawned");

        Ok(Self {
            name: name.to_string(),
            child: Arc::new(Mutex::new(child)),
            stdin: Arc::new(Mutex::new(stdin)),
            stdout: Arc::new(Mutex::new(BufReader::new(stdout))),
            next_id: AtomicU64::new(1),
            tools: Vec::new(),
        })
    }

    /// Perform the MCP initialize handshake.
    pub async fn initialize(&mut self) -> Result<(), NoctoError> {
        let params = json!({
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {
                "name": "noctodeus",
                "version": "0.1.0"
            }
        });

        let result = self.send("initialize", Some(params)).await?;
        debug!(name = %self.name, ?result, "MCP initialize response");

        // Send initialized notification (no id, no response expected)
        self.send_notification("notifications/initialized", None)
            .await?;

        Ok(())
    }

    /// List tools exposed by this MCP server. Caches the result.
    pub async fn list_tools(&mut self) -> Result<Vec<McpTool>, NoctoError> {
        let result = self.send("tools/list", None).await?;

        let tools: Vec<McpTool> = serde_json::from_value(
            result
                .get("tools")
                .cloned()
                .unwrap_or_else(|| Value::Array(vec![])),
        )
        .map_err(|e| NoctoError::AiFailed {
            detail: format!("Failed to parse tools/list response: {}", e),
        })?;

        self.tools = tools.clone();
        Ok(tools)
    }

    /// Call a tool on this MCP server.
    pub async fn call_tool(
        &mut self,
        tool_name: &str,
        arguments: Value,
    ) -> Result<McpToolResult, NoctoError> {
        let params = json!({
            "name": tool_name,
            "arguments": arguments,
        });

        let result = self.send("tools/call", Some(params)).await?;

        serde_json::from_value(result).map_err(|e| NoctoError::AiFailed {
            detail: format!("Failed to parse tools/call response: {}", e),
        })
    }

    /// Get cached tools.
    pub fn get_tools(&self) -> &[McpTool] {
        &self.tools
    }

    /// Kill the child process.
    pub async fn kill(&mut self) -> Result<(), NoctoError> {
        let mut child = self.child.lock().await;
        match child.kill().await {
            Ok(()) => {
                debug!(name = %self.name, "MCP server killed");
                Ok(())
            }
            Err(e) => {
                // Process may have already exited — that's fine
                warn!(name = %self.name, error = %e, "MCP server kill returned error (may have already exited)");
                Ok(())
            }
        }
    }

    /// Send a JSON-RPC request and wait for the matching response.
    async fn send(&mut self, method: &str, params: Option<Value>) -> Result<Value, NoctoError> {
        let id = self.next_id.fetch_add(1, Ordering::SeqCst);
        let request = JsonRpcRequest::new(id, method, params);

        // Check if process is still alive
        {
            let mut child = self.child.lock().await;
            match child.try_wait() {
                Ok(Some(status)) => {
                    return Err(NoctoError::AiFailed {
                        detail: format!(
                            "MCP server '{}' has exited with status: {}",
                            self.name, status
                        ),
                    });
                }
                Ok(None) => {} // still running
                Err(e) => {
                    return Err(NoctoError::AiFailed {
                        detail: format!(
                            "Failed to check MCP server '{}' status: {}",
                            self.name, e
                        ),
                    });
                }
            }
        }

        // Serialize and write request
        let mut line =
            serde_json::to_string(&request).map_err(|e| NoctoError::AiFailed {
                detail: format!("Failed to serialize JSON-RPC request: {}", e),
            })?;
        line.push('\n');

        debug!(name = %self.name, %id, method, "Sending JSON-RPC request");

        {
            let mut stdin = self.stdin.lock().await;
            stdin
                .write_all(line.as_bytes())
                .await
                .map_err(|e| NoctoError::AiFailed {
                    detail: format!("Failed to write to MCP server '{}' stdin: {}", self.name, e),
                })?;
            stdin
                .flush()
                .await
                .map_err(|e| NoctoError::AiFailed {
                    detail: format!("Failed to flush MCP server '{}' stdin: {}", self.name, e),
                })?;
        }

        // Read lines until we get a response with matching id
        let response = tokio::time::timeout(RESPONSE_TIMEOUT, self.read_response(id)).await;

        match response {
            Ok(Ok(resp)) => resp,
            Ok(Err(e)) => Err(e),
            Err(_) => Err(NoctoError::AiFailed {
                detail: format!(
                    "Timeout waiting for response from MCP server '{}' (method: {})",
                    self.name, method
                ),
            }),
        }
    }

    /// Send a JSON-RPC notification (no id, no response expected).
    async fn send_notification(
        &self,
        method: &str,
        params: Option<Value>,
    ) -> Result<(), NoctoError> {
        let notification = JsonRpcNotification::new(method, params);

        let mut line = serde_json::to_string(&notification).map_err(|e| NoctoError::AiFailed {
            detail: format!("Failed to serialize JSON-RPC notification: {}", e),
        })?;
        line.push('\n');

        debug!(name = %self.name, method, "Sending JSON-RPC notification");

        let mut stdin = self.stdin.lock().await;
        stdin
            .write_all(line.as_bytes())
            .await
            .map_err(|e| NoctoError::AiFailed {
                detail: format!("Failed to write notification to MCP server '{}': {}", self.name, e),
            })?;
        stdin
            .flush()
            .await
            .map_err(|e| NoctoError::AiFailed {
                detail: format!("Failed to flush MCP server '{}' stdin: {}", self.name, e),
            })?;

        Ok(())
    }

    /// Read lines from stdout until a response with the given id is found.
    /// Skips notification lines (messages without an id field).
    async fn read_response(&self, expected_id: u64) -> Result<Result<Value, NoctoError>, NoctoError> {
        let mut stdout = self.stdout.lock().await;
        let mut buf = String::new();

        loop {
            buf.clear();
            let bytes_read = stdout
                .read_line(&mut buf)
                .await
                .map_err(|e| NoctoError::AiFailed {
                    detail: format!(
                        "Failed to read from MCP server '{}' stdout: {}",
                        self.name, e
                    ),
                })?;

            if bytes_read == 0 {
                return Err(NoctoError::AiFailed {
                    detail: format!(
                        "MCP server '{}' closed stdout (EOF) while waiting for response",
                        self.name
                    ),
                });
            }

            let trimmed = buf.trim();
            if trimmed.is_empty() {
                continue;
            }

            debug!(name = %self.name, line = %trimmed, "MCP stdout line");

            // Try to parse as a JSON-RPC response
            let parsed: Result<JsonRpcResponse, _> = serde_json::from_str(trimmed);
            match parsed {
                Ok(resp) => {
                    // Skip notifications (no id) or responses with non-matching id
                    if resp.id == Some(expected_id) {
                        if let Some(err) = resp.error {
                            return Ok(Err(NoctoError::AiFailed {
                                detail: format!(
                                    "MCP server '{}' returned error (code {}): {}",
                                    self.name, err.code, err.message
                                ),
                            }));
                        }
                        return Ok(Ok(resp.result.unwrap_or(Value::Null)));
                    }
                    // Not our response — could be a notification or response for
                    // a different request. Skip and keep reading.
                    debug!(
                        name = %self.name,
                        response_id = ?resp.id,
                        expected_id,
                        "Skipping non-matching JSON-RPC message"
                    );
                }
                Err(_) => {
                    // Not valid JSON-RPC — could be server logging. Skip it.
                    debug!(
                        name = %self.name,
                        line = %trimmed,
                        "Skipping non-JSON line from MCP server stdout"
                    );
                }
            }
        }
    }
}
