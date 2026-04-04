<script lang="ts">
  let {
    editor,
  }: {
    editor: any;
  } = $props();

  let linkPopover = $state(false);
  let linkUrl = $state('');
  let imagePopover = $state(false);
  let imageSrc = $state('');

  function run(
    e: MouseEvent,
    action: () => void,
  ) {
    e.preventDefault();
    action();
  }

  function applyLink(e: KeyboardEvent) {
    if (e.key === 'Enter' && linkUrl) {
      editor.chain().focus().setLink({ href: linkUrl }).run();
      linkUrl = '';
      linkPopover = false;
    } else if (e.key === 'Escape') {
      linkUrl = '';
      linkPopover = false;
      editor.chain().focus().run();
    }
  }

  function applyImage(e: KeyboardEvent) {
    if (e.key === 'Enter' && imageSrc) {
      editor.chain().focus().setImage({ src: imageSrc }).run();
      imageSrc = '';
      imagePopover = false;
    } else if (e.key === 'Escape') {
      imageSrc = '';
      imagePopover = false;
      editor.chain().focus().run();
    }
  }

  function isActive(name: string, attrs?: Record<string, unknown>): boolean {
    if (!editor) return false;
    return editor.isActive(name, attrs);
  }
</script>

<div class="editor-toolbar" role="toolbar" aria-label="Formatting">
  <!-- Inline formatting -->
  <button
    class="toolbar-btn"
    class:active={isActive('bold')}
    title="Bold"
    onmousedown={(e) => run(e, () => editor.chain().focus().toggleBold().run())}
  >B</button>
  <button
    class="toolbar-btn toolbar-btn--italic"
    class:active={isActive('italic')}
    title="Italic"
    onmousedown={(e) => run(e, () => editor.chain().focus().toggleItalic().run())}
  >I</button>
  <button
    class="toolbar-btn"
    class:active={isActive('code')}
    title="Inline code"
    onmousedown={(e) => run(e, () => editor.chain().focus().toggleCode().run())}
  >&lt;&gt;</button>

  <span class="toolbar-sep"></span>

  <!-- Headings -->
  <button
    class="toolbar-btn"
    class:active={isActive('heading', { level: 1 })}
    title="Heading 1"
    onmousedown={(e) => run(e, () => editor.chain().focus().toggleHeading({ level: 1 }).run())}
  >H1</button>
  <button
    class="toolbar-btn"
    class:active={isActive('heading', { level: 2 })}
    title="Heading 2"
    onmousedown={(e) => run(e, () => editor.chain().focus().toggleHeading({ level: 2 }).run())}
  >H2</button>
  <button
    class="toolbar-btn"
    class:active={isActive('heading', { level: 3 })}
    title="Heading 3"
    onmousedown={(e) => run(e, () => editor.chain().focus().toggleHeading({ level: 3 }).run())}
  >H3</button>

  <span class="toolbar-sep"></span>

  <!-- Lists -->
  <button
    class="toolbar-btn"
    class:active={isActive('bulletList')}
    title="Bullet list"
    onmousedown={(e) => run(e, () => editor.chain().focus().toggleBulletList().run())}
  >&#8226;</button>
  <button
    class="toolbar-btn"
    class:active={isActive('orderedList')}
    title="Ordered list"
    onmousedown={(e) => run(e, () => editor.chain().focus().toggleOrderedList().run())}
  >1.</button>
  <button
    class="toolbar-btn"
    class:active={isActive('taskList')}
    title="Task list"
    onmousedown={(e) => run(e, () => editor.chain().focus().toggleTaskList().run())}
  >&#9744;</button>

  <span class="toolbar-sep"></span>

  <!-- Block elements -->
  <button
    class="toolbar-btn"
    class:active={isActive('blockquote')}
    title="Blockquote"
    onmousedown={(e) => run(e, () => editor.chain().focus().toggleBlockquote().run())}
  >&#10077;</button>
  <button
    class="toolbar-btn"
    class:active={isActive('codeBlock')}
    title="Code block"
    onmousedown={(e) => run(e, () => editor.chain().focus().toggleCodeBlock().run())}
  >{'{}'}</button>

  <span class="toolbar-sep"></span>

  <!-- Link with popover -->
  <div class="toolbar-popover-anchor">
    <button
      class="toolbar-btn"
      class:active={isActive('link')}
      title="Link"
      onmousedown={(e) => {
        e.preventDefault();
        linkPopover = !linkPopover;
        imagePopover = false;
      }}
    >&#128279;</button>
    {#if linkPopover}
      <div class="toolbar-popover">
        <input
          class="toolbar-popover__input"
          type="url"
          placeholder="https://..."
          bind:value={linkUrl}
          onkeydown={applyLink}
        />
      </div>
    {/if}
  </div>

  <!-- Image with popover -->
  <div class="toolbar-popover-anchor">
    <button
      class="toolbar-btn"
      title="Image"
      onmousedown={(e) => {
        e.preventDefault();
        imagePopover = !imagePopover;
        linkPopover = false;
      }}
    >&#128247;</button>
    {#if imagePopover}
      <div class="toolbar-popover">
        <input
          class="toolbar-popover__input"
          type="text"
          placeholder="Image path..."
          bind:value={imageSrc}
          onkeydown={applyImage}
        />
      </div>
    {/if}
  </div>

  <span class="toolbar-sep"></span>

  <!-- Horizontal rule -->
  <button
    class="toolbar-btn"
    title="Horizontal rule"
    onmousedown={(e) => run(e, () => editor.chain().focus().setHorizontalRule().run())}
  >&#8213;</button>
</div>

<style>
  .editor-toolbar {
    display: flex;
    align-items: center;
    height: 36px;
    padding: 0 var(--space-2);
    background: var(--color-bg-surface);
    border-bottom: 1px solid var(--color-border-subtle);
    gap: 2px;
    flex-shrink: 0;
    overflow-x: auto;
  }

  .toolbar-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 28px;
    height: 26px;
    padding: 0 var(--space-1);
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--color-text-secondary);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    line-height: 1;
    cursor: pointer;
    user-select: none;
    transition: background var(--duration-fast) var(--ease-out),
                color var(--duration-fast) var(--ease-out);
  }

  .toolbar-btn:hover {
    background: var(--color-bg-hover);
    color: var(--color-text-primary);
  }

  .toolbar-btn.active {
    color: var(--color-accent);
    background: var(--color-bg-active);
  }

  .toolbar-btn--italic {
    font-style: italic;
  }

  .toolbar-sep {
    width: 1px;
    height: 16px;
    background: var(--color-border-subtle);
    margin: 0 var(--space-1);
    flex-shrink: 0;
  }

  .toolbar-popover-anchor {
    position: relative;
  }

  .toolbar-popover {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    z-index: 10;
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border-subtle);
    border-radius: 6px;
    padding: var(--space-1);
    box-shadow: var(--shadow-elevated);
    animation: fade-in var(--duration-fast) var(--ease-out) both;
  }

  .toolbar-popover__input {
    width: 220px;
    padding: var(--space-1) var(--space-2);
    background: var(--color-bg-surface);
    border: 1px solid var(--color-border-subtle);
    border-radius: 4px;
    color: var(--color-text-primary);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    outline: none;
  }

  .toolbar-popover__input:focus {
    border-color: var(--color-accent);
  }

  @keyframes fade-in {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @media (prefers-reduced-motion: reduce) {
    .toolbar-popover {
      animation: none;
    }
  }
</style>
