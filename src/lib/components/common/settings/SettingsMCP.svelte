<script lang="ts">
  import { getSettings } from '../../../stores/settings.svelte';
  import { getMcpState } from '$lib/stores/mcp.svelte';
  import { getCoreState } from '$lib/stores/core.svelte';
  import Play from '@lucide/svelte/icons/play';
  import Square from '@lucide/svelte/icons/square';
  import Plus from '@lucide/svelte/icons/plus';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import Wrench from '@lucide/svelte/icons/wrench';
  import Copy from '@lucide/svelte/icons/copy';
  import Server from '@lucide/svelte/icons/server';

  type Settings = ReturnType<typeof getSettings>;
  let { settings }: { settings: Settings } = $props();

  const mcp = getMcpState();
  const coreState = getCoreState();

  let corePath = $derived(coreState.activeCore?.path ?? '/path/to/your/vault');
  let copied = $state<string | null>(null);

  // Generate config snippets for external AI tools
  let claudeConfig = $derived(JSON.stringify({
    mcpServers: {
      nodeus: {
        command: "nodeus-mcp",
        args: [corePath]
      }
    }
  }, null, 2));

  let cursorConfig = $derived(JSON.stringify({
    "mcpServers": {
      "nodeus": {
        "command": "nodeus-mcp",
        "args": [corePath]
      }
    }
  }, null, 2));

  async function copyConfig(text: string, label: string) {
    try {
      const { writeText } = await import('@tauri-apps/plugin-clipboard-manager');
      await writeText(text);
      copied = label;
      setTimeout(() => { copied = null; }, 2000);
    } catch {
      // Fallback
      try {
        await navigator.clipboard.writeText(text);
        copied = label;
        setTimeout(() => { copied = null; }, 2000);
      } catch {}
    }
  }

  let newName = $state('');
  let newCommand = $state('');
  let newArgs = $state('');
  let addError = $state<string | null>(null);
  let starting = $state<string | null>(null);
  let expandedServer = $state<string | null>(null);

  // One-click presets for popular MCP servers
  const presets = [
    {
      name: 'filesystem',
      label: 'File System',
      desc: 'Read, write, and search files on your machine',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/'],
      envKeys: [] as string[],
    },
    {
      name: 'brave-search',
      label: 'Brave Search',
      desc: 'Search the web via Brave Search API',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-brave-search'],
      envKeys: ['BRAVE_API_KEY'],
    },
    {
      name: 'github',
      label: 'GitHub',
      desc: 'Manage repos, issues, PRs via GitHub API',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      envKeys: ['GITHUB_PERSONAL_ACCESS_TOKEN'],
    },
    {
      name: 'memory',
      label: 'Memory',
      desc: 'Persistent key-value memory for the AI',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-memory'],
      envKeys: [] as string[],
    },
    {
      name: 'fetch',
      label: 'Fetch',
      desc: 'Fetch and extract content from URLs',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-fetch'],
      envKeys: [] as string[],
    },
  ];

  function isPresetAdded(name: string): boolean {
    return settings.mcpServers.some((s: { name: string }) => s.name === name);
  }

  function addPreset(preset: typeof presets[0]) {
    if (isPresetAdded(preset.name)) return;
    const env: Record<string, string> = {};
    for (const key of preset.envKeys) {
      env[key] = '';
    }
    settings.update('mcpServers', [...settings.mcpServers, {
      name: preset.name,
      command: preset.command,
      args: preset.args,
      env: Object.keys(env).length > 0 ? env : undefined,
    }]);
  }

  function addServer() {
    addError = null;
    const name = newName.trim();
    const command = newCommand.trim();
    if (!name || !command) {
      addError = 'Name and command are required.';
      return;
    }

    const existing = settings.mcpServers;
    if (existing.some((s: { name: string }) => s.name === name)) {
      addError = `Server "${name}" already exists.`;
      return;
    }

    const argsArr = newArgs.trim()
      ? newArgs.trim().split(/\s+/)
      : [];

    settings.update('mcpServers', [...existing, { name, command, args: argsArr, env: undefined }]);
    newName = '';
    newCommand = '';
    newArgs = '';
  }

  function removeServer(name: string) {
    const updated = settings.mcpServers.filter((s: { name: string }) => s.name !== name);
    settings.update('mcpServers', updated);
    // Also stop the server if running
    mcp.stopServer(name).catch(() => {});
  }

  async function toggleServer(server: { name: string; command: string; args: string[]; env?: Record<string, string> }) {
    const info = mcp.servers.find(s => s.name === server.name);
    if (info?.running) {
      await mcp.stopServer(server.name);
    } else {
      starting = server.name;
      try {
        await mcp.startServer(server.name, server.command, server.args, server.env);
      } catch {
        // error is set in mcp state
      }
      starting = null;
    }
  }

  function isRunning(name: string): boolean {
    return mcp.servers.find(s => s.name === name)?.running ?? false;
  }

  function serverTools(name: string) {
    const info = mcp.servers.find(s => s.name === name);
    return info?.tools ?? [];
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addServer();
    }
  }
</script>

<div class="settings__section">
  <!-- Nodeus as MCP Server -->
  <div class="settings__row settings__row--vertical">
    <div class="settings__row-info">
      <div class="mcp-section-head">
        <Server size={14} />
        <span class="settings__row-label">Nodeus as MCP Server</span>
      </div>
      <span class="settings__row-desc">
        Let external AI tools (Claude Desktop, Cursor, Windsurf) read, search, and write your notes.
        Add the config below to your AI tool's MCP settings.
      </span>
    </div>

    <div class="mcp-server-config">
      <div class="mcp-config-tabs">
        <span class="mcp-config-label">Claude Desktop</span>
        <span class="mcp-config-path">~/Library/Application Support/Claude/claude_desktop_config.json</span>
      </div>
      <div class="mcp-config-block">
        <pre class="mcp-config-code">{claudeConfig}</pre>
        <button
          class="mcp-config-copy"
          onclick={() => copyConfig(claudeConfig, 'claude')}
        >
          {#if copied === 'claude'}
            Copied
          {:else}
            <Copy size={12} /> Copy
          {/if}
        </button>
      </div>
    </div>

    <div class="mcp-server-config">
      <div class="mcp-config-tabs">
        <span class="mcp-config-label">Cursor / Windsurf / Generic</span>
        <span class="mcp-config-path">Settings &gt; MCP Servers</span>
      </div>
      <div class="mcp-config-block">
        <pre class="mcp-config-code">{cursorConfig}</pre>
        <button
          class="mcp-config-copy"
          onclick={() => copyConfig(cursorConfig, 'cursor')}
        >
          {#if copied === 'cursor'}
            Copied
          {:else}
            <Copy size={12} /> Copy
          {/if}
        </button>
      </div>
    </div>

    <div class="mcp-server-tools">
      <span class="settings__row-desc">
        9 tools available: search, read, create, update, delete, list, memory_set, memory_get, memory_list
      </span>
    </div>
  </div>

  <div class="mcp-divider"></div>

  <!-- Explanation -->
  <div class="settings__row">
    <div class="settings__row-info">
      <span class="settings__row-label">Connect AI Tools to Nodeus</span>
      <span class="settings__row-desc">
        MCP (Model Context Protocol) lets the AI use external tools — search the web, read files, query APIs, and more.
        Add a server below and the AI chat will automatically see its tools.
        Requires <a href="https://nodejs.org" target="_blank" rel="noopener" class="mcp-link">Node.js</a> installed for npx-based servers.
      </span>
    </div>
  </div>

  <!-- One-click presets -->
  <div class="settings__row settings__row--vertical">
    <div class="settings__row-info">
      <span class="settings__row-label">Quick Add</span>
      <span class="settings__row-desc">Popular MCP servers. Click to add, then start.</span>
    </div>
    <div class="mcp-presets">
      {#each presets as preset}
        <button
          class="mcp-preset"
          class:mcp-preset--added={isPresetAdded(preset.name)}
          onclick={() => addPreset(preset)}
          disabled={isPresetAdded(preset.name)}
        >
          <div class="mcp-preset__info">
            <span class="mcp-preset__name">{preset.label}</span>
            <span class="mcp-preset__desc">{preset.desc}</span>
          </div>
          <span class="mcp-preset__badge">
            {isPresetAdded(preset.name) ? 'Added' : 'Add'}
          </span>
        </button>
      {/each}
    </div>
  </div>

  <!-- Configured servers -->
  {#each settings.mcpServers as server (server.name)}
    <div class="settings__row settings__row--vertical mcp-server">
      <div class="mcp-server__header">
        <div class="mcp-server__info">
          <span class="mcp-server__name">{server.name}</span>
          <span class="mcp-server__command">{server.command} {server.args.join(' ')}</span>
        </div>
        <div class="mcp-server__actions">
          <span class="mcp-server__status" class:mcp-server__status--running={isRunning(server.name)}>
            {isRunning(server.name) ? 'running' : 'stopped'}
          </span>
          <button
            class="settings__reset-all"
            onclick={() => toggleServer(server)}
            disabled={starting === server.name}
          >
            {#if starting === server.name}
              Starting...
            {:else if isRunning(server.name)}
              <Square size={10} />
              <span>Stop</span>
            {:else}
              <Play size={10} />
              <span>Start</span>
            {/if}
          </button>
          <button
            class="mcp-server__remove"
            onclick={() => removeServer(server.name)}
            title="Remove server"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {#if server.env && Object.keys(server.env).length > 0}
        <div class="mcp-env">
          {#each Object.entries(server.env) as [key, value]}
            <div class="mcp-env__row">
              <span class="mcp-env__key">{key}</span>
              <input
                class="settings__font-input mcp-env__input"
                type="password"
                placeholder="Enter API key..."
                value={value}
                onchange={(e) => {
                  const updated = settings.mcpServers.map((s: any) => {
                    if (s.name === server.name) {
                      return { ...s, env: { ...s.env, [key]: e.currentTarget.value } };
                    }
                    return s;
                  });
                  settings.update('mcpServers', updated);
                }}
              />
            </div>
          {/each}
        </div>
      {/if}

      {#if isRunning(server.name) && serverTools(server.name).length > 0}
        <button
          class="mcp-server__tools-toggle"
          onclick={() => expandedServer = expandedServer === server.name ? null : server.name}
        >
          <Wrench size={11} />
          <span>{serverTools(server.name).length} tools available</span>
          <span class="mcp-server__chevron" class:mcp-server__chevron--open={expandedServer === server.name}>
            &#x25B8;
          </span>
        </button>
        {#if expandedServer === server.name}
          <div class="mcp-server__tools-list">
            {#each serverTools(server.name) as tool}
              <div class="mcp-tool">
                <span class="mcp-tool__name">{tool.name}</span>
                {#if tool.description}
                  <span class="mcp-tool__desc">{tool.description}</span>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      {/if}
    </div>
  {/each}

  {#if settings.mcpServers.length === 0}
    <div class="settings__row">
      <div class="settings__row-info">
        <span class="settings__row-label">No MCP Servers</span>
        <span class="settings__row-desc">Add a server below to connect AI tools.</span>
      </div>
    </div>
  {/if}

  <!-- Add new server form -->
  <div class="settings__row settings__row--vertical mcp-add">
    <div class="settings__row-info">
      <span class="settings__row-label">Add Server</span>
      <span class="settings__row-desc">Connect an MCP server to provide AI tools.</span>
    </div>

    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="mcp-add__form" onkeydown={handleKeydown}>
      <div class="mcp-add__fields">
        <div class="mcp-add__field">
          <label class="mcp-add__label" for="mcp-name">Name</label>
          <input
            id="mcp-name"
            class="settings__font-input"
            type="text"
            placeholder="filesystem"
            bind:value={newName}
          />
        </div>
        <div class="mcp-add__field">
          <label class="mcp-add__label" for="mcp-command">Command</label>
          <input
            id="mcp-command"
            class="settings__font-input"
            type="text"
            placeholder="npx"
            bind:value={newCommand}
          />
        </div>
        <div class="mcp-add__field">
          <label class="mcp-add__label" for="mcp-args">Arguments</label>
          <input
            id="mcp-args"
            class="settings__font-input"
            type="text"
            placeholder="-y @modelcontextprotocol/server-filesystem /path"
            bind:value={newArgs}
          />
        </div>
      </div>
      <button class="mcp-add__btn" onclick={addServer}>
        <Plus size={12} />
        <span>Add</span>
      </button>
    </div>

    {#if addError}
      <span class="mcp-add__error">{addError}</span>
    {/if}
  </div>

  {#if mcp.error}
    <div class="settings__row">
      <div class="settings__row-info">
        <span class="settings__row-label">Error</span>
        <span class="settings__row-desc mcp-error">{mcp.error}</span>
      </div>
    </div>
  {/if}

  <!-- Tool count summary -->
  {#if mcp.tools.length > 0}
    <div class="settings__row">
      <div class="settings__row-info">
        <span class="settings__row-label">Available Tools</span>
        <span class="settings__row-desc">
          {mcp.tools.length} tool{mcp.tools.length === 1 ? '' : 's'} loaded from running servers.
          The AI will see these tools in its system prompt.
        </span>
      </div>
    </div>
  {/if}
</div>

<style>
  .mcp-server {
    gap: 8px;
  }

  .mcp-server__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    width: 100%;
  }

  .mcp-server__info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .mcp-server__name {
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 500;
    color: var(--color-foreground);
  }

  .mcp-server__command {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-placeholder);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 280px;
  }

  .mcp-server__actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .mcp-server__actions .settings__reset-all {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .mcp-server__status {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-placeholder);
    padding: 2px 6px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.03);
  }

  .mcp-server__status--running {
    color: #9ece6a;
    background: rgba(158, 206, 106, 0.08);
  }

  .mcp-server__remove {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 5px;
    background: transparent;
    color: var(--color-placeholder);
    cursor: pointer;
    transition: color 150ms, background 150ms;
  }

  .mcp-server__remove:hover {
    color: #f7768e;
    background: rgba(247, 118, 142, 0.08);
  }

  .mcp-server__tools-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 6px 8px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.04);
    border-radius: 6px;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-muted-foreground);
    cursor: pointer;
    text-align: left;
    transition: background 150ms;
  }

  .mcp-server__tools-toggle:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .mcp-server__chevron {
    margin-left: auto;
    transition: transform 150ms;
    font-size: 10px;
  }

  .mcp-server__chevron--open {
    transform: rotate(90deg);
  }

  .mcp-server__tools-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 4px 0;
  }

  .mcp-tool {
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding: 4px 8px;
    border-radius: 4px;
  }

  .mcp-tool__name {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 500;
    color: var(--color-accent, #7AA2F7);
  }

  .mcp-tool__desc {
    font-family: var(--font-sans);
    font-size: 11px;
    color: var(--color-placeholder);
    line-height: 1.4;
  }

  /* ---- Add form ---- */
  .mcp-add {
    gap: 10px;
  }

  .mcp-add__form {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
  }

  .mcp-add__fields {
    display: grid;
    grid-template-columns: 1fr 1fr 2fr;
    gap: 8px;
  }

  .mcp-add__field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .mcp-add__label {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-placeholder);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .mcp-add__btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    align-self: flex-start;
    padding: 6px 14px;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 500;
    color: var(--color-accent, #7AA2F7);
    background: rgba(122, 162, 247, 0.1);
    border: 1px solid rgba(122, 162, 247, 0.2);
    border-radius: 6px;
    cursor: pointer;
    transition: background 150ms, border-color 150ms;
  }

  .mcp-add__btn:hover {
    background: rgba(122, 162, 247, 0.18);
    border-color: rgba(122, 162, 247, 0.35);
  }

  .mcp-add__error {
    font-family: var(--font-mono);
    font-size: 11px;
    color: #f7768e;
  }

  .mcp-error {
    color: #f7768e;
    word-break: break-word;
  }

  .mcp-link {
    color: var(--color-accent, #7AA2F7);
    text-decoration: none;
  }
  .mcp-link:hover { text-decoration: underline; }

  .mcp-section-head {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--color-accent, #7AA2F7);
  }

  .mcp-divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.04);
    margin: 4px 0;
  }

  .mcp-server-config {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
  }

  .mcp-config-tabs {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .mcp-config-label {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 500;
    color: var(--color-foreground);
  }

  .mcp-config-path {
    font-family: var(--font-mono);
    font-size: 10px;
    color: rgba(255, 255, 255, 0.2);
  }

  .mcp-config-block {
    position: relative;
    width: 100%;
  }

  .mcp-config-code {
    font-family: var(--font-mono);
    font-size: 11px;
    line-height: 1.5;
    color: var(--color-muted-foreground);
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.04);
    border-radius: 6px;
    padding: 10px 14px;
    margin: 0;
    overflow-x: auto;
    white-space: pre;
    scrollbar-width: thin;
  }

  .mcp-config-copy {
    position: absolute;
    top: 6px;
    right: 6px;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-placeholder);
    background: rgba(255, 255, 255, 0.06);
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: color 150ms, background 150ms;
  }

  .mcp-config-copy:hover {
    color: var(--color-foreground);
    background: rgba(255, 255, 255, 0.1);
  }

  .mcp-server-tools {
    padding: 4px 0;
  }

  .mcp-env {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
  }

  .mcp-env__row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .mcp-env__key {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-placeholder);
    min-width: 140px;
    flex-shrink: 0;
  }

  .mcp-env__input {
    flex: 1;
    font-size: 11px !important;
    padding: 5px 8px !important;
  }

  /* ── Presets ── */
  .mcp-presets {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
  }

  .mcp-preset {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.04);
    border-radius: 6px;
    cursor: pointer;
    text-align: left;
    transition: background 150ms, border-color 150ms;
  }

  .mcp-preset:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(255, 255, 255, 0.08);
  }

  .mcp-preset--added {
    opacity: 0.5;
    cursor: default;
  }

  .mcp-preset__info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  .mcp-preset__name {
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 500;
    color: var(--color-foreground);
  }

  .mcp-preset__desc {
    font-family: var(--font-sans);
    font-size: 10px;
    color: var(--color-placeholder);
    line-height: 1.3;
  }

  .mcp-preset__badge {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-accent, #7AA2F7);
    background: rgba(122, 162, 247, 0.08);
    padding: 2px 8px;
    border-radius: 4px;
    flex-shrink: 0;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .mcp-preset--added .mcp-preset__badge {
    color: var(--color-placeholder);
    background: rgba(255, 255, 255, 0.04);
  }
</style>
