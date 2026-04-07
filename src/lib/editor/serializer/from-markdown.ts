import MarkdownIt from 'markdown-it';
// @ts-ignore — no type declarations available
import markdownItMark from 'markdown-it-mark';
// @ts-ignore — no type declarations available
import markdownItSub from 'markdown-it-sub';
// @ts-ignore — no type declarations available
import markdownItSup from 'markdown-it-sup';
// @ts-ignore — no type declarations available
import markdownItKatex from '@vscode/markdown-it-katex';

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

    let widthAttr = '';
    const storedWidth = imageWidths.get(src);
    if (storedWidth) {
      widthAttr = ` width="${storedWidth}" style="width:${storedWidth}px"`;
    }

    const escapedAlt = alt.replace(/"/g, '&quot;');
    return `<img src="${src}" alt="${escapedAlt}"${widthAttr} />`;
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

const md = new MarkdownIt('default', { html: true, linkify: true, typographer: false });
md.use(wikiLinkPlugin);
md.use(taskListPlugin);
md.use(mediaBlockPlugin);
md.use(markdownItMark);
md.use(markdownItSub);
md.use(markdownItSup);
md.use(markdownItKatex);

const FRONTMATTER_RE = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;

// Store width data extracted during pre-processing
const imageWidths = new Map<string, string>();

/** Pre-process markdown to extract width suffixes from images.
 *  Converts `![alt](url =WIDTHx)` to `![alt](url)` and stores width. */
function preprocessImageWidths(text: string): string {
  return text.replace(/!\[([^\]]*)\]\((.+?)\s+=(\d+)x\)/g, (_match, alt, url, width) => {
    imageWidths.set(url, width);
    return `![${alt}](${url})`;
  });
}

/**
 * Pre-process ```exec blocks into HTML divs that TipTap's executableBlock
 * node can parse.
 *
 * Format:
 *   ```exec
 *   --- filename.py [python] ---
 *   code
 *   --- style.css [css] ---
 *   code
 *   ```
 */
function preprocessExecBlocks(text: string): string {
  const EXEC_BLOCK_RE = /```exec\n([\s\S]*?)```/g;
  const TAB_HEADER_RE = /^---\s+(.+?)\s+\[(\w+)\]\s+---$/;

  return text.replace(EXEC_BLOCK_RE, (_match, body: string) => {
    const lines = body.split('\n');
    const tabs: { id: string; name: string; language: string; content: string }[] = [];
    let current: { id: string; name: string; language: string; content: string[] } | null = null;

    for (const line of lines) {
      const headerMatch = line.match(TAB_HEADER_RE);
      if (headerMatch) {
        // Flush previous tab
        if (current) {
          tabs.push({ ...current, content: current.content.join('\n') });
        }
        current = {
          id: Math.random().toString(36).slice(2, 10),
          name: headerMatch[1],
          language: headerMatch[2],
          content: [],
        };
      } else if (current) {
        current.content.push(line);
      } else {
        // Content before any tab header — treat as Python tab
        if (line.trim()) {
          current = {
            id: Math.random().toString(36).slice(2, 10),
            name: 'main.py',
            language: 'python',
            content: [line],
          };
        }
      }
    }

    // Flush last tab
    if (current) {
      tabs.push({ ...current, content: current.content.join('\n').replace(/\n+$/, '') });
    }

    if (tabs.length === 0) {
      tabs.push({ id: 'init', name: 'main.py', language: 'python', content: '' });
    }

    const escaped = JSON.stringify(tabs).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    return `<div data-exec-block data-tabs="${escaped}"></div>`;
  });
}

/** Strip YAML frontmatter before rendering. */
export function parseMarkdown(markdown: string): string {
  imageWidths.clear();
  const body = markdown.replace(FRONTMATTER_RE, '');
  const withExec = preprocessExecBlocks(body);
  const preprocessed = preprocessImageWidths(withExec);
  return md.render(preprocessed);
}

/** Extract raw frontmatter string (including delimiters) from markdown. */
export function extractFrontmatter(markdown: string): string | null {
  const match = markdown.match(FRONTMATTER_RE);
  return match ? match[0] : null;
}
