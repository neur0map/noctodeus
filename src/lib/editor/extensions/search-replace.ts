import { Extension } from '@tiptap/core';
import type { Editor as TiptapEditor } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { Transaction } from '@tiptap/pm/state';
import type { Node as PMNode } from '@tiptap/pm/model';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface SearchReplaceStorage {
  searchTerm: string;
  replaceTerm: string;
  caseSensitive: boolean;
  matchCount: number;
  currentIndex: number;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    searchReplace: {
      setSearchTerm: (term: string) => ReturnType;
      setReplaceTerm: (term: string) => ReturnType;
      toggleCaseSensitive: () => ReturnType;
      nextMatch: () => ReturnType;
      prevMatch: () => ReturnType;
      replaceCurrent: () => ReturnType;
      replaceAll: () => ReturnType;
      clearSearch: () => ReturnType;
    };
  }
}

const pluginKey = new PluginKey('searchReplace');

function gatherTextRanges(doc: PMNode) {
  const ranges: { text: string; from: number }[] = [];
  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      ranges.push({ text: node.text, from: pos });
    }
  });
  return ranges;
}

function findMatches(doc: PMNode, term: string, caseSensitive: boolean): { from: number; to: number }[] {
  if (!term) return [];
  const results: { from: number; to: number }[] = [];
  const ranges = gatherTextRanges(doc);
  const search = caseSensitive ? term : term.toLowerCase();

  for (const range of ranges) {
    const text = caseSensitive ? range.text : range.text.toLowerCase();
    let idx = 0;
    while (idx <= text.length - search.length) {
      const found = text.indexOf(search, idx);
      if (found === -1) break;
      results.push({ from: range.from + found, to: range.from + found + search.length });
      idx = found + 1;
    }
  }
  return results;
}

function buildDecorations(doc: PMNode, term: string, caseSensitive: boolean, currentIndex: number) {
  const matches = findMatches(doc, term, caseSensitive);
  if (matches.length === 0) return { decorations: DecorationSet.empty, matches };

  const decos = matches.map((m, i) =>
    Decoration.inline(m.from, m.to, {
      class: i === currentIndex ? 'search-match search-match--current' : 'search-match',
    }),
  );
  return { decorations: DecorationSet.create(doc, decos), matches };
}

function dispatchUpdate(editor: TiptapEditor) {
  const { tr } = editor.state;
  tr.setMeta(pluginKey, 'update');
  editor.view.dispatch(tr);
}

function scrollToCurrentMatch(editor: TiptapEditor) {
  const s = (editor.storage as any).searchReplace as SearchReplaceStorage;
  const matches = findMatches(editor.state.doc, s.searchTerm, s.caseSensitive);
  const match = matches[s.currentIndex];
  if (match) editor.commands.setTextSelection({ from: match.from, to: match.to });
}

export const SearchReplace = Extension.create<Record<string, never>, SearchReplaceStorage>({
  name: 'searchReplace',

  addStorage() {
    return { searchTerm: '', replaceTerm: '', caseSensitive: false, matchCount: 0, currentIndex: 0 };
  },

  addCommands() {
    return {
      setSearchTerm:
        (term: string) =>
        ({ editor }: { editor: TiptapEditor }) => {
          ((editor.storage as any).searchReplace as SearchReplaceStorage).searchTerm = term;
          ((editor.storage as any).searchReplace as SearchReplaceStorage).currentIndex = 0;
          dispatchUpdate(editor);
          return true;
        },

      setReplaceTerm:
        (term: string) =>
        ({ editor }: { editor: TiptapEditor }) => {
          ((editor.storage as any).searchReplace as SearchReplaceStorage).replaceTerm = term;
          return true;
        },

      toggleCaseSensitive:
        () =>
        ({ editor }: { editor: TiptapEditor }) => {
          const s = (editor.storage as any).searchReplace as SearchReplaceStorage;
          s.caseSensitive = !s.caseSensitive;
          s.currentIndex = 0;
          dispatchUpdate(editor);
          return true;
        },

      nextMatch:
        () =>
        ({ editor }: { editor: TiptapEditor }) => {
          const s = (editor.storage as any).searchReplace as SearchReplaceStorage;
          if (s.matchCount === 0) return false;
          s.currentIndex = (s.currentIndex + 1) % s.matchCount;
          dispatchUpdate(editor);
          scrollToCurrentMatch(editor);
          return true;
        },

      prevMatch:
        () =>
        ({ editor }: { editor: TiptapEditor }) => {
          const s = (editor.storage as any).searchReplace as SearchReplaceStorage;
          if (s.matchCount === 0) return false;
          s.currentIndex = (s.currentIndex - 1 + s.matchCount) % s.matchCount;
          dispatchUpdate(editor);
          scrollToCurrentMatch(editor);
          return true;
        },

      replaceCurrent:
        () =>
        ({ editor, tr }: { editor: TiptapEditor; tr: Transaction }) => {
          const s = (editor.storage as any).searchReplace as SearchReplaceStorage;
          if (s.matchCount === 0) return false;
          const matches = findMatches(editor.state.doc, s.searchTerm, s.caseSensitive);
          const match = matches[s.currentIndex];
          if (!match) return false;
          tr.insertText(s.replaceTerm, match.from, match.to);
          editor.view.dispatch(tr);
          dispatchUpdate(editor);
          return true;
        },

      replaceAll:
        () =>
        ({ editor }: { editor: TiptapEditor }) => {
          const s = (editor.storage as any).searchReplace as SearchReplaceStorage;
          if (s.matchCount === 0) return false;
          const matches = findMatches(editor.state.doc, s.searchTerm, s.caseSensitive);
          let { tr } = editor.state;
          for (let i = matches.length - 1; i >= 0; i--) {
            tr = tr.insertText(s.replaceTerm, matches[i].from, matches[i].to);
          }
          editor.view.dispatch(tr);
          s.currentIndex = 0;
          dispatchUpdate(editor);
          return true;
        },

      clearSearch:
        () =>
        ({ editor }: { editor: TiptapEditor }) => {
          const s = (editor.storage as any).searchReplace as SearchReplaceStorage;
          s.searchTerm = '';
          s.replaceTerm = '';
          s.currentIndex = 0;
          s.matchCount = 0;
          dispatchUpdate(editor);
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const ext = this;
    return [
      new Plugin({
        key: pluginKey,
        state: {
          init() { return DecorationSet.empty; },
          apply(_tr, _old, _oldState, newState) {
            const s = ext.storage;
            const { decorations, matches } = buildDecorations(newState.doc, s.searchTerm, s.caseSensitive, s.currentIndex);
            s.matchCount = matches.length;
            if (s.currentIndex >= matches.length) s.currentIndex = 0;
            return decorations;
          },
        },
        props: {
          decorations(state) { return this.getState(state); },
        },
      }),
    ];
  },
});
