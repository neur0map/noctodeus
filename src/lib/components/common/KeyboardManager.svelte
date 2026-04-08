<script lang="ts">
  import { matchesShortcut, type AppShortcuts } from "../../utils/shortcuts";

  let {
    onquickopen,
    onsearch,
    oncommandpalette,
    onnewnote,
    ontogglesidebar,
    oncollapsesidebar,
    ontogglerightpanel,
    ondeletefile,
    ontoggleaichat,
    oncloseoverlay,
    keymap,
    overlayOpen = false,
  }: {
    onquickopen: () => void;
    onsearch: () => void;
    oncommandpalette: () => void;
    onnewnote: () => void;
    ontogglesidebar: () => void;
    oncollapsesidebar: () => void;
    ontogglerightpanel: () => void;
    ondeletefile: () => void;
    ontoggleaichat: () => void;
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
    if (overlayOpen) return;

    // ── Global shortcuts: work even when editor is focused ──
    // These override editor keybinds (e.g., Cmd+K, Cmd+P, Cmd+N)

    if (matchesShortcut(e, keymap.search)) {
      e.preventDefault();
      onsearch();
      return;
    }

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

    if (matchesShortcut(e, keymap.delete_file)) {
      e.preventDefault();
      ondeletefile();
      return;
    }

    if (matchesShortcut(e, keymap.toggle_sidebar)) {
      e.preventDefault();
      ontogglesidebar();
      return;
    }

    if (matchesShortcut(e, keymap.collapse_sidebar)) {
      e.preventDefault();
      oncollapsesidebar();
      return;
    }

    if (matchesShortcut(e, keymap.toggle_right_panel)) {
      e.preventDefault();
      ontogglerightpanel();
      return;
    }

    if (matchesShortcut(e, keymap.toggle_ai_chat)) {
      e.preventDefault();
      ontoggleaichat();
      return;
    }

  }

  $effect(() => {
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  });
</script>
