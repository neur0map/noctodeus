// src/lib/components/ai/readonly-blocknote.ts
//
// Helper to mount a read-only BlockNote editor onto a plain DOM element.
// Used by ChatMessage.svelte to render assistant messages with the same
// typography as the main editor, instead of raw markdown or HTML.

let reactPromise: Promise<typeof import('react')> | null = null;
let reactDomPromise: Promise<typeof import('react-dom/client')> | null = null;
let blockNotePromise: Promise<{
  core: typeof import('@blocknote/core');
  react: typeof import('@blocknote/react');
  mantine: typeof import('@blocknote/mantine');
}> | null = null;

async function loadDeps() {
  if (!reactPromise) reactPromise = import('react');
  if (!reactDomPromise) reactDomPromise = import('react-dom/client');
  if (!blockNotePromise) {
    blockNotePromise = Promise.all([
      import('@blocknote/core'),
      import('@blocknote/react'),
      import('@blocknote/mantine'),
    ]).then(([core, react, mantine]) => ({ core, react, mantine }));
  }
  return {
    React: await reactPromise,
    ReactDOM: await reactDomPromise,
    ...(await blockNotePromise),
  };
}

/**
 * Mount a read-only BlockNoteView onto an element and hydrate it from
 * a markdown string. Returns an unmount function the caller should call
 * on destroy.
 */
export async function mountReadonlyBlockNote(
  el: HTMLElement,
  markdown: string,
): Promise<() => void> {
  const { React, ReactDOM, react, mantine } = await loadDeps();

  const root = ReactDOM.createRoot(el);

  // Import wiki-link HTML converter for [[target]] support
  const { markdownToHTMLWithWikiLinks } = await import('$lib/editor/blocknote/markdown');

  function ReadonlyView() {
    const editor: any = react.useCreateBlockNote({});
    React.useEffect(() => {
      if (!markdown.trim()) return;
      // Use HTML path with wiki-link injection so [[target]] renders as
      // clickable wiki-link inline content, not raw text.
      const html = markdownToHTMLWithWikiLinks(markdown);
      Promise.resolve(editor.tryParseHTMLToBlocks(html)).then((blocks: any) => {
        editor.replaceBlocks(editor.document, blocks);
      });
    }, [markdown]);
    return React.createElement(mantine.BlockNoteView as any, {
      editor,
      editable: false,
      sideMenu: false,
      formattingToolbar: false,
      slashMenu: false,
      theme:
        document.documentElement.getAttribute('data-theme') === 'dark'
          ? 'dark'
          : 'light',
    });
  }

  root.render(React.createElement(ReadonlyView));

  return () => {
    try {
      root.unmount();
    } catch {
      // already unmounted
    }
  };
}
