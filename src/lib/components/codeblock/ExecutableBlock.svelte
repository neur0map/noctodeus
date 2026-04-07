<script lang="ts">
  import { animate } from '$lib/utils/motion';
  import type { CodeTab, SupportedLanguage } from './types';
  import { generateId, defaultTabName } from './types';
  import { kernelStart, kernelExecute, kernelRestart } from '$lib/bridge/commands';
  import { getFilesState } from '$lib/stores/files.svelte';
  import { ask } from '@tauri-apps/plugin-dialog';
  import CodeTabBar from './CodeTabBar.svelte';
  import CodeEditor from './CodeEditor.svelte';
  import OutputDrawer from './OutputDrawer.svelte';
  import StatusDot from './StatusDot.svelte';
  import ErrorCard from './ErrorCard.svelte';
  import LanguagePicker from './LanguagePicker.svelte';

  let {
    initialTabs = [],
    onupdate,
    ondelete,
  }: {
    initialTabs?: CodeTab[];
    onupdate?: (tabs: CodeTab[]) => void;
    ondelete?: () => void;
  } = $props();

  const files = getFilesState();

  /** Client-side execution timeout (ms). */
  const EXEC_TIMEOUT_MS = 30_000;
  const EXEC_WARNING_KEY = 'noctodeus-exec-warning-accepted';

  let tabs = $state<CodeTab[]>(initialTabs.length > 0 ? initialTabs : []);
  let showInitialPicker = $state(initialTabs.length === 0);
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

  /** Guard against double-invocation (click + Cmd+Enter firing simultaneously). */
  let runLock = false;

  async function run() {
    if (status === 'running' || runLock) return;
    runLock = true;

    try {
      // First-run security warning (async Tauri native dialog)
      if (!localStorage.getItem(EXEC_WARNING_KEY)) {
        const accepted = await ask(
          'Code blocks execute with full system access — file system, network, everything.\n\nOnly run code you trust.',
          { title: 'Noctodeus', kind: 'warning', okLabel: 'I understand', cancelLabel: 'Cancel' },
        );
        if (!accepted) return;
        localStorage.setItem(EXEC_WARNING_KEY, 'true');
      }

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
    } finally {
      runLock = false;
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

      // Race the execution against a client-side timeout
      const result = await Promise.race([
        kernelExecute(notePath, `block-${executionCount}`, code),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('__NOCT_CLIENT_TIMEOUT__')), EXEC_TIMEOUT_MS),
        ),
      ]);
      output = result.stdout;
      stderr = result.stderr;
      status = result.success ? 'success' : 'error';
    } catch (err: unknown) {
      // Handle client-side timeout — kill and restart the kernel
      if (err instanceof Error && err.message === '__NOCT_CLIENT_TIMEOUT__') {
        try {
          await kernelRestart(notePath);
        } catch { /* best effort */ }
        output = '';
        stderr = 'Execution timed out (30s). Kernel restarted.';
        status = 'error';
        return;
      }

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

  async function kill() {
    const notePath = files.activeFilePath ?? 'scratch';
    try {
      await kernelRestart(notePath);
    } catch { /* best effort */ }
    output = '';
    stderr = 'Execution killed by user.';
    status = 'error';
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
  {#if showInitialPicker}
    <div class="exec-block__init">
      <span class="exec-block__init-label">Choose a language to start</span>
      <LanguagePicker
        onselect={(lang) => { addTab(lang); showInitialPicker = false; }}
        onclose={() => {}}
      />
    </div>
  {:else}
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
          onclick={(e) => { e.preventDefault(); e.stopPropagation(); run(); }}
          onmousedown={(e) => { e.preventDefault(); e.stopPropagation(); }}
          title="Run (Cmd+Enter)"
        >
          &#x25B6;
        </button>
        {#if tabs.some((t) => t.language === 'python')}
          <button
            class="exec-block__kill"
            class:exec-block__kill--running={status === 'running'}
            onclick={(e) => { e.preventDefault(); e.stopPropagation(); kill(); }}
            onmousedown={(e) => { e.preventDefault(); e.stopPropagation(); }}
            title={status === 'running' ? 'Kill (force stop)' : 'Restart kernel'}
          >
            {#if status === 'running'}
              &#x25A0;
            {:else}
              &#x21BA;
            {/if}
          </button>
        {/if}
        <StatusDot {status} />
        {#if executionCount > 0}
          <span class="exec-block__counter">[{executionCount}]</span>
        {/if}
        {#if ondelete}
          <button
            class="exec-block__delete"
            onclick={(e) => { e.preventDefault(); e.stopPropagation(); ondelete(); }}
            onmousedown={(e) => { e.preventDefault(); e.stopPropagation(); }}
            title="Delete block"
          >&times;</button>
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
  {/if}
</div>

<style>
  .exec-block {
    margin: 16px 0;
    border-radius: 12px;
    border: 1px solid var(--border-subtle, #1e2336);
    overflow: visible;
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
    border-radius: 12px 12px 0 0;
    overflow: visible;
    position: relative;
    z-index: 50;
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

  .exec-block__kill {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.04);
    color: var(--text-muted, #6b7394);
    font-size: 10px;
    cursor: pointer;
    transition: background 150ms ease-out, color 150ms ease-out;
  }

  .exec-block__kill:hover {
    color: var(--text-primary, #C0CAF5);
    background: rgba(255, 255, 255, 0.08);
  }

  .exec-block__kill--running {
    background: rgba(247, 118, 142, 0.12);
    color: var(--accent-red, #F7768E);
  }

  .exec-block__kill--running:hover {
    background: rgba(247, 118, 142, 0.2);
    color: var(--accent-red, #F7768E);
  }

  .exec-block__counter {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-faint, #3b4261);
  }

  .exec-block__delete {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border: none;
    border-radius: 4px;
    background: none;
    color: var(--text-faint, #3b4261);
    font-size: 14px;
    cursor: pointer;
    opacity: 0;
    transition: opacity 150ms, color 150ms, background 150ms;
  }

  .exec-block:hover .exec-block__delete {
    opacity: 1;
  }

  .exec-block__delete:hover {
    color: var(--accent-red, #F7768E);
    background: rgba(247, 118, 142, 0.08);
  }

  .exec-block__init {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 24px 16px;
  }

  .exec-block__init-label {
    font-size: 12px;
    color: var(--text-muted, #6b7394);
  }

  .exec-block__init :global(.lang-picker) {
    position: static;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: center;
    box-shadow: none;
    border: none;
    background: none;
    gap: 4px;
  }
</style>
