<script lang="ts">
  import type { Editor } from '@tiptap/core';

  let {
    editor,
    visible = false,
    position = { top: 0, left: 0 },
  }: {
    editor: Editor | null;
    visible: boolean;
    position: { top: number; left: number };
  } = $props();

  let showSizeMenu = $state(false);

  function toggle(cmd: string) {
    if (!editor) return;
    switch (cmd) {
      case 'bold': editor.chain().focus().toggleBold().run(); break;
      case 'italic': editor.chain().focus().toggleItalic().run(); break;
      case 'code': editor.chain().focus().toggleCode().run(); break;
      case 'strike': editor.chain().focus().toggleStrike().run(); break;
      case 'link': {
        if (editor.isActive('link')) {
          editor.chain().focus().unsetLink().run();
        } else {
          const url = window.prompt('URL');
          if (url) editor.chain().focus().setLink({ href: url }).run();
        }
        break;
      }
    }
  }

  function setHeading(level: number) {
    if (!editor) return;
    if (level === 0) {
      editor.chain().focus().setParagraph().run();
    } else {
      editor.chain().focus().setHeading({ level: level as 1|2|3 }).run();
    }
    showSizeMenu = false;
  }

  function isActive(cmd: string): boolean {
    if (!editor) return false;
    return editor.isActive(cmd);
  }

  function currentBlockLabel(): string {
    if (!editor) return 'T';
    if (editor.isActive('heading', { level: 1 })) return 'H1';
    if (editor.isActive('heading', { level: 2 })) return 'H2';
    if (editor.isActive('heading', { level: 3 })) return 'H3';
    return 'T';
  }
</script>

{#if visible && editor}
  <div
    class="bt"
    style="top: {position.top}px; left: {position.left}px;"
  >
    <div class="bt__row">
      <!-- Block type toggle -->
      <button
        class="bt__btn bt__btn--wide"
        class:bt__btn--active={showSizeMenu}
        onclick={() => showSizeMenu = !showSizeMenu}
      >
        {currentBlockLabel()}
      </button>

      <span class="bt__sep"></span>

      <button class="bt__btn" class:bt__btn--active={isActive('bold')} onclick={() => toggle('bold')} title="Bold">
        B
      </button>
      <button class="bt__btn bt__btn--italic" class:bt__btn--active={isActive('italic')} onclick={() => toggle('italic')} title="Italic">
        I
      </button>
      <button class="bt__btn" class:bt__btn--active={isActive('strike')} onclick={() => toggle('strike')} title="Strikethrough">
        S
      </button>
      <button class="bt__btn" class:bt__btn--active={isActive('code')} onclick={() => toggle('code')} title="Inline code">
        &lt;&gt;
      </button>
      <button class="bt__btn" class:bt__btn--active={isActive('link')} onclick={() => toggle('link')} title="Link">
        ⌁
      </button>
    </div>

    {#if showSizeMenu}
      <div class="bt__dropdown">
        <button class="bt__dd-item" class:bt__dd-item--active={!isActive('heading')} onclick={() => setHeading(0)}>
          <span class="bt__dd-icon">T</span> Text
        </button>
        <button class="bt__dd-item" class:bt__dd-item--active={isActive('heading') && editor.isActive('heading', {level:1})} onclick={() => setHeading(1)}>
          <span class="bt__dd-icon">H1</span> Heading 1
        </button>
        <button class="bt__dd-item" class:bt__dd-item--active={isActive('heading') && editor.isActive('heading', {level:2})} onclick={() => setHeading(2)}>
          <span class="bt__dd-icon">H2</span> Heading 2
        </button>
        <button class="bt__dd-item" class:bt__dd-item--active={isActive('heading') && editor.isActive('heading', {level:3})} onclick={() => setHeading(3)}>
          <span class="bt__dd-icon">H3</span> Heading 3
        </button>
      </div>
    {/if}
  </div>
{/if}

<style>
  .bt {
    position: fixed;
    z-index: 200;
    background: rgba(18, 19, 24, 0.98);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    box-shadow:
      0 6px 32px rgba(0, 0, 0, 0.5),
      0 0 0 1px rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(20px);
    padding: 3px;
    animation: bt-in var(--duration-fast) var(--ease-out) both;
    user-select: none;
  }

  @keyframes bt-in {
    from { opacity: 0; transform: translateY(4px) scale(0.97); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  .bt__row {
    display: flex;
    align-items: center;
    gap: 1px;
  }

  .bt__sep {
    width: 1px;
    height: 18px;
    background: rgba(255, 255, 255, 0.08);
    margin: 0 3px;
  }

  .bt__btn {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 30px;
    height: 30px;
    padding: 0 6px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: rgba(255, 255, 255, 0.6);
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition:
      background var(--duration-fast) var(--ease-out),
      color var(--duration-fast) var(--ease-out);
  }

  .bt__btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: var(--color-text-primary);
  }

  .bt__btn--active {
    background: rgba(122, 141, 255, 0.15);
    color: var(--color-accent-hover);
  }

  .bt__btn--wide {
    min-width: 36px;
  }

  .bt__btn--italic {
    font-style: italic;
    font-family: var(--font-content);
  }

  /* Dropdown */
  .bt__dropdown {
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    margin-top: 3px;
    padding-top: 3px;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .bt__dd-item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: 6px 10px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: rgba(255, 255, 255, 0.64);
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    cursor: pointer;
    text-align: left;
    transition: background var(--duration-fast) var(--ease-out);
  }

  .bt__dd-item:hover {
    background: rgba(255, 255, 255, 0.06);
    color: var(--color-text-primary);
  }

  .bt__dd-item--active {
    color: var(--color-accent-hover);
  }

  .bt__dd-icon {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 600;
    width: 22px;
    color: rgba(255, 255, 255, 0.36);
  }

  .bt__dd-item--active .bt__dd-icon {
    color: var(--color-accent);
  }

  @media (prefers-reduced-motion: reduce) {
    .bt { animation: none; }
  }
</style>
