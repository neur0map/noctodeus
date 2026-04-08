import { mcpStartServer, mcpStopServer, mcpListServers, mcpListTools } from '$lib/bridge/mcp';
import type { McpServerInfo, McpTool } from '$lib/bridge/mcp';

let servers = $state<McpServerInfo[]>([]);
let tools = $state<McpTool[]>([]);
let error = $state<string | null>(null);

export function getMcpState() {
  return {
    get servers() { return servers; },
    get tools() { return tools; },
    get error() { return error; },

    async refresh() {
      try {
        servers = await mcpListServers();
        tools = await mcpListTools();
        error = null;
      } catch (err: any) {
        error = err?.message || String(err);
      }
    },

    async startServer(name: string, command: string, args: string[]) {
      try {
        await mcpStartServer(name, command, args);
        await this.refresh();
      } catch (err: any) {
        error = err?.message || String(err);
        throw err;
      }
    },

    async stopServer(name: string) {
      try {
        await mcpStopServer(name);
        await this.refresh();
      } catch (err: any) {
        error = err?.message || String(err);
      }
    },
  };
}
