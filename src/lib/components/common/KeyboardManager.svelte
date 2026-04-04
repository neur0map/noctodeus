<script lang="ts">
  let {
    onquickopen,
    oncommandpalette,
    onnewnote,
    ontogglesidebar,
    ontogglrightpanel,
    ondeletefile,
    onclosoverlay,
    overlayOpen = false,
  }: {
    onquickopen: () => void;
    oncommandpalette: () => void;
    onnewnote: () => void;
    ontogglesidebar: () => void;
    ontogglrightpanel: () => void;
    ondeletefile: () => void;
    onclosoverlay: () => void;
    overlayOpen?: boolean;
  } = $props();

  function isInputFocused(): boolean {
    const active = document.activeElement;
    if (!active) return false;
    const tag = active.tagName.toLowerCase();
    return (
      tag === 'input' ||
      tag === 'textarea' ||
      tag === 'select' ||
      (active as HTMLElement).isContentEditable
    );
  }

  function handleKeydown(e: KeyboardEvent) {
    const meta = e.metaKey || e.ctrlKey;

    // Escape always works -- closes overlays
    if (e.key === 'Escape') {
      e.preventDefault();
      onclosoverlay();
      return;
    }

    // If overlay is open, only handle overlay-specific keys
    // (arrow/enter are handled by individual overlay components)
    if (overlayOpen) return;

    // If input focused, don't capture global shortcuts
    if (isInputFocused()) return;

    // Cmd+P: Quick open
    if (meta && !e.shiftKey && e.key === 'p') {
      e.preventDefault();
      onquickopen();
      return;
    }

    // Cmd+Shift+P: Command palette
    if (meta && e.shiftKey && e.key === 'p') {
      e.preventDefault();
      oncommandpalette();
      return;
    }

    // Cmd+N: New note
    if (meta && e.key === 'n') {
      e.preventDefault();
      onnewnote();
      return;
    }

    // Cmd+B: Toggle sidebar
    if (meta && e.key === 'b') {
      e.preventDefault();
      ontogglesidebar();
      return;
    }

    // Cmd+\: Toggle right panel
    if (meta && e.key === '\\') {
      e.preventDefault();
      ontogglrightpanel();
      return;
    }

    // Cmd+Backspace: Delete file
    if (meta && e.key === 'Backspace') {
      e.preventDefault();
      ondeletefile();
      return;
    }
  }

  $effect(() => {
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  });
</script>
