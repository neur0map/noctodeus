<script lang="ts">
  export interface MenuItem {
    id: string;
    label: string;
    icon?: string;
    danger?: boolean;
    separator?: boolean;
  }

  let {
    visible = false,
    position = { top: 0, left: 0 },
    items = [],
    onselect,
    onclose,
  }: {
    visible: boolean;
    position: { top: number; left: number };
    items: MenuItem[];
    onselect: (id: string) => void;
    onclose: () => void;
  } = $props();

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); onclose(); }
  }
</script>

<svelte:window onkeydown={visible ? handleKeydown : undefined} />

{#if visible}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="ctx-backdrop" onclick={onclose}></div>
  <div
    class="ctx-menu"
    style="top: {position.top}px; left: {position.left}px;"
    role="menu"
  >
    {#each items as item (item.id)}
      {#if item.separator}
        <div class="ctx-menu__sep"></div>
      {:else}
        <button
          class="ctx-menu__item"
          class:ctx-menu__item--danger={item.danger}
          role="menuitem"
          onclick={(e) => { e.stopPropagation(); onselect(item.id); }}
        >
          {#if item.icon}
            <span class="ctx-menu__icon">{item.icon}</span>
          {/if}
          <span>{item.label}</span>
        </button>
      {/if}
    {/each}
  </div>
{/if}

<style>
  .ctx-backdrop {
    position: fixed;
    inset: 0;
    z-index: 299;
  }

  .ctx-menu {
    position: fixed;
    z-index: 300;
    min-width: 180px;
    background: rgba(18, 19, 24, 0.98);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    box-shadow:
      0 6px 32px rgba(0, 0, 0, 0.5),
      0 0 0 1px rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(20px);
    padding: 3px;
    animation: ctx-in 150ms var(--ease-expo-out) both;
  }

  @keyframes ctx-in {
    from { opacity: 0; transform: scale(0.96); }
    to { opacity: 1; transform: scale(1); }
  }

  .ctx-menu__item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px 10px;
    border: none;
    border-radius: 5px;
    background: transparent;
    color: rgba(255, 255, 255, 0.7);
    font-family: var(--font-sans);
    font-size: 13px;
    cursor: pointer;
    text-align: left;
    transition: background 150ms var(--ease-expo-out);
  }

  .ctx-menu__item:hover {
    background: rgba(255, 255, 255, 0.07);
    color: var(--color-foreground);
  }

  .ctx-menu__item--danger:hover {
    background: rgba(239, 68, 68, 0.12);
    color: var(--color-destructive);
  }

  .ctx-menu__icon {
    width: 16px;
    text-align: center;
    font-size: 12px;
    opacity: 0.6;
  }

  .ctx-menu__sep {
    height: 1px;
    background: rgba(255, 255, 255, 0.06);
    margin: 3px 6px;
  }

  @media (prefers-reduced-motion: reduce) {
    .ctx-menu { animation: none; }
  }
</style>
