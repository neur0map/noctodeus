<script lang="ts">
  import type { SearchHit, TreeNode } from "$lib/types/core";

  import { getUiState } from "$lib/stores/ui.svelte";
  import { getCoreState } from "$lib/stores/core.svelte";
  import { getFilesState } from "$lib/stores/files.svelte";

  import Sidebar from "$lib/components/layout/Sidebar.svelte";
  import SearchBar from "$lib/components/search/SearchBar.svelte";
  import FileTree from "$lib/components/filetree/FileTree.svelte";
  import CalendarWidget from "$lib/components/sidebar/CalendarWidget.svelte";
  import CoreSwitcher from "$lib/components/common/CoreSwitcher.svelte";
  import Ellipsis from "@lucide/svelte/icons/ellipsis";
  import Settings from "@lucide/svelte/icons/settings";

  let {
    searchResults,
    journalDates,
    onFileSelect,
    onDirToggle,
    onContextMenu,
    onDelete,
    onMove,
    onRename,
    onSearch,
    onDailyNote,
    onSidebarMenuOpen,
  }: {
    searchResults: SearchHit[];
    journalDates: Set<string>;
    onFileSelect: (path: string) => void;
    onDirToggle: (path: string) => void;
    onContextMenu: (path: string, isDir: boolean, e: MouseEvent) => void;
    onDelete: () => void;
    onMove: (sourcePath: string, targetDir: string) => void;
    onRename: (oldPath: string, newName: string) => void;
    onSearch: (query: string) => void;
    onDailyNote: (dateStr: string) => void;
    onSidebarMenuOpen: (e: MouseEvent) => void;
  } = $props();

  const ui = getUiState();
  const core = getCoreState();
  const files = getFilesState();
</script>

<Sidebar collapsed={ui.sidebarCollapsed} ontogglecollapse={() => ui.toggleSidebarCollapse()}>
  {#snippet header()}
    <div class="sidebar-header">
      <button class="sidebar-header__btn" onclick={onSidebarMenuOpen} title="Actions">
        <Ellipsis size={14} />
      </button>
    </div>
  {/snippet}

  <SearchBar
    results={searchResults}
    onselect={onFileSelect}
    onsearch={onSearch}
  />

  <FileTree
    tree={files.tree}
    activeFilePath={files.activeFilePath}
    onselect={onFileSelect}
    ontoggle={onDirToggle}
    oncontextmenu={onContextMenu}
    ondelete={onDelete}
    onmove={onMove}
    onrename={onRename}
  />

  <CalendarWidget
    existingDates={journalDates}
    onselect={onDailyNote}
  />

  {#snippet footer()}
    <div class="sidebar-footer">
      <CoreSwitcher
        activeCore={core.activeCore}
        onswitch={(c) => window.dispatchEvent(new CustomEvent('noctodeus-switch-core', { detail: c.path }))}
        onopen={() => window.dispatchEvent(new CustomEvent('noctodeus-open-core'))}
      />
      <button
        class="sidebar-footer__settings"
        onclick={() => ui.showSettings()}
        title="Settings"
      >
        <Settings size={15} />
      </button>
    </div>
  {/snippet}
</Sidebar>

<style>
  /* ── Sidebar header ── */
  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 28px;
  }

  .sidebar-header__btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--color-placeholder);
    font-size: 12px;
    cursor: pointer;
    transition: color 150ms var(--ease-expo-out), background 150ms var(--ease-expo-out);
  }

  .sidebar-header__btn:hover {
    color: var(--color-foreground);
    background: var(--color-hover);
  }

  /* ── Sidebar footer ── */
  .sidebar-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 24px;
  }

  .sidebar-footer__settings {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 5px;
    background: transparent;
    color: var(--color-placeholder);
    cursor: pointer;
    transition: color 150ms var(--ease-expo-out), background 150ms var(--ease-expo-out);
  }

  .sidebar-footer__settings:hover {
    color: var(--color-muted-foreground);
    background: var(--color-hover);
  }
</style>
