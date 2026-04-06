<script lang="ts">
  import type { GraphEdge, GraphNode } from '../../stores/graph.svelte';
  import { getFilesState } from '../../stores/files.svelte';
  import { readFile, writeFile } from '../../bridge/commands';
  import { logger } from '../../logger';
  import Link2 from '@lucide/svelte/icons/link-2';

  let {
    currentPath = null,
    currentTitle = null,
    currentAliases = [],
    nodes = [],
    edges = [],
    onselect,
  }: {
    currentPath?: string | null;
    currentTitle?: string | null;
    currentAliases?: string[];
    nodes: GraphNode[];
    edges: GraphEdge[];
    onselect: (path: string) => void;
  } = $props();

  const files = getFilesState();

  let backlinks = $derived(() => {
    if (!currentPath) return [];
    const inbound = edges.filter(e => e.target === currentPath);
    const seen = new Set<string>();
    return inbound
      .map(e => nodes.find(n => n.id === e.source))
      .filter((n): n is GraphNode => {
        if (!n || seen.has(n.id)) return false;
        seen.add(n.id);
        return true;
      });
  });

  // Unlinked mentions
  type UnlinkedMention = { path: string; name: string; snippet: string; matchTerm: string };

  let unlinkedMentions = $state<UnlinkedMention[]>([]);
  let scanning = $state(false);
  let lastScannedPath = '';

  $effect(() => {
    const path = currentPath;
    const title = currentTitle;
    if (path && title && path !== lastScannedPath) {
      lastScannedPath = path;
      scanUnlinked(path, title, currentAliases);
    }
    if (!path) {
      unlinkedMentions = [];
      lastScannedPath = '';
    }
  });

  async function scanUnlinked(currentFilePath: string, title: string, aliases: string[]) {
    scanning = true;
    const terms = [title, ...aliases].filter(t => t && t.length > 2);
    if (terms.length === 0) { scanning = false; return; }

    const results: UnlinkedMention[] = [];
    const mdFiles = Array.from(files.fileMap.values()).filter(
      f => !f.is_directory && f.path !== currentFilePath &&
        (f.extension === 'md' || f.extension === 'markdown')
    );

    for (const file of mdFiles) {
      if (results.length >= 20) break;
      try {
        const { content } = await readFile(file.path);
        for (const term of terms) {
          // Find term in content NOT inside [[...]]
          const regex = new RegExp(`(?<!\\[\\[)\\b${escapeRegex(term)}\\b(?!\\]\\])`, 'gi');
          const match = regex.exec(content);
          if (match) {
            const start = Math.max(0, match.index - 20);
            const end = Math.min(content.length, match.index + term.length + 20);
            const snippet = (start > 0 ? '...' : '') +
              content.slice(start, end).replace(/\n/g, ' ') +
              (end < content.length ? '...' : '');
            results.push({
              path: file.path,
              name: file.title || file.name,
              snippet,
              matchTerm: term,
            });
            break; // one match per file is enough
          }
        }
      } catch {}
    }

    unlinkedMentions = results;
    scanning = false;
  }

  function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  async function linkMention(mention: UnlinkedMention) {
    try {
      const { content } = await readFile(mention.path);
      const regex = new RegExp(`(?<!\\[\\[)\\b${escapeRegex(mention.matchTerm)}\\b(?!\\]\\])`, 'i');
      const newContent = content.replace(regex, `[[${mention.matchTerm}]]`);
      if (newContent !== content) {
        await writeFile(mention.path, newContent);
        unlinkedMentions = unlinkedMentions.filter(m => m !== mention);
      }
    } catch (err) {
      logger.error(`Failed to link mention: ${err}`);
    }
  }
</script>

<div class="backlinks">
  <div class="backlinks__header">
    <span class="backlinks__label">Backlinks</span>
    <span class="backlinks__count">{backlinks().length}</span>
  </div>
  {#if backlinks().length > 0}
    <div class="backlinks__list">
      {#each backlinks() as node (node.id)}
        <button class="backlinks__item" onclick={() => onselect(node.path)}>
          {node.title}
        </button>
      {/each}
    </div>
  {:else if currentPath}
    <div class="backlinks__empty">No backlinks</div>
  {/if}

  {#if currentPath}
    <div class="backlinks__header backlinks__header--unlinked">
      <span class="backlinks__label">Unlinked Mentions</span>
      <span class="backlinks__count">
        {#if scanning}...{:else}{unlinkedMentions.length}{/if}
      </span>
    </div>
    {#if unlinkedMentions.length > 0}
      <div class="backlinks__list">
        {#each unlinkedMentions as mention (mention.path + mention.matchTerm)}
          <div class="backlinks__mention">
            <button class="backlinks__item" onclick={() => onselect(mention.path)}>
              {mention.name}
            </button>
            <span class="backlinks__snippet">{mention.snippet}</span>
            <button class="backlinks__link-btn" onclick={() => linkMention(mention)} title="Convert to wiki link">
              <Link2 size={10} /> Link
            </button>
          </div>
        {/each}
      </div>
    {:else if !scanning}
      <div class="backlinks__empty">No unlinked mentions</div>
    {/if}
  {/if}
</div>

<style>
  .backlinks {
    padding: 0 12px;
  }

  .backlinks__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 0;
  }

  .backlinks__header--unlinked {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--color-border);
  }

  .backlinks__label {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-placeholder);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .backlinks__count {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-placeholder);
  }

  .backlinks__list {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .backlinks__item {
    display: block;
    width: 100%;
    padding: 4px 6px;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-muted-foreground);
    background: transparent;
    border: none;
    border-radius: 4px;
    text-align: left;
    cursor: pointer;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    transition: background 150ms var(--ease-expo-out);
  }

  .backlinks__item:hover {
    background: var(--color-hover);
    color: var(--color-foreground);
  }

  .backlinks__empty {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-placeholder);
    padding: 4px 0;
  }

  .backlinks__mention {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 2px 0;
  }

  .backlinks__snippet {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-placeholder);
    padding: 0 6px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .backlinks__link-btn {
    align-self: flex-end;
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-accent);
    background: transparent;
    border: 1px solid var(--color-accent);
    border-radius: 4px;
    padding: 2px 8px;
    margin: 2px 6px 0;
    cursor: pointer;
    transition: background 150ms var(--ease-expo-out);
  }

  .backlinks__link-btn:hover {
    background: rgba(122, 162, 247, 0.1);
  }
</style>
