pub mod process;
pub mod protocol;

use std::collections::HashMap;
use std::sync::Arc;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio::sync::Mutex;
use tracing::info;

use crate::errors::NoctoError;
use crate::mcp::process::McpServer;
use crate::mcp::protocol::{McpTool, McpToolResult};

/// Global MCP server registry
pub static REGISTRY: once_cell::sync::Lazy<Arc<Mutex<McpRegistry>>> =
    once_cell::sync::Lazy::new(|| Arc::new(Mutex::new(McpRegistry::new())));

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpServerInfo {
    pub name: String,
    pub command: String,
    pub args: Vec<String>,
    pub tools: Vec<McpTool>,
    pub running: bool,
}

pub struct McpRegistry {
    servers: HashMap<String, McpServer>,
}

impl McpRegistry {
    pub fn new() -> Self {
        Self {
            servers: HashMap::new(),
        }
    }

    pub async fn start_server(
        &mut self,
        name: &str,
        command: &str,
        args: &[String],
        env: &[(String, String)],
    ) -> Result<Vec<McpTool>, NoctoError> {
        // Kill existing server with same name
        if self.servers.contains_key(name) {
            self.stop_server(name).await?;
        }

        let mut server = McpServer::spawn(name, command, args, env).await?;
        server.initialize().await?;
        let tools = server.list_tools().await?;
        info!(name, tools = tools.len(), "MCP server started");
        self.servers.insert(name.to_string(), server);
        Ok(tools)
    }

    pub async fn stop_server(&mut self, name: &str) -> Result<(), NoctoError> {
        if let Some(mut server) = self.servers.remove(name) {
            server.kill().await?;
        }
        Ok(())
    }

    pub fn list_servers(&self) -> Vec<McpServerInfo> {
        self.servers
            .iter()
            .map(|(name, server)| McpServerInfo {
                name: name.clone(),
                command: String::new(),
                args: vec![],
                tools: server.get_tools().to_vec(),
                running: true,
            })
            .collect()
    }

    pub fn all_tools(&self) -> Vec<(String, McpTool)> {
        let mut tools = Vec::new();
        for (name, server) in &self.servers {
            for tool in server.get_tools() {
                tools.push((name.clone(), tool.clone()));
            }
        }
        tools
    }

    pub async fn call_tool(
        &mut self,
        server_name: &str,
        tool_name: &str,
        arguments: Value,
    ) -> Result<McpToolResult, NoctoError> {
        let server =
            self.servers
                .get_mut(server_name)
                .ok_or_else(|| NoctoError::AiFailed {
                    detail: format!("MCP server '{}' not found", server_name),
                })?;
        server.call_tool(tool_name, arguments).await
    }
}
