import { Extension } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';
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
          char: '[',
          // Only trigger when preceded by another [, making it [[
          allow: ({ state, range }: any) => {
            const $from = state.doc.resolve(range.from);
            const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);
            // Check that the character before our [ is also [
            return textBefore.endsWith('[');
          },
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
            const target = props.name.replace(/\.(md|markdown)$/i, '');
            // Delete the [[ trigger + query, then insert wiki-link
            // range.from points to the [ trigger, but we need to also delete the [ before it
            const from = range.from - 1; // include the first [
            editor.chain().focus()
              .deleteRange({ from, to: range.to })
              .insertContent({ type: 'wikiLink', attrs: { target } })
              .run();
          },
        },
      };
    },

    addProseMirrorPlugins() {
      return [
        Suggestion({
          editor: this.editor,
          pluginKey: new PluginKey('wikiLinkSuggestion'),
          ...this.options.suggestion,
        }),
      ];
    },
  });
}
