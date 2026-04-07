<script lang="ts">
  import type { CodeTab, SupportedLanguage } from './types';
  import { SUPPORTED_LANGUAGES } from './types';
  import ContextMenu from '$lib/components/common/ContextMenu.svelte';
  import type { MenuItem } from '$lib/components/common/ContextMenu.svelte';

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

  // Tab context menu state
  let menuVisible = $state(false);
  let menuPos = $state({ top: 0, left: 0 });
  let menuTabId = $state<string | null>(null);

  // Add tab menu state
  let addMenuVisible = $state(false);
  let addMenuPos = $state({ top: 0, left: 0 });

  // Rename state
  let renamingTabId = $state<string | null>(null);
  let renameValue = $state('');

  // Build menu items for a tab
  function tabMenuItems(tab: CodeTab): MenuItem[] {
    const items: MenuItem[] = [
      { id: 'rename', label: 'Rename' },
      { id: 'sep1', label: '', separator: true },
    ];
    for (const lang of SUPPORTED_LANGUAGES) {
      items.push({
        id: `lang:${lang.id}`,
        label: lang.label,
        icon: tab.language === lang.id ? '●' : '',
      });
    }
    if (tabs.length > 1) {
      items.push({ id: 'sep2', label: '', separator: true });
      items.push({ id: 'delete', label: 'Delete tab', danger: true });
    }
    return items;
  }

  // Language picker items for + button
  const addMenuItems: MenuItem[] = SUPPORTED_LANGUAGES.map(lang => ({
    id: lang.id,
    label: `${lang.label}  ${lang.ext}`,
  }));

  function openTabMenu(e: MouseEvent, tabId: string) {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    menuPos = { top: rect.bottom + 4, left: rect.left };
    menuTabId = tabId;
    menuVisible = true;
  }

  function handleTabMenuSelect(id: string) {
    menuVisible = false;
    if (!menuTabId) return;

    if (id === 'rename') {
      const tab = tabs.find(t => t.id === menuTabId);
      if (tab) {
        renamingTabId = menuTabId;
        renameValue = tab.name;
      }
    } else if (id === 'delete') {
      onremove(menuTabId);
    } else if (id.startsWith('lang:')) {
      const lang = id.replace('lang:', '') as SupportedLanguage;
      onchangelang(menuTabId, lang);
    }
    menuTabId = null;
  }

  function openAddMenu(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    addMenuPos = { top: rect.bottom + 4, left: rect.left };
    addMenuVisible = true;
  }

  function handleAddSelect(id: string) {
    addMenuVisible = false;
    onadd(id as SupportedLanguage);
  }

  function commitRename(id: string) {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== tabs.find(t => t.id === id)?.name) {
      onrename(id, trimmed);
    }
    renamingTabId = null;
  }

  function handleRenameKeydown(e: KeyboardEvent, id: string) {
    if (e.key === 'Enter') commitRename(id);
    else if (e.key === 'Escape') renamingTabId = null;
  }
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
          {#if tabs.length > 1}
            <button
              class="tab-bar__close"
              onclick={(e) => { e.preventDefault(); e.stopPropagation(); onremove(tab.id); }}
              onmousedown={(e) => { e.preventDefault(); e.stopPropagation(); }}
              title="Close tab"
            >&times;</button>
          {/if}
        {/if}

        <button
          class="tab-bar__menu-btn"
          onclick={(e) => openTabMenu(e, tab.id)}
          onmousedown={(e) => { e.preventDefault(); e.stopPropagation(); }}
          title="Tab options"
        >▾</button>
      </div>
    {/each}
  </div>

  <button
    class="tab-bar__add-btn"
    onclick={openAddMenu}
    onmousedown={(e) => { e.preventDefault(); e.stopPropagation(); }}
    title="Add tab"
  >+</button>
</div>

<!-- Reuse the app's existing ContextMenu component for both menus -->
<ContextMenu
  visible={menuVisible}
  position={menuPos}
  items={menuTabId ? tabMenuItems(tabs.find(t => t.id === menuTabId)!) : []}
  onselect={handleTabMenuSelect}
  onclose={() => { menuVisible = false; menuTabId = null; }}
/>

<ContextMenu
  visible={addMenuVisible}
  position={addMenuPos}
  items={addMenuItems}
  onselect={handleAddSelect}
  onclose={() => addMenuVisible = false}
/>

<style>
  .tab-bar {
    display: flex;
    align-items: center;
    gap: 4px;
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

  .tab-bar__close {
    border: none;
    background: none;
    color: var(--text-faint, #3B4261);
    font-size: 12px;
    cursor: pointer;
    padding: 0 2px;
    opacity: 0;
    transition: opacity 120ms, color 120ms;
  }

  .tab-bar__tab:hover .tab-bar__close {
    opacity: 1;
  }

  .tab-bar__close:hover {
    color: var(--accent-red, #F7768E);
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
    flex-shrink: 0;
  }

  .tab-bar__add-btn:hover {
    color: var(--text-muted, #6B7394);
  }
</style>
