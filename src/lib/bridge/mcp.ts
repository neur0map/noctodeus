import { invoke } from '@tauri-apps/api/core';

export interface McpTool {
  name: string;
  description: string | null;
  inputSchema: any | null;
}

export interface McpToolResult {
  content: { type: string; text?: string }[];
  isError: boolean;
}

export interface McpServerInfo {
  name: string;
  command: string;
  args: string[];
  tools: McpTool[];
  running: boolean;
}

export async function mcpStartServer(name: string, command: string, args: string[], env?: Record<string, string>): Promise<McpTool[]> {
  // Convert env record to array of [key, value] pairs for Rust, filter out empty values
  const envPairs = env
    ? Object.entries(env).filter(([, v]) => v.trim() !== '')
    : [];
  return invoke<McpTool[]>('mcp_start_server', { name, command, args, env: envPairs });
}

export async function mcpStopServer(name: string): Promise<void> {
  return invoke('mcp_stop_server', { name });
}

export async function mcpListServers(): Promise<McpServerInfo[]> {
  return invoke<McpServerInfo[]>('mcp_list_servers');
}

export async function mcpListTools(): Promise<McpTool[]> {
  return invoke<McpTool[]>('mcp_list_tools');
}

export async function mcpCallTool(serverName: string, toolName: string, args: any): Promise<McpToolResult> {
  return invoke<McpToolResult>('mcp_call_tool', { serverName, toolName, arguments: args });
}
