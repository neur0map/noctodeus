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
        default: JSON.stringify([]),
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

      let initialTabs: CodeTab[];
      try {
        initialTabs = JSON.parse(node.attrs.tabs as string) as CodeTab[];
      } catch {
        initialTabs = [];
      }

      // Debounce syncing tabs back to ProseMirror — prevents the auto-save
      // from triggering on every keystroke and destroying/recreating the node view
      let syncTimer: ReturnType<typeof setTimeout> | undefined;
      let latestTabs: CodeTab[] = initialTabs;

      function syncToProseMirror() {
        try {
          const pos = typeof getPos === 'function' ? getPos() : null;
          if (pos === null || pos === undefined) return;
          // Validate the node at this position is still our node
          const nodeAtPos = editor.state.doc.nodeAt(pos);
          if (!nodeAtPos || nodeAtPos.type.name !== 'executableBlock') return;

          editor
            .chain()
            .command(({ tr }) => {
              tr.setNodeMarkup(pos, undefined, {
                ...nodeAtPos.attrs,
                tabs: JSON.stringify(latestTabs),
              });
              return true;
            })
            .run();
        } catch {
          // Position is stale — skip this sync, next one will retry
        }
      }

      const instance = mount(ExecutableBlock, {
        target: dom,
        props: {
          initialTabs,
          onupdate: (tabs: CodeTab[]) => {
            latestTabs = tabs;
            // Debounce: only sync to ProseMirror after 1.5s of inactivity
            if (syncTimer) clearTimeout(syncTimer);
            syncTimer = setTimeout(syncToProseMirror, 1500);
          },
          ondelete: () => {
            try {
              const pos = typeof getPos === 'function' ? getPos() : null;
              if (pos === null || pos === undefined) return;
              const nodeAtPos = editor.state.doc.nodeAt(pos);
              if (!nodeAtPos || nodeAtPos.type.name !== 'executableBlock') return;
              editor.chain().deleteRange({ from: pos, to: pos + nodeAtPos.nodeSize }).run();
            } catch {
              // Position stale — ignore
            }
          },
        },
      });

      return {
        dom,
        // When ProseMirror sees the node changed (e.g., our debounced sync updated
        // the tabs attribute), it calls update() instead of destroy+recreate.
        // Returning true tells ProseMirror to KEEP the existing DOM and Svelte
        // component alive — no remount, no cursor loss.
        update: (updatedNode) => {
          return updatedNode.type.name === 'executableBlock';
        },
        stopEvent: () => true,
        ignoreMutation: () => true,
        destroy() {
          // Flush any pending sync before destroying
          if (syncTimer) {
            clearTimeout(syncTimer);
            syncToProseMirror();
          }
          unmount(instance);
        },
      };
    };
  },

  addCommands() {
    return {
      insertExecutableBlock:
        (attrs?: { tabs?: CodeTab[] }) =>
        ({ commands, editor: cmdEditor }: { commands: any; editor: any }) => {
          const tabs = attrs?.tabs ?? [];
          const result = commands.insertContent({
            type: 'executableBlock',
            attrs: { tabs: JSON.stringify(tabs) },
          });
          // Deselect after insert to prevent bubble toolbar from appearing
          requestAnimationFrame(() => {
            cmdEditor.commands.blur();
          });
          return result;
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
