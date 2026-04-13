<script lang="ts">
  import { getUiState } from "$lib/stores/ui.svelte";
  import { getCoreState } from "$lib/stores/core.svelte";
  import { getFilesState } from "$lib/stores/files.svelte";

  import Sidebar from "$lib/components/layout/Sidebar.svelte";
  import FileTree from "$lib/components/filetree/FileTree.svelte";
  import CalendarWidget from "$lib/components/sidebar/CalendarWidget.svelte";
  import CoreSwitcher from "$lib/components/common/CoreSwitcher.svelte";
  import Ellipsis from "@lucide/svelte/icons/ellipsis";
  import Settings from "@lucide/svelte/icons/settings";
  import SyncButton from "$lib/components/layout/SyncButton.svelte";
  import { nerdIcon } from "$lib/utils/nerd-icons";

  let {
    journalDates,
    onFileSelect,
    onDirToggle,
    onContextMenu,
    onDelete,
    onMove,
    onRename,
    onDailyNote,
    onSidebarMenuOpen,
  }: {
    journalDates: Set<string>;
    onFileSelect: (path: string) => void;
    onDirToggle: (path: string) => void;
    onContextMenu: (path: string, isDir: boolean, e: MouseEvent) => void;
    onDelete: () => void;
    onMove: (sourcePath: string, targetDir: string) => void;
    onRename: (oldPath: string, newName: string) => void;
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
      <div class="sidebar-header__spacer"></div>
      <button
        class="sidebar-header__btn"
        class:sidebar-header__btn--active={ui.graphPanelVisible}
        onclick={() => ui.toggleGraphPanel()}
        title="Graph"
      >
        <span class="sidebar-header__nerd">{nerdIcon('graph')}</span>
      </button>
      <button
        class="sidebar-header__btn"
        class:sidebar-header__btn--active={ui.tasksVisible}
        onclick={() => ui.showTasks()}
        title="Tasks"
      >
        <span class="sidebar-header__nerd">{nerdIcon('tasks')}</span>
      </button>
    </div>
  {/snippet}

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
        onswitch={(c) => window.dispatchEvent(new CustomEvent('nodeus-switch-core', { detail: c.path }))}
        onopen={() => window.dispatchEvent(new CustomEvent('nodeus-open-core'))}
      />
      <div class="sidebar-footer__actions">
        <SyncButton />
        <button
          class="sidebar-footer__btn"
          class:sidebar-footer__btn--active={ui.panelModalVisible}
          onclick={() => ui.showPanelModal()}
          title="Note panel"
        >
          <span class="sidebar-footer__nerd">{nerdIcon('info')}</span>
        </button>
        <button
          class="sidebar-footer__btn"
          onclick={() => ui.showSettings()}
          title="Settings"
        >
          <Settings size={15} />
        </button>
      </div>
    </div>
  {/snippet}
</Sidebar>

<style>
  /* -- Sidebar header -- */
  .sidebar-header {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 32px;
  }

  .sidebar-header__spacer {
    flex: 1;
  }

  .sidebar-header__btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
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

  .sidebar-header__btn--active {
    color: var(--accent-blue, var(--color-accent));
  }

  .sidebar-header__nerd {
    font-family: var(--font-mono);
    font-size: 14px;
    line-height: 1;
  }

  /* -- Sidebar footer -- */
  .sidebar-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 28px;
  }

  .sidebar-footer__actions {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .sidebar-footer__btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 5px;
    background: transparent;
    color: var(--color-placeholder);
    cursor: pointer;
    transition: color 150ms var(--ease-expo-out), background 150ms var(--ease-expo-out);
  }

  .sidebar-footer__btn:hover {
    color: var(--color-muted-foreground);
    background: var(--color-hover);
  }

  .sidebar-footer__btn--active {
    color: var(--accent-blue, var(--color-accent));
  }

  .sidebar-footer__nerd {
    font-family: var(--font-mono);
    font-size: 14px;
    line-height: 1;
  }
</style>
