import { markdownToHTML } from '@blocknote/core';

/**
 * Splits frontmatter (YAML between --- delimiters) from markdown body.
 * Returns [frontmatter, body]. Frontmatter includes the --- delimiters.
 */
export function splitFrontmatter(markdown: string): [string, string] {
  const trimmed = markdown.trimStart();
  if (!trimmed.startsWith('---')) {
    return ['', markdown];
  }

  // Find closing --- on its own line (not inside a YAML value)
  const endIndex = trimmed.indexOf('\n---', 3);
  if (endIndex === -1) {
    return ['', markdown];
  }

  const fmEnd = endIndex + 4; // includes the \n---
  const frontmatter = trimmed.slice(0, fmEnd);
  const body = trimmed.slice(fmEnd).trimStart();
  return [frontmatter, body];
}

/**
 * Reassembles frontmatter + markdown body.
 */
export function joinFrontmatter(frontmatter: string, body: string): string {
  if (!frontmatter) return body;
  return `${frontmatter}\n\n${body}`;
}

/**
 * Preprocess markdown before feeding to BlockNote.
 * Handles syntax that BlockNote doesn't understand natively.
 *
 * Note: this function DOES strip the `=WIDTHx` syntax from images so
 * the standard markdown parser doesn't choke — the widths are recovered
 * later by `markdownToHTMLWithWikiLinks()`, which calls
 * `extractImageWidths()` on the raw markdown BEFORE the strip happens
 * and injects the width back into the HTML output.
 */
export function preprocessMarkdown(markdown: string): string {
  let result = markdown;

  // Convert TipTap/Noctodeus resizable image syntax:
  //   ![alt](url =WIDTHx) → ![alt](url)
  // The width is re-injected into the HTML stage by extractImageWidths
  // below, so this strip is safe.
  result = result.replace(
    /!\[([^\]]*)\]\(([^)]*?)\s+=\d+x\d*\)/g,
    '![$1]($2)',
  );

  // Convert ==highlight== to <mark>highlight</mark> (BlockNote supports HTML marks)
  result = result.replace(
    /==(.*?)==/g,
    '<mark>$1</mark>',
  );

  return result;
}

/**
 * Postprocess markdown output from BlockNote. Currently only reattaches
 * `=WIDTHx` resize hints for images — the caller provides a map of
 * `url → previewWidth` gathered from the editor's document before the
 * blocksToMarkdownLossy call.
 */
export function postprocessMarkdown(
  markdown: string,
  imageWidths?: Record<string, number>,
): string {
  if (!imageWidths || Object.keys(imageWidths).length === 0) {
    return markdown;
  }

  // Re-inject the =WIDTHx hint on images whose URL matches an entry in
  // the map. Match `![alt](url)` — stop at the closing paren. If the
  // url already has a width hint (shouldn't happen since lossy export
  // drops it), leave it alone.
  return markdown.replace(
    /!\[([^\]]*)\]\(([^)]+?)\)/g,
    (full, alt: string, url: string) => {
      if (/\s+=\d+x\d*$/.test(url)) return full;
      const w = imageWidths[url];
      if (!w) return full;
      return `![${alt}](${url} =${Math.round(w)}x)`;
    },
  );
}

// ── Image width round-tripping ───────────────────────────────────────
//
// Standard markdown has no syntax for image dimensions. BlockNote's
// image blocks expose `previewWidth` which the resize handles update.
// We use TipTap's `=WIDTHx` convention to round-trip the width through
// the markdown file so resizes actually persist across saves.

/**
 * Scan a markdown string for `![alt](url =WIDTHx)` patterns and return
 * a `url → width` map. Called before the markdown is stripped and
 * passed to BlockNote's markdownToHTML.
 */
export function extractImageWidths(markdown: string): Record<string, number> {
  const widths: Record<string, number> = {};
  const re = /!\[[^\]]*\]\(([^)\s]+)\s+=(\d+)x\d*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) {
    const url = m[1];
    const w = parseInt(m[2], 10);
    if (url && Number.isFinite(w)) {
      widths[url] = w;
    }
  }
  return widths;
}

// ── Wiki-link HTML injection ─────────────────────────────────────────
//
// BlockNote's markdown import pipeline is:
//   markdown → remark-parse → remark-rehype → rehype-stringify → HTML string
//   HTML string → ProseMirror DOMParser → blocks
//
// Because remark-rehype (without allowDangerousHtml) strips raw HTML,
// we cannot inject <span> tags into the markdown before the remark pipeline.
//
// Instead, we:
//   1. Let BlockNote's markdownToHTML convert markdown to HTML normally
//      ([[target]] becomes literal text "[[target]]" in the HTML)
//   2. Post-process the HTML string to replace [[target]] text with
//      <span data-wiki-target="target">target</span>
//   3. Feed the modified HTML to editor.tryParseHTMLToBlocks()
//
// The ProseMirror DOMParser then matches the <span data-wiki-target="...">
// element using the WikiLink spec's parse rule and creates wikiLink nodes.
// ──────────────────────────────────────────────────────────────────────

/**
 * Regex to match [[target]] in text, including inside HTML tags' text content.
 * Captures the target (everything between [[ and ]]).
 * Handles targets with spaces, slashes, dots, etc.
 */
const WIKI_LINK_RE = /\[\[([^\]]+)\]\]/g;

/**
 * Convert markdown to HTML with wiki-link elements injected AND image
 * widths re-attached from the `=WIDTHx` hints in the original markdown.
 *
 * Pipeline:
 *   1. Scan raw markdown for `=WIDTHx` image hints (before strip)
 *   2. Run preprocess + markdownToHTML (strip already happened above)
 *   3. Walk the HTML output: inject wiki-link spans AND add width="..."
 *      attributes to <img> tags whose src matches an extracted hint
 *
 * BlockNote's ImageBlockContent parser reads `imageElement.width` into
 * `previewWidth`, so once the HTML has `<img src="..." width="300">`
 * BlockNote will render the image at the resized width.
 */
export function markdownToHTMLWithWikiLinks(markdown: string): string {
  // Extract image widths BEFORE the preprocess step strips them
  const widths = extractImageWidths(markdown);
  const html = markdownToHTML(markdown);

  // Inject wiki-link spans
  let out = html.replace(WIKI_LINK_RE, (_match, target: string) => {
    const escaped = escapeHtml(target);
    return `<span data-wiki-target="${escaped}">${escaped}</span>`;
  });

  // Inject width attributes onto <img> tags whose src matches a hint
  if (Object.keys(widths).length > 0) {
    out = out.replace(/<img\b([^>]*?)\bsrc="([^"]+)"([^>]*)>/g, (full, pre: string, src: string, post: string) => {
      const w = widths[src];
      if (!w) return full;
      // Don't double-inject if width already present
      if (/\bwidth=/.test(pre) || /\bwidth=/.test(post)) return full;
      return `<img${pre}src="${src}"${post} width="${w}">`;
    });
  }

  return out;
}

/**
 * Minimal HTML attribute escaping for the target value.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
