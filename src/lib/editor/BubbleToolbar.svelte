<script lang="ts">
  import type { Editor } from '@tiptap/core';
  import ChevronDown from "@lucide/svelte/icons/chevron-down";

  let {
    editor,
    visible = false,
    position = { top: 0, left: 0 },
  }: {
    editor: Editor | null;
    visible: boolean;
    position: { top: number; left: number };
  } = $props();

  let showTypeMenu = $state(false);

  // Hide type menu when toolbar hides
  $effect(() => { if (!visible) showTypeMenu = false; });

  // Portal to body to escape overflow:hidden containers
  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return {
      destroy() { node.remove(); }
    };
  }

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

  function setBlockType(type: string) {
    if (!editor) return;
    switch (type) {
      case 'paragraph': editor.chain().focus().setParagraph().run(); break;
      case 'h1': editor.chain().focus().setHeading({ level: 1 }).run(); break;
      case 'h2': editor.chain().focus().setHeading({ level: 2 }).run(); break;
      case 'h3': editor.chain().focus().setHeading({ level: 3 }).run(); break;
      case 'bullet': editor.chain().focus().toggleBulletList().run(); break;
      case 'ordered': editor.chain().focus().toggleOrderedList().run(); break;
      case 'task': editor.chain().focus().toggleTaskList().run(); break;
      case 'code': editor.chain().focus().toggleCodeBlock().run(); break;
      case 'quote': editor.chain().focus().toggleBlockquote().run(); break;
    }
    showTypeMenu = false;
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
    if (editor.isActive('bulletList')) return '•';
    if (editor.isActive('orderedList')) return '1.';
    if (editor.isActive('taskList')) return '☐';
    if (editor.isActive('codeBlock')) return '</>';
    if (editor.isActive('blockquote')) return '❝';
    return 'T';
  }

  function isBlockActive(type: string): boolean {
    if (!editor) return false;
    switch (type) {
      case 'paragraph': return !editor.isActive('heading') && !editor.isActive('bulletList') && !editor.isActive('orderedList') && !editor.isActive('taskList') && !editor.isActive('codeBlock') && !editor.isActive('blockquote');
      case 'h1': return editor.isActive('heading', { level: 1 });
      case 'h2': return editor.isActive('heading', { level: 2 });
      case 'h3': return editor.isActive('heading', { level: 3 });
      case 'bullet': return editor.isActive('bulletList');
      case 'ordered': return editor.isActive('orderedList');
      case 'task': return editor.isActive('taskList');
      case 'code': return editor.isActive('codeBlock');
      case 'quote': return editor.isActive('blockquote');
      default: return false;
    }
  }

  const blockTypes = [
    { id: 'paragraph', icon: 'T', label: 'Text' },
    { id: 'h1', icon: 'H1', label: 'Heading 1' },
    { id: 'h2', icon: 'H2', label: 'Heading 2' },
    { id: 'h3', icon: 'H3', label: 'Heading 3' },
    { id: 'bullet', icon: '•', label: 'Bulleted list' },
    { id: 'ordered', icon: '1.', label: 'Numbered list' },
    { id: 'task', icon: '☐', label: 'To-do list' },
    { id: 'code', icon: '</>', label: 'Code block' },
    { id: 'quote', icon: '❝', label: 'Quote' },
  ];
</script>

{#if visible && editor}
  <div class="bt" style="top: {position.top}px; left: {position.left}px;" use:portal>
    <div class="bt__row">
      <button
        class="bt__btn bt__btn--type"
        class:bt__btn--active={showTypeMenu}
        onclick={() => showTypeMenu = !showTypeMenu}
        title="Block type"
      >
        {currentBlockLabel()}
        <ChevronDown size={10} class="bt__chevron" />
      </button>

      <span class="bt__sep"></span>

      <button class="bt__btn" class:bt__btn--active={isActive('bold')} onclick={() => toggle('bold')} title="Bold">
        <strong>B</strong>
      </button>
      <button class="bt__btn bt__btn--i" class:bt__btn--active={isActive('italic')} onclick={() => toggle('italic')} title="Italic">
        <em>I</em>
      </button>
      <button class="bt__btn" class:bt__btn--active={isActive('strike')} onclick={() => toggle('strike')} title="Strikethrough">
        <s>S</s>
      </button>
      <button class="bt__btn" class:bt__btn--active={isActive('code')} onclick={() => toggle('code')} title="Inline code">
        &lt;&gt;
      </button>
      <button class="bt__btn" class:bt__btn--active={isActive('link')} onclick={() => toggle('link')} title="Link">
        ⌁
      </button>
    </div>

    {#if showTypeMenu}
      <div class="bt__menu">
        {#each blockTypes as bt (bt.id)}
          <button
            class="bt__menu-item"
            class:bt__menu-item--active={isBlockActive(bt.id)}
            onclick={() => setBlockType(bt.id)}
          >
            <span class="bt__menu-icon">{bt.icon}</span>
            <span class="bt__menu-label">{bt.label}</span>
            {#if isBlockActive(bt.id)}
              <span class="bt__menu-check">✓</span>
            {/if}
          </button>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  .bt {
    position: fixed;
    z-index: 200;
    background: var(--color-popover);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    box-shadow: var(--shadow-float);
    padding: 3px;
    animation: bt-in 150ms var(--ease-expo-out) both;
    user-select: none;
  }

  @keyframes bt-in {
    from { opacity: 0; transform: translateY(8px) scale(0.95); }
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
    background: var(--color-border);
    margin: 0 2px;
  }

  .bt__btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 3px;
    min-width: 28px;
    height: 28px;
    padding: 0 5px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--color-muted-foreground);
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition:
      background 150ms var(--ease-expo-out),
      color 150ms var(--ease-expo-out);
  }

  .bt__btn:hover {
    background: var(--color-hover);
    color: var(--color-foreground);
  }

  .bt__btn--active {
    background: rgba(99, 102, 241, 0.15);
    color: var(--color-accent);
  }

  .bt__btn--type {
    min-width: 40px;
    font-size: 11px;
  }

  .bt__btn--i {
    font-style: italic;
    font-family: var(--font-content);
  }

  .bt__btn--type :global(.bt__chevron) {
    opacity: 0.4;
    margin-left: 1px;
  }

  /* Block type dropdown */
  .bt__menu {
    border-top: 1px solid var(--color-border);
    margin-top: 3px;
    padding: 3px 0 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
    max-height: 280px;
    overflow-y: auto;
  }

  .bt__menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 8px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--color-muted-foreground);
    font-family: var(--font-sans);
    font-size: 13px;
    cursor: pointer;
    text-align: left;
    transition: background 150ms var(--ease-expo-out);
  }

  .bt__menu-item:hover {
    background: var(--color-hover);
    color: var(--color-foreground);
  }

  .bt__menu-item--active {
    color: var(--color-accent-hover);
  }

  .bt__menu-icon {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 600;
    width: 22px;
    flex-shrink: 0;
    color: var(--color-placeholder);
  }

  .bt__menu-item--active .bt__menu-icon {
    color: var(--color-accent);
  }

  .bt__menu-label {
    flex: 1;
  }

  .bt__menu-check {
    font-size: 11px;
    color: var(--color-accent);
    margin-left: auto;
  }

  @media (prefers-reduced-motion: reduce) {
    .bt { animation: none; }
  }
</style>
