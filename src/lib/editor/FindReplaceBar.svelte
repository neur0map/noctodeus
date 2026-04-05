<script lang="ts">
  import type { Editor } from '@tiptap/core';
  import X from '@lucide/svelte/icons/x';
  import ChevronUp from '@lucide/svelte/icons/chevron-up';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import CaseSensitive from '@lucide/svelte/icons/case-sensitive';
  import Replace from '@lucide/svelte/icons/replace';
  import ReplaceAll from '@lucide/svelte/icons/replace-all';

  let {
    editor,
    visible = false,
    onclose,
  }: {
    editor: Editor | null;
    visible: boolean;
    onclose: () => void;
  } = $props();

  let searchInput: HTMLInputElement | undefined = $state();
  let showReplace = $state(false);
  let searchTerm = $state('');
  let replaceTerm = $state('');

  let matchCount = $derived(((editor?.storage as any)?.searchReplace)?.matchCount ?? 0);
  let currentIndex = $derived(((editor?.storage as any)?.searchReplace)?.currentIndex ?? 0);
  let caseSensitive = $derived(((editor?.storage as any)?.searchReplace)?.caseSensitive ?? false);

  $effect(() => {
    if (visible) {
      requestAnimationFrame(() => searchInput?.focus());
    } else {
      (editor?.commands as any)?.clearSearch?.();
      searchTerm = '';
      replaceTerm = '';
      showReplace = false;
    }
  });

  function handleSearchInput() {
    (editor?.commands as any)?.setSearchTerm(searchTerm);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onclose();
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      (editor?.commands as any)?.nextMatch();
    }
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      (editor?.commands as any)?.prevMatch();
    }
  }
</script>

{#if visible}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="find-bar" onkeydown={handleKeydown}>
    <div class="find-bar__row">
      <input
        class="find-bar__input"
        type="text"
        placeholder="Find..."
        bind:this={searchInput}
        bind:value={searchTerm}
        oninput={handleSearchInput}
      />

      <span class="find-bar__count">
        {#if searchTerm && matchCount > 0}
          {currentIndex + 1}/{matchCount}
        {:else if searchTerm}
          0
        {/if}
      </span>

      <button
        class="find-bar__btn"
        class:find-bar__btn--active={caseSensitive}
        onclick={() => (editor?.commands as any)?.toggleCaseSensitive()}
        title="Case sensitive"
      >
        <CaseSensitive size={14} />
      </button>

      <button class="find-bar__btn" onclick={() => (editor?.commands as any)?.prevMatch()} title="Previous (Shift+Enter)">
        <ChevronUp size={14} />
      </button>

      <button class="find-bar__btn" onclick={() => (editor?.commands as any)?.nextMatch()} title="Next (Enter)">
        <ChevronDown size={14} />
      </button>

      <button
        class="find-bar__btn"
        class:find-bar__btn--active={showReplace}
        onclick={() => showReplace = !showReplace}
        title="Replace"
      >
        <Replace size={14} />
      </button>

      <button class="find-bar__btn" onclick={onclose} title="Close (Esc)">
        <X size={14} />
      </button>
    </div>

    {#if showReplace}
      <div class="find-bar__row">
        <input
          class="find-bar__input"
          type="text"
          placeholder="Replace..."
          bind:value={replaceTerm}
          oninput={() => (editor?.commands as any)?.setReplaceTerm(replaceTerm)}
        />

        <button class="find-bar__btn" onclick={() => (editor?.commands as any)?.replaceCurrent()} title="Replace">
          <Replace size={14} />
        </button>

        <button class="find-bar__btn" onclick={() => (editor?.commands as any)?.replaceAll()} title="Replace all">
          <ReplaceAll size={14} />
        </button>
      </div>
    {/if}
  </div>
{/if}

<style>
  .find-bar {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px 12px;
    background: var(--color-card);
    border-bottom: 1px solid var(--color-border);
    animation: find-bar-in 250ms var(--ease-expo-out) both;
  }

  @keyframes find-bar-in {
    from { opacity: 0; transform: translateY(-8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .find-bar__row {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .find-bar__input {
    flex: 1;
    min-width: 0;
    padding: 5px 8px;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--color-foreground);
    background: var(--color-hover);
    border: 1px solid transparent;
    border-radius: 4px;
    outline: none;
    transition: border-color 150ms var(--ease-expo-out);
  }

  .find-bar__input:focus {
    border-color: var(--color-accent);
  }

  .find-bar__input::placeholder {
    color: var(--color-placeholder);
  }

  .find-bar__count {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-muted-foreground);
    min-width: 36px;
    text-align: center;
    flex-shrink: 0;
  }

  .find-bar__btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--color-muted-foreground);
    cursor: pointer;
    flex-shrink: 0;
    transition: color 150ms var(--ease-expo-out), background 150ms var(--ease-expo-out);
  }

  .find-bar__btn:hover {
    color: var(--color-foreground);
    background: var(--color-hover);
  }

  .find-bar__btn--active {
    color: var(--color-accent);
  }

  @media (prefers-reduced-motion: reduce) {
    .find-bar { animation: none; }
  }
</style>
