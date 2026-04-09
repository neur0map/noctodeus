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
 */
export function preprocessMarkdown(markdown: string): string {
  let result = markdown;

  // Convert TipTap resizable image syntax: ![alt](url =WIDTHx) → ![alt](url)
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
 * Postprocess markdown output from BlockNote.
 * No-op for now — wiki links are serialized by the WikiLink toExternalHTML spec.
 */
export function postprocessMarkdown(markdown: string): string {
  return markdown;
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
 * Convert markdown to HTML with wiki-link elements injected.
 *
 * Uses BlockNote's markdownToHTML to get standard HTML, then replaces
 * [[target]] text occurrences with <span data-wiki-target="target">
 * elements that the WikiLink ProseMirror parse rule can recognize.
 */
export function markdownToHTMLWithWikiLinks(markdown: string): string {
  const html = markdownToHTML(markdown);

  // Replace [[target]] in the HTML text with wiki-link spans.
  // We need to be careful not to replace inside HTML attribute values.
  // Since [[...]] only appears as text content (not in attributes),
  // a simple global replace is safe here.
  return html.replace(WIKI_LINK_RE, (_match, target: string) => {
    const escaped = escapeHtml(target);
    return `<span data-wiki-target="${escaped}">${escaped}</span>`;
  });
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
