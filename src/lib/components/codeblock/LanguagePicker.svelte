<script lang="ts">
  import { SUPPORTED_LANGUAGES, type SupportedLanguage } from './types';
  import { onMount, onDestroy } from 'svelte';

  let {
    onselect,
    onclose,
    top = 0,
    left = 0,
    fixed = false,
  }: {
    onselect: (lang: SupportedLanguage) => void;
    onclose: () => void;
    top?: number;
    left?: number;
    fixed?: boolean;
  } = $props();

  let portalEl: HTMLDivElement | undefined;

  function createPortal() {
    portalEl = document.createElement('div');
    Object.assign(portalEl.style, {
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      zIndex: '99999',
      display: 'flex',
      flexDirection: 'column',
      minWidth: '140px',
      padding: '4px',
      borderRadius: '8px',
      border: '1px solid #1E2336',
      background: '#1A1E2E',
      boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    });

    for (const lang of SUPPORTED_LANGUAGES) {
      const btn = document.createElement('button');
      Object.assign(btn.style, {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        padding: '6px 10px',
        border: 'none',
        borderRadius: '4px',
        background: 'none',
        color: '#C0CAF5',
        fontSize: '12px',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
      });
      btn.innerHTML = `<span>${lang.label}</span><span style="color:#6B7394;font-family:var(--font-mono);font-size:11px">${lang.ext}</span>`;
      btn.addEventListener('mouseenter', () => { btn.style.background = 'rgba(255,255,255,0.06)'; });
      btn.addEventListener('mouseleave', () => { btn.style.background = 'none'; });
      btn.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); });
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        onselect(lang.id);
        onclose();
      });
      portalEl.appendChild(btn);
    }

    document.body.appendChild(portalEl);
  }

  onMount(() => {
    if (fixed) {
      createPortal();
    }

    function handleKeydown(e: KeyboardEvent) {
      if (e.key === 'Escape') onclose();
    }
    document.addEventListener('keydown', handleKeydown);

    // Click outside (delayed to avoid catching the trigger click)
    let clickHandler: ((e: MouseEvent) => void) | undefined;
    const raf = requestAnimationFrame(() => {
      clickHandler = (e: MouseEvent) => {
        if (portalEl && !portalEl.contains(e.target as Node)) {
          onclose();
        }
      };
      document.addEventListener('mousedown', clickHandler);
    });

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', handleKeydown);
      if (clickHandler) document.removeEventListener('mousedown', clickHandler);
    };
  });

  onDestroy(() => {
    portalEl?.remove();
  });
</script>

{#if !fixed}
  <div class="lang-picker">
    {#each SUPPORTED_LANGUAGES as lang}
      <button
        class="lang-picker__item"
        onclick={(e) => { e.preventDefault(); e.stopPropagation(); onselect(lang.id); onclose(); }}
        onmousedown={(e) => { e.preventDefault(); e.stopPropagation(); }}
      >
        <span class="lang-picker__label">{lang.label}</span>
        <span class="lang-picker__ext">{lang.ext}</span>
      </button>
    {/each}
  </div>
{/if}

<style>
  .lang-picker {
    display: flex;
    flex-direction: column;
    min-width: 140px;
    padding: 4px;
    border-radius: 8px;
    border: 1px solid var(--border-subtle, #1E2336);
    background: var(--surface-2, #1A1E2E);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  }

  .lang-picker__item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 6px 10px;
    border: none;
    border-radius: 4px;
    background: none;
    color: var(--text-primary, #C0CAF5);
    font-size: 12px;
    cursor: pointer;
    text-align: left;
  }

  .lang-picker__item:hover {
    background: rgba(255, 255, 255, 0.06);
  }

  .lang-picker__ext {
    color: var(--text-muted, #6B7394);
    font-family: var(--font-mono);
    font-size: 11px;
  }
</style>
