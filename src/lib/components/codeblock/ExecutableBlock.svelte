<script lang="ts">
  import { animate } from '$lib/utils/motion';
  import type { CodeTab, SupportedLanguage } from './types';
  import { generateId, defaultTabName } from './types';
  import { kernelStart, kernelExecute } from '$lib/bridge/commands';
  import { getFilesState } from '$lib/stores/files.svelte';
  import CodeTabBar from './CodeTabBar.svelte';
  import CodeEditor from './CodeEditor.svelte';
  import OutputDrawer from './OutputDrawer.svelte';
  import StatusDot from './StatusDot.svelte';
  import ErrorCard from './ErrorCard.svelte';

  let {
    initialTabs = [],
    onupdate,
  }: {
    initialTabs?: CodeTab[];
    onupdate?: (tabs: CodeTab[]) => void;
  } = $props();

  const files = getFilesState();

  let tabs = $state<CodeTab[]>(
    initialTabs.length > 0
      ? initialTabs
      : [{ id: generateId(), name: 'main.py', language: 'python', content: '' }],
  );
  let activeTabId = $state(tabs[0]?.id ?? '');
  let output = $state('');
  let stderr = $state('');
  let status = $state<'idle' | 'running' | 'success' | 'error'>('idle');
  let executionCount = $state(0);
  let drawerOpen = $state(false);
  let kernelError = $state<{ kind: string; message: string; platform_hint?: string } | null>(null);
  let blockEl: HTMLElement | undefined = $state();

  let activeTab = $derived(tabs.find((t) => t.id === activeTabId) ?? tabs[0]);

  function addTab(lang: SupportedLanguage) {
    const tab: CodeTab = {
      id: generateId(),
      name: defaultTabName(lang),
      language: lang,
      content: '',
    };
    tabs = [...tabs, tab];
    activeTabId = tab.id;
    onupdate?.(tabs);
  }

  function removeTab(id: string) {
    if (tabs.length <= 1) return;
    tabs = tabs.filter((t) => t.id !== id);
    if (activeTabId === id) activeTabId = tabs[0]?.id ?? '';
    onupdate?.(tabs);
  }

  function renameTab(id: string, name: string) {
    tabs = tabs.map((t) => (t.id === id ? { ...t, name } : t));
    onupdate?.(tabs);
  }

  function changeLanguage(id: string, lang: SupportedLanguage) {
    tabs = tabs.map((t) => (t.id === id ? { ...t, language: lang } : t));
    onupdate?.(tabs);
  }

  function updateContent(id: string, content: string) {
    tabs = tabs.map((t) => (t.id === id ? { ...t, content } : t));
    onupdate?.(tabs);
  }

  async function run() {
    if (status === 'running') return;
    status = 'running';
    kernelError = null;
    executionCount++;
    drawerOpen = true;

    const hasPython = tabs.some((t) => t.language === 'python');
    const hasWeb = tabs.some((t) => ['html', 'css', 'js'].includes(t.language));

    if (hasPython) {
      await runPython();
    } else if (hasWeb) {
      runWeb();
    }
  }

  async function runPython() {
    const notePath = files.activeFilePath ?? 'scratch';
    const code = tabs
      .filter((t) => t.language === 'python')
      .map((t) => t.content)
      .join('\n');

    try {
      try {
        await kernelStart(notePath);
      } catch {
        /* already running */
      }

      const result = await kernelExecute(notePath, `block-${executionCount}`, code);
      output = result.stdout;
      stderr = result.stderr;
      status = result.success ? 'success' : 'error';
    } catch (err: unknown) {
      const parsed =
        typeof err === 'string' ? (JSON.parse(err) as Record<string, unknown>) : (err as Record<string, unknown> | null);
      if (parsed?.kind === 'not_found') {
        kernelError = parsed as { kind: string; message: string; platform_hint?: string };
      }
      stderr = (parsed?.message as string) ?? String(err);
      status = 'error';
    }
  }

  function runWeb() {
    const html = tabs
      .filter((t) => t.language === 'html')
      .map((t) => t.content)
      .join('\n');
    const css = tabs
      .filter((t) => t.language === 'css')
      .map((t) => t.content)
      .join('\n');
    const js = tabs
      .filter((t) => t.language === 'js')
      .map((t) => t.content)
      .join('\n');

    const consoleOverride = `
      <script>
        const __log = [];
        const __origConsole = { log: console.log, warn: console.warn, error: console.error };
        ['log', 'warn', 'error'].forEach(m => {
          console[m] = (...args) => {
            __origConsole[m](...args);
            parent.postMessage({ type: 'console', method: m, args: args.map(String) }, '*');
          };
        });
      <\/script>
    `;

    output = `<!DOCTYPE html><html><head><style>${css}</style>${consoleOverride}</head><body>${html}<script>${js}<\/script></body></html>`;
    stderr = '';
    status = 'success';
  }

  function clearOutput() {
    output = '';
    stderr = '';
    status = 'idle';
    kernelError = null;
  }

  // Entrance animation
  $effect(() => {
    if (blockEl) {
      animate(blockEl, {
        opacity: [0, 1],
        scale: [0.98, 1],
        duration: 350,
        ease: 'outQuint',
      });
    }
  });
</script>

<div class="exec-block" bind:this={blockEl}>
  <div class="exec-block__header">
    <CodeTabBar
      {tabs}
      {activeTabId}
      onactivate={(id) => (activeTabId = id)}
      onadd={addTab}
      onremove={removeTab}
      onrename={renameTab}
      onchangelang={changeLanguage}
    />
    <div class="exec-block__actions">
      <button
        class="exec-block__run"
        onclick={run}
        disabled={status === 'running'}
        title="Run (Cmd+Enter)"
      >
        {#if status === 'running'}
          <span class="exec-block__spinner">&#x27F3;</span>
        {:else}
          &#x25B6;
        {/if}
      </button>
      <StatusDot {status} />
      {#if executionCount > 0}
        <span class="exec-block__counter">[{executionCount}]</span>
      {/if}
    </div>
  </div>

  {#if activeTab}
    <CodeEditor
      code={activeTab.content}
      language={activeTab.language}
      onchange={(code) => updateContent(activeTab.id, code)}
      onrun={run}
    />
  {/if}

  {#if kernelError}
    <ErrorCard
      error={kernelError}
      onrestart={async () => {
        kernelError = null;
        const notePath = files.activeFilePath ?? 'scratch';
        try {
          await kernelStart(notePath);
        } catch {
          /* ignore */
        }
      }}
    />
  {:else}
    <OutputDrawer
      {output}
      {stderr}
      {status}
      bind:open={drawerOpen}
      isWeb={tabs.some((t) => ['html', 'css', 'js'].includes(t.language)) &&
        !tabs.some((t) => t.language === 'python')}
      onclear={clearOutput}
    />
  {/if}
</div>

<style>
  .exec-block {
    margin: 16px 0;
    border-radius: 12px;
    border: 1px solid var(--border-subtle, #1e2336);
    overflow: hidden;
    background: var(--surface-1, #13161f);
    opacity: 0; /* anime.js animates in */
    position: relative;
  }

  .exec-block:focus-within {
    border-color: var(--accent-blue, #7aa2f7);
  }

  .exec-block__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 10px;
    background: rgba(0, 0, 0, 0.15);
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  }

  .exec-block__actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .exec-block__run {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.04);
    color: var(--text-muted, #6b7394);
    font-size: 12px;
    cursor: pointer;
    transition:
      color 150ms ease-out,
      background 150ms ease-out;
  }

  .exec-block__run:hover:not(:disabled) {
    color: var(--accent-green, #9ece6a);
    background: rgba(158, 206, 106, 0.08);
  }

  .exec-block__run:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .exec-block__spinner {
    display: inline-block;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .exec-block__counter {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-faint, #3b4261);
  }
</style>
