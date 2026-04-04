import MarkdownIt from 'markdown-it';

function wikiLinkPlugin(md: MarkdownIt) {
  md.inline.ruler.after('link', 'wiki_link', (state, silent) => {
    const start = state.pos;
    const max = state.posMax;
    if (start + 2 >= max) return false;
    if (state.src.charCodeAt(start) !== 0x5b || state.src.charCodeAt(start + 1) !== 0x5b)
      return false;
    let end = start + 2;
    while (end + 1 < max) {
      if (state.src.charCodeAt(end) === 0x5d && state.src.charCodeAt(end + 1) === 0x5d) break;
      end++;
    }
    if (end + 1 >= max) return false;
    const target = state.src.slice(start + 2, end).trim();
    if (!target) return false;
    if (!silent) {
      const token = state.push('wiki_link', 'wiki-link', 0);
      token.attrSet('target', target);
      token.content = target;
    }
    state.pos = end + 2;
    return true;
  });
  md.renderer.rules['wiki_link'] = (tokens, idx) => {
    const target = tokens[idx].attrGet('target') ?? '';
    const escaped = target.replace(/"/g, '&quot;');
    return `<wiki-link target="${escaped}">${target}</wiki-link>`;
  };
}

function taskListPlugin(md: MarkdownIt) {
  md.core.ruler.after('inline', 'task_list', (state) => {
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type !== 'inline') continue;
      // Find the list_item_open: sequence is list_item_open -> paragraph_open -> inline
      const isInList =
        i >= 2 &&
        tokens[i - 1].type === 'paragraph_open' &&
        tokens[i - 2].type === 'list_item_open';
      if (!isInList) continue;
      const content = tokens[i].content;
      const checked = content.startsWith('[x] ') || content.startsWith('[X] ');
      const unchecked = content.startsWith('[ ] ');
      if (!checked && !unchecked) continue;
      const listItemOpen = tokens[i - 2];
      listItemOpen.attrSet('class', 'task-list-item');
      // Strip the checkbox prefix from inline content and children
      tokens[i].content = content.slice(4);
      if (tokens[i].children && tokens[i].children!.length > 0) {
        const firstChild = tokens[i].children![0];
        if (firstChild.type === 'text') {
          firstChild.content = firstChild.content.slice(4);
        }
      }
      // Insert a checkbox token at the start of inline children
      const checkbox = new state.Token('html_inline', '', 0);
      checkbox.content = checked
        ? '<input type="checkbox" checked disabled> '
        : '<input type="checkbox" disabled> ';
      if (tokens[i].children) {
        tokens[i].children!.unshift(checkbox);
      }
    }
  });
}

const md = new MarkdownIt('default', { html: false, linkify: true, typographer: false });
md.use(wikiLinkPlugin);
md.use(taskListPlugin);

export function parseMarkdown(markdown: string): string {
  return md.render(markdown);
}
