<script lang="ts">
  import type { Snippet } from "svelte";

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

<div class="sidebar" class:sidebar--collapsed={collapsed}>
  {#if collapsed}
    <div class="sidebar__rail">
      <button class="rail-button" onclick={ontogglecollapse} title="Expand sidebar">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M6 3L11 8L6 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
  {:else}
    {#if header}
      <div class="sidebar__header">
        <div class="sidebar__header-content">
          {@render header()}
        </div>
        {#if ontogglecollapse}
          <button class="collapse-button" onclick={ontogglecollapse} title="Collapse sidebar">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8L10 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
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
  {/if}
</div>

<style>
  .sidebar {
    display: flex;
    flex-direction: column;
    height: 100%;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent 16%),
      rgba(10, 11, 15, 0.86);
    border-right: 1px solid rgba(255, 255, 255, 0.05);
    overflow: hidden;
  }

  .sidebar--collapsed {
    align-items: center;
  }

  .sidebar__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
    padding: 12px
      16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    width: 100%;
  }

  .sidebar__header-content {
    flex: 1;
    min-width: 0;
  }

  .sidebar__body {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .sidebar__footer {
    flex-shrink: 0;
    padding: 8px
      16px;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
  }

  .sidebar__rail {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-top: 12px;
    gap: 8px;
    height: 100%;
  }

  .rail-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.46);
    cursor: pointer;
    transition:
      color 150ms var(--ease-expo-out),
      background 150ms var(--ease-expo-out);
    animation: rail-icon-enter 150ms var(--ease-expo-out) both;
  }

  .rail-button:hover {
    color: var(--color-foreground);
    background: rgba(255, 255, 255, 0.06);
  }

  @keyframes rail-icon-enter {
    from {
      opacity: 0;
      transform: scale(0.9);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .collapse-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 6px;
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.36);
    cursor: pointer;
    flex-shrink: 0;
    transition:
      color 150ms var(--ease-expo-out),
      background 150ms var(--ease-expo-out);
  }

  .collapse-button:hover {
    color: var(--color-foreground);
    background: rgba(255, 255, 255, 0.06);
  }
</style>
