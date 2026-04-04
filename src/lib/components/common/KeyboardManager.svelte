<script lang="ts">
  import { matchesShortcut, type AppShortcuts } from "../../utils/shortcuts";

  let {
    onquickopen,
    oncommandpalette,
    onnewnote,
    ontogglesidebar,
    ontogglerightpanel,
    ondeletefile,
    oncloseoverlay,
    keymap,
    overlayOpen = false,
  }: {
    onquickopen: () => void;
    oncommandpalette: () => void;
    onnewnote: () => void;
    ontogglesidebar: () => void;
    ontogglerightpanel: () => void;
    ondeletefile: () => void;
    oncloseoverlay: () => void;
    keymap: AppShortcuts;
    overlayOpen?: boolean;
  } = $props();

  function isInputFocused(): boolean {
    const active = document.activeElement;
    if (!active) return false;
    const tag = active.tagName.toLowerCase();
    return (
      tag === "input" ||
      tag === "textarea" ||
      tag === "select" ||
      (active as HTMLElement).isContentEditable
    );
  }

  function handleKeydown(e: KeyboardEvent) {
    // Escape always works -- closes overlays
    if (e.key === "Escape") {
      e.preventDefault();
      oncloseoverlay();
      return;
    }

    // If overlay is open, only handle overlay-specific keys
    // (arrow/enter are handled by individual overlay components)
    if (overlayOpen) return;

    // If input focused, don't capture global shortcuts
    if (isInputFocused()) return;

    if (matchesShortcut(e, keymap.quick_open)) {
      e.preventDefault();
      onquickopen();
      return;
    }

    if (matchesShortcut(e, keymap.command_palette)) {
      e.preventDefault();
      oncommandpalette();
      return;
    }

    if (matchesShortcut(e, keymap.new_note)) {
      e.preventDefault();
      onnewnote();
      return;
    }

    if (matchesShortcut(e, keymap.toggle_sidebar)) {
      e.preventDefault();
      ontogglesidebar();
      return;
    }

    if (matchesShortcut(e, keymap.toggle_right_panel)) {
      e.preventDefault();
      ontogglerightpanel();
      return;
    }

    if (matchesShortcut(e, keymap.delete_file)) {
      e.preventDefault();
      ondeletefile();
      return;
    }
  }

  $effect(() => {
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  });
</script>
