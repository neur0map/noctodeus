<script lang="ts">
  import { getSettings } from '../../../stores/settings.svelte';
  import { getMcpState } from '$lib/stores/mcp.svelte';
  import Play from '@lucide/svelte/icons/play';
  import Square from '@lucide/svelte/icons/square';
  import Plus from '@lucide/svelte/icons/plus';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import Wrench from '@lucide/svelte/icons/wrench';

  type Settings = ReturnType<typeof getSettings>;
  let { settings }: { settings: Settings } = $props();

  const mcp = getMcpState();

  let newName = $state('');
  let newCommand = $state('');
  let newArgs = $state('');
  let addError = $state<string | null>(null);
  let starting = $state<string | null>(null);

  // Expand tool list per server
  let expandedServer = $state<string | null>(null);

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

    settings.update('mcpServers', [...existing, { name, command, args: argsArr }]);
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

  async function toggleServer(name: string, command: string, args: string[]) {
    const info = mcp.servers.find(s => s.name === name);
    if (info?.running) {
      await mcp.stopServer(name);
    } else {
      starting = name;
      try {
        await mcp.startServer(name, command, args);
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
            onclick={() => toggleServer(server.name, server.command, server.args)}
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
</style>
