import { Extension } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import type { Editor, Range } from '@tiptap/core';

export interface WikiSuggestItem {
  path: string;
  name: string;
  title: string | null;
}

export type CreateWikiPopup = () => any;

export function createWikiLinkSuggest(createPopup: CreateWikiPopup, getItems: () => WikiSuggestItem[]) {
  return Extension.create({
    name: 'wikiLinkSuggest',

    addOptions() {
      return {
        suggestion: {
          char: '[[',
          items: ({ query }: { query: string }) => {
            const all = getItems();
            if (!query) return all.slice(0, 12);
            const q = query.toLowerCase();
            return all.filter(item => {
              const name = item.name.toLowerCase();
              const title = (item.title ?? '').toLowerCase();
              return name.includes(q) || title.includes(q);
            }).slice(0, 12);
          },
          render: createPopup,
          command: ({ editor, range, props }: { editor: Editor; range: Range; props: WikiSuggestItem }) => {
            // Delete the [[ trigger + query text, insert the wiki-link node
            const target = props.name.replace(/\.(md|markdown)$/i, '');
            editor.chain().focus().deleteRange(range).insertContent({
              type: 'wikiLink',
              attrs: { target },
            }).run();
          },
        },
      };
    },

    addProseMirrorPlugins() {
      return [
        Suggestion({
          editor: this.editor,
          ...this.options.suggestion,
        }),
      ];
    },
  });
}
