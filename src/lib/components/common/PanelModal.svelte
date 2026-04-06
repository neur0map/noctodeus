<script lang="ts">
  import type { Editor } from '@tiptap/core';
  import OutlinePanel from "$lib/components/panels/OutlinePanel.svelte";
  import BacklinksPanel from "$lib/components/panels/BacklinksPanel.svelte";
  import { getFilesState } from "$lib/stores/files.svelte";
  import { getGraphState } from "$lib/stores/graph.svelte";
  import { getActiveEditorState } from "$lib/stores/active-editor.svelte";
  import { animate, createSpring } from 'animejs';

  import BarChart3 from '@lucide/svelte/icons/bar-chart-3';
  import List from '@lucide/svelte/icons/list';
  import Link from '@lucide/svelte/icons/link';
  import MessageSquare from '@lucide/svelte/icons/message-square';
  import LetterText from '@lucide/svelte/icons/letter-text';
  import Pilcrow from '@lucide/svelte/icons/pilcrow';
  import Clock from '@lucide/svelte/icons/clock';
  import Calendar from '@lucide/svelte/icons/calendar';

  let {
    visible,
    onclose,
    onfileselect,
  }: {
    visible: boolean;
    onclose: () => void;
    onfileselect: (path: string) => void;
  } = $props();

  const files = getFilesState();
  const graphState = getGraphState();
  const activeEditorState = getActiveEditorState();

  type Tab = 'stats' | 'outline' | 'backlinks';
  let activeTab = $state<Tab>('stats');
  let panelEl: HTMLElement | undefined = $state();
  let backdropEl: HTMLElement | undefined = $state();

  const slideSpring = createSpring({ stiffness: 280, damping: 26, mass: 0.7 });

  // Stats computation
  let wordCount = $state(0);
  let charCount = $state(0);
  let paragraphCount = $state(0);
  let readingTime = $state('0m');
  let cleanup: (() => void) | null = null;

  function updateCounts(ed: Editor) {
    const text = ed.state.doc.textContent;
    charCount = text.replace(/\s/g, '').length;
    const words = text.split(/\s+/).filter(w => w.length > 0);
    wordCount = words.length;
    paragraphCount = ed.state.doc.content.childCount;
    const minutes = Math.max(1, Math.ceil(wordCount / 200));
    readingTime = `${minutes}m`;
  }

  $effect(() => {
    cleanup?.();
    cleanup = null;
    const ed = activeEditorState.editor;
    if (!ed) { wordCount = 0; charCount = 0; paragraphCount = 0; readingTime = '0m'; return; }
    updateCounts(ed);
    const handler = () => updateCounts(ed);
    ed.on('update', handler);
    cleanup = () => ed.off('update', handler);
  });

  function formatDateTime(unixSeconds: number | undefined): string {
    if (!unixSeconds) return '—';
    const d = new Date(unixSeconds * 1000);
    const month = d.toLocaleDateString(undefined, { month: 'short' });
    const day = d.getDate();
    const year = d.getFullYear();
    const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    return `${month} ${day}, ${year} at ${time}`;
  }

  let fileNode = $derived(
    files.activeFilePath ? files.fileMap.get(files.activeFilePath) ?? null : null
  );

  // Entrance animation
  $effect(() => {
    if (visible) {
      activeTab = 'stats';
      requestAnimationFrame(() => {
        if (panelEl) {
          animate(panelEl, {
            translateY: [12, 0],
            scale: [0.96, 1],
            opacity: [0, 1],
            duration: 300,
            ease: slideSpring,
          });
        }
      });
    }
  });

  // Animate stat cards when stats tab is shown
  $effect(() => {
    if (visible && activeTab === 'stats') {
      requestAnimationFrame(() => {
        const cards = panelEl?.querySelectorAll('.sp__card');
        if (cards && cards.length > 0) {
          animate(cards, {
            opacity: [0, 1],
            scale: [0.92, 1],
            delay: (_, i) => 40 * i + 60,
            duration: 300,
            ease: 'outQuint',
          });
        }
      });
    }
  });
</script>

{#if visible}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="sp__backdrop"
    bind:this={backdropEl}
    onclick={onclose}
    onkeydown={(e) => { if (e.key === 'Escape') onclose(); }}
  ></div>

  <div class="sp" bind:this={panelEl}>
    <!-- Segmented tabs -->
    <div class="sp__tabs">
      <button
        class="sp__tab"
        class:sp__tab--active={activeTab === 'stats'}
        onclick={() => activeTab = 'stats'}
        title="Statistics"
      >
        <BarChart3 size={15} />
      </button>
      <button
        class="sp__tab"
        class:sp__tab--active={activeTab === 'outline'}
        onclick={() => activeTab = 'outline'}
        title="Outline"
      >
        <List size={15} />
      </button>
      <button
        class="sp__tab"
        class:sp__tab--active={activeTab === 'backlinks'}
        onclick={() => activeTab = 'backlinks'}
        title="Backlinks"
      >
        <Link size={15} />
      </button>
    </div>

    <!-- Tab content -->
    <div class="sp__body">
      {#if activeTab === 'stats'}
        <div class="sp__section-title">Statistics</div>

        <div class="sp__grid">
          <div class="sp__card">
            <div class="sp__card-top">
              <span class="sp__card-value">{wordCount.toLocaleString()}</span>
              <MessageSquare size={14} class="sp__card-icon" />
            </div>
            <span class="sp__card-label">Words</span>
          </div>
          <div class="sp__card">
            <div class="sp__card-top">
              <span class="sp__card-value">{charCount.toLocaleString()}</span>
              <LetterText size={14} class="sp__card-icon" />
            </div>
            <span class="sp__card-label">Characters</span>
          </div>
          <div class="sp__card">
            <div class="sp__card-top">
              <span class="sp__card-value">{paragraphCount}</span>
              <Pilcrow size={14} class="sp__card-icon" />
            </div>
            <span class="sp__card-label">Paragraphs</span>
          </div>
          <div class="sp__card">
            <div class="sp__card-top">
              <span class="sp__card-value">{readingTime}</span>
              <Clock size={14} class="sp__card-icon" />
            </div>
            <span class="sp__card-label">Read Time</span>
          </div>
        </div>

        {#if fileNode}
          <div class="sp__dates">
            <div class="sp__date-row">
              <div class="sp__date-info">
                <span class="sp__date-value">{formatDateTime(fileNode.modified_at)}</span>
                <span class="sp__date-label">Modified</span>
              </div>
              <Calendar size={14} class="sp__date-icon" />
            </div>
          </div>
        {/if}

      {:else if activeTab === 'outline'}
        <div class="sp__section-title">Outline</div>
        <div class="sp__panel-content">
          <OutlinePanel editor={activeEditorState.editor} />
        </div>

      {:else if activeTab === 'backlinks'}
        <div class="sp__section-title">Backlinks</div>
        <div class="sp__panel-content">
          <BacklinksPanel
            currentPath={files.activeFilePath}
            currentTitle={files.activeFilePath ? (files.fileMap.get(files.activeFilePath)?.title ?? null) : null}
            currentAliases={files.activeFilePath ? (files.fileMap.get(files.activeFilePath)?.aliases ?? []) : []}
            nodes={graphState.nodes}
            edges={graphState.edges}
            onselect={(path) => { onclose(); onfileselect(path); }}
          />
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .sp__backdrop {
    position: fixed;
    inset: 0;
    background: transparent;
    z-index: 50;
  }

  .sp {
    position: fixed;
    bottom: 52px;
    left: 16px;
    width: 320px;
    height: min(520px, calc(100vh - 80px));
    background: linear-gradient(
      180deg,
      rgba(19, 22, 31, 0.99) 0%,
      rgba(13, 16, 24, 1) 100%
    );
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.05);
    box-shadow:
      0 0 0 1px rgba(0, 0, 0, 0.4),
      0 -4px 16px rgba(0, 0, 0, 0.3),
      0 -12px 48px rgba(0, 0, 0, 0.25);
    z-index: 51;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    opacity: 0;
  }

  /* ── Segmented Tabs ── */
  .sp__tabs {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 14px 18px 6px;
    background: rgba(255, 255, 255, 0.015);
    border-radius: 10px;
    margin: 12px 14px 0;
  }

  .sp__tab {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 7px 0;
    border: none;
    background: transparent;
    color: var(--text-muted, #6B7394);
    cursor: pointer;
    border-radius: 7px;
    transition: background 150ms ease-out, color 150ms ease-out;
  }

  .sp__tab:hover {
    color: var(--text-secondary, #A9B1D6);
    background: rgba(255, 255, 255, 0.03);
  }

  .sp__tab--active {
    background: rgba(255, 255, 255, 0.07);
    color: var(--text-primary, #C0CAF5);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }

  /* ── Body ── */
  .sp__body {
    flex: 1;
    overflow-y: auto;
    padding: 6px 14px 18px;
  }

  .sp__section-title {
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary, #A9B1D6);
    text-align: center;
    padding: 10px 0 12px;
    letter-spacing: 0.03em;
  }

  /* ── Stat Cards ── */
  .sp__grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 7px;
  }

  .sp__card {
    background: rgba(255, 255, 255, 0.035);
    border-radius: 11px;
    padding: 13px 13px 10px;
    display: flex;
    flex-direction: column;
    gap: 5px;
    opacity: 0;
  }

  .sp__card:nth-child(2) {
    padding-top: 15px;
  }

  .sp__card:nth-child(3) {
    padding-bottom: 12px;
  }

  .sp__card-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
  }

  .sp__card-value {
    font-family: var(--font-mono);
    font-size: 21px;
    font-weight: 600;
    color: var(--text-primary, #C0CAF5);
    letter-spacing: -0.03em;
    line-height: 1.15;
  }

  .sp__card:nth-child(odd) .sp__card-value {
    font-size: 22px;
  }

  .sp__card :global(.sp__card-icon) {
    color: var(--text-faint, #3B4261);
    margin-top: 1px;
    opacity: 0.7;
  }

  .sp__card-label {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-muted, #6B7394);
    letter-spacing: 0.01em;
  }

  /* ── Date row ── */
  .sp__dates {
    margin-top: 10px;
  }

  .sp__date-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(255, 255, 255, 0.035);
    border-radius: 11px;
    padding: 11px 13px;
  }

  .sp__date-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .sp__date-value {
    font-family: var(--font-mono);
    font-size: 12.5px;
    font-weight: 500;
    color: var(--text-primary, #C0CAF5);
    letter-spacing: -0.01em;
  }

  .sp__date-label {
    font-family: var(--font-mono);
    font-size: 10.5px;
    color: var(--text-muted, #6B7394);
  }

  .sp__date-row :global(.sp__date-icon) {
    color: var(--text-faint, #3B4261);
    opacity: 0.6;
  }

  /* ── Panel content (outline/backlinks) ── */
  .sp__panel-content {
    padding: 0 2px;
  }
</style>
