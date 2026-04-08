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
    backdrop-filter: blur(8px);
    z-index: 100;
    animation: cmd-backdrop-in 300ms ease both;
  }

  @keyframes cmd-backdrop-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .command-palette {
    width: 560px;
    max-height: 400px;
    background: var(--color-popover);
    border-radius: 8px;
    box-shadow: var(--shadow-float);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    animation: command-palette-enter 450ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  @keyframes command-palette-enter {
    from {
      opacity: 0;
      transform: scale(0.95) translateY(8px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  .command-palette__list {
    overflow-y: auto;
    max-height: 340px;
    padding: 4px 0;
  }

  .command-palette__empty {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px 16px;
    font-family: var(--font-mono);
    font-size: 13px;
    color: var(--color-placeholder);
  }

  .command-palette__item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 8px 16px;
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    transition: background 150ms var(--ease-expo-out);
  }

  .command-palette__item:hover,
  .command-palette__item--selected {
    background: var(--color-hover);
  }

  .command-palette__label {
    font-family: var(--font-sans);
    font-size: 13px;
    line-height: 1.5;
    color: var(--color-foreground);
  }

  .command-palette__shortcut {
    font-family: var(--font-mono);
    font-size: 12px;
    line-height: 1.4;
    color: var(--color-placeholder);
    background: var(--color-hover);
    padding: 2px 8px;
    border-radius: 4px;
  }

  @media (prefers-reduced-motion: reduce) {
    .command-palette__backdrop,
    .command-palette {
      animation: none;
    }
  }
</style>
