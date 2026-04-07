<script lang="ts">
  import type { CodeTab, SupportedLanguage } from './types';
  import { SUPPORTED_LANGUAGES } from './types';
  import LanguagePicker from './LanguagePicker.svelte';

  let {
    tabs,
    activeTabId,
    onactivate,
    onadd,
    onremove,
    onrename,
    onchangelang,
  }: {
    tabs: CodeTab[];
    activeTabId: string;
    onactivate: (id: string) => void;
    onadd: (lang: SupportedLanguage) => void;
    onremove: (id: string) => void;
    onrename: (id: string, name: string) => void;
    onchangelang: (id: string, lang: SupportedLanguage) => void;
  } = $props();

  let showAddPicker = $state(false);
  let dropdownTabId = $state<string | null>(null);
  let renamingTabId = $state<string | null>(null);
  let renameValue = $state('');

  function startRename(id: string, currentName: string) {
    renamingTabId = id;
    renameValue = currentName;
    dropdownTabId = null;
  }

  function commitRename(id: string) {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== tabs.find((t) => t.id === id)?.name) {
      onrename(id, trimmed);
    }
    renamingTabId = null;
  }

  function handleRenameKeydown(e: KeyboardEvent, id: string) {
    if (e.key === 'Enter') {
      commitRename(id);
    } else if (e.key === 'Escape') {
      renamingTabId = null;
    }
  }

  function handleDropdownClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest('.tab-dropdown')) {
      dropdownTabId = null;
    }
  }

  $effect(() => {
    if (dropdownTabId) {
      document.addEventListener('mousedown', handleDropdownClickOutside);
      return () => document.removeEventListener('mousedown', handleDropdownClickOutside);
    }
  });
</script>

<div class="tab-bar">
  <div class="tab-bar__tabs">
    {#each tabs as tab (tab.id)}
      <div class="tab-bar__tab" class:tab-bar__tab--active={tab.id === activeTabId}>
        {#if renamingTabId === tab.id}
          <input
            class="tab-bar__rename"
            type="text"
            bind:value={renameValue}
            onblur={() => commitRename(tab.id)}
            onkeydown={(e) => handleRenameKeydown(e, tab.id)}
          />
        {:else}
          <button class="tab-bar__name" onclick={() => onactivate(tab.id)}>
            {tab.name}
          </button>
        {/if}

        <div class="tab-dropdown" style="position: relative;">
          <button
            class="tab-bar__menu-btn"
            onclick={(e) => { e.stopPropagation(); dropdownTabId = dropdownTabId === tab.id ? null : tab.id; }}
            title="Tab options"
          >
            ▾
          </button>

          {#if dropdownTabId === tab.id}
            <div class="tab-dropdown__menu">
              <button class="tab-dropdown__item" onclick={() => startRename(tab.id, tab.name)}>
                Rename
              </button>
              <div class="tab-dropdown__sub">
                <span class="tab-dropdown__sublabel">Language</span>
                {#each SUPPORTED_LANGUAGES as lang}
                  <button
                    class="tab-dropdown__item"
                    class:tab-dropdown__item--active={tab.language === lang.id}
                    onclick={() => { onchangelang(tab.id, lang.id); dropdownTabId = null; }}
                  >
                    {lang.label}
                  </button>
                {/each}
              </div>
              {#if tabs.length > 1}
                <button class="tab-dropdown__item tab-dropdown__item--danger" onclick={() => { onremove(tab.id); dropdownTabId = null; }}>
                  Delete
                </button>
              {/if}
            </div>
          {/if}
        </div>
      </div>
    {/each}
  </div>

  <div class="tab-bar__add" style="position: relative;">
    <button class="tab-bar__add-btn" onclick={() => showAddPicker = !showAddPicker} title="Add tab">
      +
    </button>
    {#if showAddPicker}
      <LanguagePicker
        onselect={(lang) => { onadd(lang); showAddPicker = false; }}
        onclose={() => showAddPicker = false}
      />
    {/if}
  </div>
</div>

<style>
  .tab-bar {
    display: flex;
    align-items: center;
    gap: 2px;
    overflow-x: auto;
    min-width: 0;
  }

  .tab-bar__tabs {
    display: flex;
    align-items: center;
    gap: 1px;
    min-width: 0;
    overflow-x: auto;
  }

  .tab-bar__tab {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 0 2px;
    border-radius: 4px;
    flex-shrink: 0;
  }

  .tab-bar__name {
    border: none;
    background: none;
    color: var(--text-muted, #6B7394);
    font-family: var(--font-mono);
    font-size: 11px;
    padding: 4px 6px;
    cursor: pointer;
    white-space: nowrap;
    border-radius: 4px;
    transition: color 120ms;
  }

  .tab-bar__tab--active .tab-bar__name {
    color: var(--text-primary, #C0CAF5);
  }

  .tab-bar__name:hover {
    color: var(--text-primary, #C0CAF5);
  }

  .tab-bar__rename {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid var(--accent-blue, #7AA2F7);
    border-radius: 4px;
    color: var(--text-primary, #C0CAF5);
    font-family: var(--font-mono);
    font-size: 11px;
    padding: 3px 6px;
    width: 90px;
    outline: none;
  }

  .tab-bar__menu-btn {
    border: none;
    background: none;
    color: var(--text-faint, #3B4261);
    font-size: 10px;
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 3px;
    line-height: 1;
    transition: color 120ms;
  }

  .tab-bar__menu-btn:hover {
    color: var(--text-muted, #6B7394);
  }

  .tab-dropdown__menu {
    position: absolute;
    top: 100%;
    right: 0;
    z-index: 20;
    display: flex;
    flex-direction: column;
    min-width: 130px;
    padding: 4px;
    border-radius: 8px;
    border: 1px solid var(--border-subtle, #1E2336);
    background: var(--surface-2, #1A1E2E);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  }

  .tab-dropdown__item {
    display: block;
    width: 100%;
    padding: 5px 10px;
    border: none;
    border-radius: 4px;
    background: none;
    color: var(--text-primary, #C0CAF5);
    font-size: 12px;
    cursor: pointer;
    text-align: left;
  }

  .tab-dropdown__item:hover {
    background: rgba(255, 255, 255, 0.06);
  }

  .tab-dropdown__item--active {
    color: var(--accent-blue, #7AA2F7);
  }

  .tab-dropdown__item--danger {
    color: var(--accent-red, #F7768E);
  }

  .tab-dropdown__item--danger:hover {
    background: rgba(247, 118, 142, 0.08);
  }

  .tab-dropdown__sub {
    display: flex;
    flex-direction: column;
    padding: 2px 0;
    border-top: 1px solid rgba(255, 255, 255, 0.04);
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    margin: 2px 0;
  }

  .tab-dropdown__sublabel {
    font-size: 10px;
    color: var(--text-faint, #3B4261);
    padding: 4px 10px 2px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .tab-bar__add {
    flex-shrink: 0;
  }

  .tab-bar__add-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border: none;
    border-radius: 4px;
    background: none;
    color: var(--text-faint, #3B4261);
    font-size: 14px;
    cursor: pointer;
    transition: color 120ms;
  }

  .tab-bar__add-btn:hover {
    color: var(--text-muted, #6B7394);
  }
</style>
