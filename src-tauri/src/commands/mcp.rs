use serde_json::Value;

use crate::errors::CmdResult;
use crate::mcp::protocol::{McpTool, McpToolResult};
use crate::mcp::{McpServerInfo, REGISTRY};

#[tauri::command]
pub async fn mcp_start_server(
    name: String,
    command: String,
    args: Vec<String>,
    env: Option<Vec<(String, String)>>,
) -> CmdResult<Vec<McpTool>> {
    let env_pairs: Vec<(String, String)> = env.unwrap_or_default();
    let mut reg = REGISTRY.lock().await;
    reg.start_server(&name, &command, &args, &env_pairs).await
}

#[tauri::command]
pub async fn mcp_stop_server(name: String) -> CmdResult<()> {
    let mut reg = REGISTRY.lock().await;
    reg.stop_server(&name).await
}

#[tauri::command]
pub async fn mcp_list_servers() -> CmdResult<Vec<McpServerInfo>> {
    let reg = REGISTRY.lock().await;
    Ok(reg.list_servers())
}

#[tauri::command]
pub async fn mcp_list_tools() -> CmdResult<Vec<McpTool>> {
    let reg = REGISTRY.lock().await;
    Ok(reg.all_tools().into_iter().map(|(_, t)| t).collect())
}

#[tauri::command]
pub async fn mcp_call_tool(
    server_name: String,
    tool_name: String,
    arguments: Value,
) -> CmdResult<McpToolResult> {
    let mut reg = REGISTRY.lock().await;
    reg.call_tool(&server_name, &tool_name, arguments).await
}
