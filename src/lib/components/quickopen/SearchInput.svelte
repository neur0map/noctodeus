<script lang="ts">
  import Search from '@lucide/svelte/icons/search';
  import { animate, createSpring } from 'animejs';

  let {
    value = $bindable(''),
    placeholder = 'Search files and content...',
    prefix = '',
  }: {
    value?: string;
    placeholder?: string;
    prefix?: string;
  } = $props();

  let inputEl: HTMLInputElement | undefined = $state();
  let iconEl: HTMLElement | undefined = $state();
  let containerEl: HTMLElement | undefined = $state();

  const soft = createSpring({ stiffness: 200, damping: 18, mass: 0.8 });

  $effect(() => {
    inputEl?.focus();

    // Micro-animation: icon scales in, input slides from left
    requestAnimationFrame(() => {
      if (iconEl) {
        animate(iconEl, {
          opacity: [0, 0.6],
          scale: [0.5, 1],
          rotate: [-20, 0],
          duration: 400,
          ease: soft,
        });
      }
      if (inputEl) {
        animate(inputEl, {
          opacity: [0, 1],
          translateX: [-8, 0],
          duration: 300,
          ease: 'outQuint',
          delay: 80,
        });
      }
    });
  });
</script>

<div class="si" bind:this={containerEl}>
  {#if prefix}
    <span class="si__prefix">{prefix}</span>
  {:else}
    <span class="si__icon-wrap" bind:this={iconEl}>
      <Search size={18} />
    </span>
  {/if}
  <input
    bind:this={inputEl}
    bind:value
    type="text"
    class="si__input"
    {placeholder}
    autocomplete="off"
    spellcheck="false"
  />
  {#if value}
    <button class="si__clear" onclick={() => value = ''} aria-label="Clear search">×</button>
  {/if}
</div>

<style>
  .si {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }

  .si__icon-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--accent-blue, #7AA2F7);
    flex-shrink: 0;
    opacity: 0; /* anime.js animates in */
  }

  .si__input {
    flex: 1;
    font-family: var(--font-mono);
    font-size: 16px;
    font-weight: 400;
    letter-spacing: -0.01em;
    line-height: 1.4;
    color: var(--text-primary, #C0CAF5);
    background: transparent;
    border: none;
    outline: none;
    caret-color: var(--accent-blue, #7AA2F7);
    opacity: 0; /* anime.js animates in */
  }

  .si__input::placeholder {
    color: var(--text-faint, #3B4261);
  }

  .si__clear {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border: none;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.06);
    color: var(--text-muted, #6B7394);
    font-size: 14px;
    cursor: pointer;
    transition: background 150ms ease-out, color 150ms ease-out;
    flex-shrink: 0;
  }

  .si__clear:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--text-primary, #C0CAF5);
  }

  .si__prefix {
    font-family: var(--font-mono);
    font-size: 18px;
    color: var(--accent-blue, #7AA2F7);
    opacity: 0.7;
    user-select: none;
    flex-shrink: 0;
  }
</style>
