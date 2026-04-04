import { Node, mergeAttributes } from '@tiptap/core';

export interface WikiLinkOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    wikiLink: {
      insertWikiLink: (target: string) => ReturnType;
    };
  }
}

export const WikiLink = Node.create<WikiLinkOptions>({
  name: 'wikiLink',
  group: 'inline',
  inline: true,
  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      target: {
        default: null,
        parseHTML: (element) => element.getAttribute('target'),
        renderHTML: (attributes) => ({ target: attributes.target }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'wiki-link' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'wiki-link',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      node.attrs.target,
    ];
  },

  addCommands() {
    return {
      insertWikiLink:
        (target: string) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { target },
          });
        },
    };
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('span');
      dom.classList.add('wiki-link');
      dom.textContent = node.attrs.target;
      dom.addEventListener('click', () => {
        dom.dispatchEvent(
          new CustomEvent('wiki-link-click', {
            detail: { target: node.attrs.target },
            bubbles: true,
          }),
        );
      });
      return { dom };
    };
  },
});
