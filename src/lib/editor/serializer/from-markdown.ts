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
  // Transform markdown task lists into TipTap-compatible HTML:
  //   <ul data-type="taskList">
  //     <li data-type="taskItem" data-checked="false">text</li>
  //   </ul>
  md.core.ruler.after('inline', 'task_list', (state) => {
    const tokens = state.tokens;
    const taskListIndices = new Set<number>();

    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type !== 'inline') continue;
      const isInList =
        i >= 2 &&
        tokens[i - 1].type === 'paragraph_open' &&
        tokens[i - 2].type === 'list_item_open';
      if (!isInList) continue;

      const content = tokens[i].content;
      const checked = content.startsWith('[x] ') || content.startsWith('[X] ');
      const unchecked = content.startsWith('[ ] ');
      if (!checked && !unchecked) continue;

      // Mark the list_item_open with TipTap attributes
      const listItemOpen = tokens[i - 2];
      listItemOpen.attrSet('data-type', 'taskItem');
      listItemOpen.attrSet('data-checked', checked ? 'true' : 'false');

      // Strip the [x]/[ ] prefix from content
      tokens[i].content = content.slice(4);
      if (tokens[i].children && tokens[i].children!.length > 0) {
        const firstChild = tokens[i].children![0];
        if (firstChild.type === 'text') {
          firstChild.content = firstChild.content.slice(4);
        }
      }

      // Find the parent bullet_list_open and mark it for data-type="taskList"
      for (let j = i - 2; j >= 0; j--) {
        if (tokens[j].type === 'bullet_list_open') {
          taskListIndices.add(j);
          break;
        }
      }
    }

    // Set data-type="taskList" on identified bullet lists
    for (const idx of taskListIndices) {
      tokens[idx].attrSet('data-type', 'taskList');
    }
  });
}

function mediaBlockPlugin(md: MarkdownIt) {
  // Transform ![video](src) and ![audio](src) into <video>/<audio> tags
  // Transform [embed](url) into <div data-embed-url>
  const defaultImageRenderer = md.renderer.rules.image;
  md.renderer.rules.image = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const alt = token.children?.map((t) => t.content).join('') ?? '';
    const src = token.attrGet('src') ?? '';

    if (alt === 'video') {
      return `<video src="${src}" controls preload="metadata" class="media-video"></video>`;
    }
    if (alt === 'audio') {
      return `<audio src="${src}" controls class="media-audio"></audio>`;
    }

    // Check for width suffix: ![alt](src =WIDTHx)
    let imgSrc = src;
    let widthAttr = '';
    const widthMatch = src.match(/^(.+?)\s+=(\d+)x\)?$/);
    if (widthMatch) {
      imgSrc = widthMatch[1];
      widthAttr = ` width="${widthMatch[2]}" style="width:${widthMatch[2]}px"`;
    }

    const escapedAlt = alt.replace(/"/g, '&quot;');
    return `<img src="${imgSrc}" alt="${escapedAlt}"${widthAttr} />`;
  };

  // Transform [embed](url) links into embed divs
  const defaultLinkOpenRenderer = md.renderer.rules.link_open;
  const defaultLinkCloseRenderer = md.renderer.rules.link_close;

  md.core.ruler.after('inline', 'embed_links', (state) => {
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type !== 'inline' || !tokens[i].children) continue;
      const children = tokens[i].children!;
      for (let j = 0; j < children.length; j++) {
        if (
          children[j].type === 'link_open' &&
          j + 2 < children.length &&
          children[j + 1].type === 'text' &&
          children[j + 1].content === 'embed' &&
          children[j + 2].type === 'link_close'
        ) {
          const href = children[j].attrGet('href') ?? '';
          // Replace the three tokens with a single html_inline
          const embedToken = new state.Token('html_inline', '', 0);
          embedToken.content = `<div data-embed-url="${href.replace(/"/g, '&quot;')}"></div>`;
          children.splice(j, 3, embedToken);
        }
      }
    }
  });
}

const md = new MarkdownIt('default', { html: false, linkify: true, typographer: false });
md.use(wikiLinkPlugin);
md.use(taskListPlugin);
md.use(mediaBlockPlugin);

export function parseMarkdown(markdown: string): string {
  return md.render(markdown);
}
