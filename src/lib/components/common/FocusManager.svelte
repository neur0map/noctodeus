<script lang="ts">
  import { onMount } from 'svelte';
  import type { Snippet } from 'svelte';

  let {
    children,
    overlayOpen = false,
  }: {
    children: Snippet;
    overlayOpen: boolean;
  } = $props();

  type Zone = 'filetree' | 'editor';
  const ZONES: Zone[] = ['filetree', 'editor'];

  let currentZone = $state<Zone>('editor');

  function nextZone() {
    const idx = ZONES.indexOf(currentZone);
    currentZone = ZONES[(idx + 1) % ZONES.length];
    dispatchZoneChange();
  }

  function prevZone() {
    const idx = ZONES.indexOf(currentZone);
    currentZone = ZONES[(idx - 1 + ZONES.length) % ZONES.length];
    dispatchZoneChange();
  }

  function setZone(zone: Zone) {
    if (currentZone !== zone) {
      currentZone = zone;
      dispatchZoneChange();
    }
  }

  function dispatchZoneChange() {
    window.dispatchEvent(new CustomEvent('noctodeus-zone-change', { detail: currentZone }));
  }

  onMount(() => {
    function handleKeydown(e: KeyboardEvent) {
      if (overlayOpen) return;

      // Ctrl+Tab / Ctrl+Shift+Tab to cycle zones
      if (e.ctrlKey && e.key === 'Tab') {
        e.preventDefault();
        if (e.shiftKey) {
          prevZone();
        } else {
          nextZone();
        }
        return;
      }

      // Escape returns to editor (when not in editor and no overlay)
      if (e.key === 'Escape' && currentZone !== 'editor') {
        e.preventDefault();
        setZone('editor');
        // Focus the editor element
        const editor = (document.querySelector('.bn-editor') ?? document.querySelector('.ProseMirror')) as HTMLElement;
        editor?.focus();
        return;
      }
    }

    // Detect zone from clicks
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (target.closest('.sidebar__body, .tree-node, .search-bar, .cal')) {
        setZone('filetree');
      } else if (target.closest('.bn-editor, .blocknote-container, .editor-container, .inline-title')) {
        setZone('editor');
      }
    }

    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('click', handleClick, true);

    return () => {
      document.removeEventListener('keydown', handleKeydown);
      document.removeEventListener('click', handleClick, true);
    };
  });
</script>

{@render children()}
