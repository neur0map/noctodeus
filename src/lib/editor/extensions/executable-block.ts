import { Node, mergeAttributes } from '@tiptap/core';
import type { NodeViewRendererProps } from '@tiptap/core';
import { mount, unmount } from 'svelte';
import ExecutableBlock from '$lib/components/codeblock/ExecutableBlock.svelte';
import type { CodeTab } from '$lib/components/codeblock/types';

/**
 * TipTap node extension for executable code blocks.
 *
 * Stores a JSON `tabs` attribute containing an array of CodeTab objects.
 * Renders via a Svelte 5 component mounted into a vanilla DOM node view.
 *
 * Markdown format:
 *   ```exec
 *   --- filename.py [python] ---
 *   code content here
 *   --- style.css [css] ---
 *   more content
 *   ```
 */
export const ExecutableBlockNode = Node.create({
  name: 'executableBlock',
  group: 'block',
  atom: true,
  draggable: false,

  addAttributes() {
    return {
      tabs: {
        default: JSON.stringify([
          { id: 'init', name: 'main.py', language: 'python', content: '' },
        ]),
        parseHTML: (element: HTMLElement) => element.getAttribute('data-tabs'),
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-tabs': attributes.tabs,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-exec-block]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-exec-block': '',
      }),
    ];
  },

  addNodeView() {
    return (props: NodeViewRendererProps) => {
      const { node, editor, getPos } = props;

      const dom = document.createElement('div');
      dom.className = 'exec-block-wrapper';
      dom.contentEditable = 'false';
      dom.style.userSelect = 'none';

      // Block ALL mouse/pointer events from reaching ProseMirror
      // This prevents text selection and bubble toolbar on clicks inside the block
      const stopPropagation = (e: Event) => {
        e.stopPropagation();
      };
      dom.addEventListener('mousedown', stopPropagation);
      dom.addEventListener('mouseup', stopPropagation);
      dom.addEventListener('click', stopPropagation);
      dom.addEventListener('pointerdown', stopPropagation);
      dom.addEventListener('pointerup', stopPropagation);

      let initialTabs: CodeTab[];
      try {
        initialTabs = JSON.parse(node.attrs.tabs as string) as CodeTab[];
      } catch {
        initialTabs = [{ id: 'init', name: 'main.py', language: 'python', content: '' }];
      }

      const instance = mount(ExecutableBlock, {
        target: dom,
        props: {
          initialTabs,
          onupdate: (tabs: CodeTab[]) => {
            const pos = typeof getPos === 'function' ? getPos() : null;
            if (pos !== null && pos !== undefined) {
              editor
                .chain()
                .command(({ tr }) => {
                  tr.setNodeMarkup(pos, undefined, {
                    ...node.attrs,
                    tabs: JSON.stringify(tabs),
                  });
                  return true;
                })
                .run();
            }
          },
        },
      });

      return {
        dom,
        destroy() {
          unmount(instance);
        },
      };
    };
  },

  addCommands() {
    return {
      insertExecutableBlock:
        (attrs?: { tabs?: CodeTab[] }) =>
        ({ commands }: { commands: any }) => {
          const tabs = attrs?.tabs ?? [
            { id: 'init', name: 'main.py', language: 'python', content: '' },
          ];
          return commands.insertContent({
            type: 'executableBlock',
            attrs: { tabs: JSON.stringify(tabs) },
          });
        },
    } as any;
  },

  addKeyboardShortcuts() {
    return {
      // Shift+Mod+E inserts an executable block
      'Shift-Mod-e': () => {
        return (this.editor.commands as any).insertExecutableBlock();
      },
    };
  },
});
