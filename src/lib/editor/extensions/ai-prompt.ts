import { Node } from '@tiptap/core';
import type { AiProvider } from '$lib/ai/types';
import type { NodeViewRendererProps } from '@tiptap/core';
import type { ViewMutationRecord } from '@tiptap/pm/view';
import { mount, unmount } from 'svelte';
import AiPromptView from '../AiPromptView.svelte';

export interface AiPromptRequestContext {
  provider: AiProvider | null;
  corePath?: string;
  activeFilePath?: string;
}

export interface AiPromptOptions {
  isConfigured: () => boolean;
  getRequestContext: () => AiPromptRequestContext;
}

type AiPromptState = 'input' | 'loading' | 'preview';

type AiPromptComponent = {
  sync?: (node: NodeViewRendererProps['node']) => void;
};

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    aiPrompt: {
      insertAiPrompt: () => ReturnType;
    };
  }
}

export const AiPrompt = Node.create<AiPromptOptions>({
  name: 'aiPrompt',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,
  isolating: true,

  addOptions() {
    return {
      isConfigured: () => false,
      getRequestContext: () => ({ provider: null }),
    };
  },

  addAttributes() {
    return {
      prompt: { default: '' },
      state: { default: 'input' as AiPromptState },
      generatedHtml: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-ai-prompt]' }];
  },

  renderHTML({ node }) {
    return [
      'div',
      {
        'data-ai-prompt': '',
        'data-state': node.attrs.state ?? 'input',
      },
    ];
  },

  addCommands() {
    return {
      insertAiPrompt:
        () =>
        ({ editor, tr, dispatch }) => {
          const { $from } = editor.state.selection;
          const node = $from.parent;

          if (node.type.name !== 'paragraph' || node.content.size > 0) {
            return false;
          }

          const from = $from.before();
          const to = $from.after();

          if (dispatch) {
            tr.replaceWith(from, to, this.type.create({ state: 'input' }));
          }

          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      Space: ({ editor }) => {
        const { empty, $from } = editor.state.selection;

        if (!empty) {
          return false;
        }

        const node = $from.parent;

        if (node.type.name !== 'paragraph' || node.content.size > 0) {
          return false;
        }

        if (!this.options.isConfigured()) {
          return false;
        }

        let hasExisting = false;
        editor.state.doc.descendants((descendant) => {
          if (descendant.type.name === this.name) {
            hasExisting = true;
            return false;
          }
          return true;
        });

        if (hasExisting) {
          return false;
        }

        return editor.commands.insertAiPrompt();
      },
    };
  },

  addNodeView() {
    return (props: NodeViewRendererProps) => {
      const dom = document.createElement('div');
      dom.className = 'ai-prompt-node';
      dom.contentEditable = 'false';
      let currentNode = props.node;

      const getPos = typeof props.getPos === 'function'
        ? props.getPos
        : () => undefined;

      const updateAttributes = (attributes: Record<string, unknown>) => {
        const pos = getPos();

        if (typeof pos !== 'number') {
          return;
        }

        const tr = props.editor.state.tr
          .setNodeMarkup(pos, undefined, {
            ...currentNode.attrs,
            ...attributes,
          })
          .setMeta('addToHistory', false);

        props.editor.view.dispatch(tr);
      };

      const component = mount(AiPromptView, {
        target: dom,
        props: {
          node: props.node,
          editor: props.editor,
          getPos,
          updateAttributes,
          getRequestContext: this.options.getRequestContext,
        },
      }) as AiPromptComponent;

      return {
        dom,
        update(updatedNode) {
          if (updatedNode.type.name !== currentNode.type.name) {
            return false;
          }

          currentNode = updatedNode;
          component.sync?.(updatedNode);
          return true;
        },
        stopEvent(event: Event) {
          return dom.contains(event.target as globalThis.Node | null);
        },
        ignoreMutation(_mutation: ViewMutationRecord) {
          return true;
        },
        destroy() {
          void unmount(component);
        },
      };
    };
  },
});
