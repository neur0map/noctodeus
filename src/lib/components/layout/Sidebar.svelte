<script lang="ts">
  import type { Snippet } from "svelte";
  import ChevronLeft from "@lucide/svelte/icons/chevron-left";
  import PanelLeftOpen from "@lucide/svelte/icons/panel-left-open";

  let {
    header,
    children,
    footer,
    collapsed = false,
    ontogglecollapse,
  }: {
    header?: Snippet;
    children: Snippet;
    footer?: Snippet;
    collapsed?: boolean;
    ontogglecollapse?: () => void;
  } = $props();
</script>

{#if collapsed}
  <div class="sidebar sidebar--collapsed">
    <button class="sidebar__expand" onclick={ontogglecollapse} title="Expand sidebar">
      <PanelLeftOpen size={16} />
    </button>
  </div>
{:else}
  <div class="sidebar">
    {#if header}
      <div class="sidebar__header">
        <div class="sidebar__header-content">
          {@render header()}
        </div>
        {#if ontogglecollapse}
          <button class="sidebar__collapse" onclick={ontogglecollapse} title="Collapse sidebar">
            <ChevronLeft size={14} />
          </button>
        {/if}
      </div>
    {/if}

    <div class="sidebar__body">
      {@render children()}
    </div>

    {#if footer}
      <div class="sidebar__footer">
        {@render footer()}
      </div>
    {/if}
  </div>
{/if}

<style lang="scss">
  .sidebar {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--color-card);
  }

  .sidebar--collapsed {
    align-items: center;
    padding-top: 12px;
  }

  .sidebar__expand {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--color-muted-foreground);
    cursor: pointer;
    transition: color 150ms var(--ease-expo-out), background 150ms var(--ease-expo-out);
  }

  .sidebar__expand:hover {
    color: var(--color-foreground);
    background: var(--color-hover);
  }

  .sidebar__header {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 12px 12px 0;
    flex-shrink: 0;
  }

  .sidebar__header-content {
    flex: 1;
    min-width: 0;
  }

  .sidebar__collapse {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--color-placeholder);
    cursor: pointer;
    flex-shrink: 0;
    transition: color 150ms var(--ease-expo-out), background 150ms var(--ease-expo-out);
  }

  .sidebar__collapse:hover {
    color: var(--color-foreground);
    background: var(--color-hover);
  }

  .sidebar__body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 4px 0;
    scrollbar-width: none;
  }
  .sidebar__body::-webkit-scrollbar { display: none; }

  .sidebar__footer {
    flex-shrink: 0;
    padding: 8px 12px;
    border-top: 1px solid var(--color-border);
  }
</style>
