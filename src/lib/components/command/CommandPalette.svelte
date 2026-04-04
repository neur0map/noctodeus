<script lang="ts">
  import SearchInput from '../quickopen/SearchInput.svelte';
  import type { Command } from '../../types/ui';

  let {
    visible = false,
    commands = [],
    onclose,
  }: {
    visible?: boolean;
    commands?: Command[];
    onclose: () => void;
  } = $props();

  let query = $state('');
  let selectedIndex = $state(0);

  let filtered = $derived(
    query.length === 0
      ? commands
      : commands.filter((cmd) =>
          cmd.label.toLowerCase().includes(query.toLowerCase())
        )
  );

  // Reset state when toggling visibility
  $effect(() => {
    if (visible) {
      query = '';
      selectedIndex = 0;
    }
  });

  function handleKeydown(e: KeyboardEvent) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, filtered.length - 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (filtered[selectedIndex]) {
          filtered[selectedIndex].action();
          onclose();
        }
        break;
      case 'Escape':
        e.preventDefault();
        onclose();
        break;
    }
  }

  function handleSelect(cmd: Command) {
    cmd.action();
    onclose();
  }

  function handleBackdropClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('command-palette__backdrop')) {
      onclose();
    }
  }

  let listEl: HTMLElement | undefined = $state();

  $effect(() => {
    if (!listEl) return;
    const selected = listEl.querySelector('.command-palette__item--selected');
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' });
    }
  });
</script>

{#if visible}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="command-palette__backdrop"
    onkeydown={handleKeydown}
    onclick={handleBackdropClick}
  >
    <div class="command-palette" role="dialog" aria-label="Command palette">
      <SearchInput bind:value={query} placeholder="Type a command..." prefix=">" />

      <div class="command-palette__list" role="listbox" bind:this={listEl}>
        {#if filtered.length === 0}
          <div class="command-palette__empty">No commands found</div>
        {:else}
          {#each filtered as cmd, i (cmd.id)}
            <button
              class="command-palette__item"
              class:command-palette__item--selected={i === selectedIndex}
              role="option"
              aria-selected={i === selectedIndex}
              onclick={() => handleSelect(cmd)}
            >
              <span class="command-palette__label">{cmd.label}</span>
              {#if cmd.shortcut}
                <kbd class="command-palette__shortcut">{cmd.shortcut}</kbd>
              {/if}
            </button>
          {/each}
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .command-palette__backdrop {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 20vh;
    background: rgba(0, 0, 0, 0.5);
    z-index: 100;
    animation: fade-in var(--duration-fast) var(--ease-out) both;
  }

  .command-palette {
    width: 560px;
    max-height: 400px;
    background: var(--color-bg-elevated);
    border-radius: 12px;
    box-shadow: var(--shadow-elevated);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    animation: command-palette-enter var(--duration-normal) var(--ease-spring) both;
  }

  @keyframes command-palette-enter {
    from {
      opacity: 0;
      transform: scale(0.98);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .command-palette__list {
    overflow-y: auto;
    max-height: 340px;
    padding: var(--space-1) 0;
  }

  .command-palette__empty {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-8) var(--space-4);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }

  .command-palette__item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: var(--space-2) var(--space-4);
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    transition: background var(--duration-fast) var(--ease-out);
  }

  .command-palette__item:hover,
  .command-palette__item--selected {
    background: var(--color-bg-hover);
  }

  .command-palette__label {
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    line-height: var(--text-sm-leading);
    color: var(--color-text-primary);
  }

  .command-palette__shortcut {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    line-height: var(--text-xs-leading);
    color: var(--color-text-muted);
    background: var(--color-bg-active);
    padding: 2px var(--space-2);
    border-radius: 4px;
  }
</style>
