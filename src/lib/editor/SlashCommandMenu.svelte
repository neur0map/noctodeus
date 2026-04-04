<script lang="ts">
  import type { SlashCommandItem } from './extensions/slash-command';

  let {
    items = [],
    visible = false,
    position = { top: 0, left: 0 },
    selectedIndex = 0,
    onselect,
  }: {
    items: SlashCommandItem[];
    visible: boolean;
    position: { top: number; left: number };
    selectedIndex: number;
    onselect: (item: SlashCommandItem) => void;
  } = $props();

  let listEl: HTMLDivElement | undefined = $state();

  // Group items by their group field, preserving order
  let groupedItems = $derived(() => {
    const groups: { label: string; items: { item: SlashCommandItem; globalIndex: number }[] }[] = [];
    let currentGroup: string | null = null;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.group !== currentGroup) {
        currentGroup = item.group;
        groups.push({ label: item.group, items: [] });
      }
      groups[groups.length - 1].items.push({ item, globalIndex: i });
    }
    return groups;
  });

  $effect(() => {
    if (!listEl || !visible) return;
    const selected = listEl.querySelector('.slash-menu__item--selected');
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' });
    }
  });
</script>

{#if visible && items.length > 0}
  <div
    class="slash-menu"
    style="top: {position.top}px; left: {position.left}px;"
    role="listbox"
    aria-label="Slash commands"
    bind:this={listEl}
  >
    {#each groupedItems() as group, gi}
      {#if gi > 0}
        <div class="slash-menu__divider"></div>
      {/if}
      <div class="slash-menu__group-label">{group.label}</div>
      {#each group.items as { item, globalIndex } (item.id)}
        <button
          class="slash-menu__item"
          class:slash-menu__item--selected={globalIndex === selectedIndex}
          role="option"
          aria-selected={globalIndex === selectedIndex}
          onmousedown={(e) => { e.preventDefault(); onselect(item); }}
          onmouseenter={() => { selectedIndex = globalIndex; }}
        >
          <span class="slash-menu__icon">{item.icon}</span>
          <div class="slash-menu__text">
            <span class="slash-menu__label">{item.label}</span>
            <span class="slash-menu__desc">{item.description}</span>
          </div>
          {#if item.shortcut}
            <kbd class="slash-menu__shortcut">{item.shortcut}</kbd>
          {/if}
        </button>
      {/each}
    {/each}
    <div class="slash-menu__footer">
      <span>Close</span>
      <kbd class="slash-menu__shortcut">esc</kbd>
    </div>
  </div>
{/if}

<style>
  .slash-menu {
    position: fixed;
    z-index: 100;
    width: 280px;
    max-height: 380px;
    overflow-y: auto;
    background: rgba(20, 21, 27, 0.97);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    box-shadow:
      0 8px 40px rgba(0, 0, 0, 0.5),
      0 0 0 1px rgba(255, 255, 255, 0.04);
    padding: var(--space-1);
    backdrop-filter: blur(16px);
    animation: slash-enter var(--duration-fast) var(--ease-out) both;
    scrollbar-width: none;
  }

  .slash-menu::-webkit-scrollbar {
    display: none;
  }

  @keyframes slash-enter {
    from {
      opacity: 0;
      transform: translateY(-4px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .slash-menu__group-label {
    padding: var(--space-2) var(--space-3) var(--space-1);
    font-family: var(--font-mono);
    font-size: 10px;
    color: rgba(255, 255, 255, 0.26);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    user-select: none;
  }

  .slash-menu__divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.06);
    margin: var(--space-1) var(--space-2);
  }

  .slash-menu__item {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    padding: 6px var(--space-3);
    border: none;
    border-radius: 6px;
    background: transparent;
    cursor: pointer;
    text-align: left;
    transition: background var(--duration-fast) var(--ease-out);
  }

  .slash-menu__item:hover,
  .slash-menu__item--selected {
    background: rgba(255, 255, 255, 0.06);
  }

  .slash-menu__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    flex-shrink: 0;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.06);
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.64);
  }

  .slash-menu__text {
    display: flex;
    flex-direction: column;
    gap: 0;
    flex: 1;
    min-width: 0;
  }

  .slash-menu__label {
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    color: var(--color-text-primary);
    line-height: 1.3;
  }

  .slash-menu__desc {
    font-family: var(--font-mono);
    font-size: 10px;
    color: rgba(255, 255, 255, 0.3);
    line-height: 1.3;
  }

  .slash-menu__shortcut {
    font-family: var(--font-mono);
    font-size: 10px;
    color: rgba(255, 255, 255, 0.22);
    flex-shrink: 0;
    margin-left: auto;
  }

  .slash-menu__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-2) var(--space-3);
    margin-top: var(--space-1);
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    font-family: var(--font-mono);
    font-size: 10px;
    color: rgba(255, 255, 255, 0.22);
  }

  @media (prefers-reduced-motion: reduce) {
    .slash-menu {
      animation: none;
    }
  }
</style>
