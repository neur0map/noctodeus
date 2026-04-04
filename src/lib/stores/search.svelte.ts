import type { SearchHit } from '../types/core';

let query = $state('');
let results = $state<SearchHit[]>([]);
let loading = $state(false);
let selectedIndex = $state(0);

export function getSearchState() {
  return {
    get query() {
      return query;
    },
    get results() {
      return results;
    },
    get loading() {
      return loading;
    },
    get selectedIndex() {
      return selectedIndex;
    },

    setQuery(q: string) {
      query = q;
      selectedIndex = 0;
    },
    setResults(r: SearchHit[]) {
      results = r;
      loading = false;
    },
    setLoading(v: boolean) {
      loading = v;
    },
    selectNext() {
      selectedIndex = Math.min(selectedIndex + 1, results.length - 1);
    },
    selectPrev() {
      selectedIndex = Math.max(selectedIndex - 1, 0);
    },
    resetSelection() {
      selectedIndex = 0;
    },
    reset() {
      query = '';
      results = [];
      loading = false;
      selectedIndex = 0;
    },
  };
}
