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

  // Convert [[wiki-links]] to markdown links with a wikilink: protocol
  // that BlockNote's parser understands as standard links.
  // e.g. [[feature-showcase]] → [feature-showcase](wikilink://feature-showcase)
  result = result.replace(
    /\[\[([^\]]+)\]\]/g,
    (_match, target: string) => {
      const display = target.replace(/\.(md|markdown)$/i, '').split('/').pop() ?? target;
      return `[${display}](wikilink://${encodeURIComponent(target)})`;
    },
  );

  return result;
}

/**
 * Postprocess markdown output from BlockNote.
 * Converts wikilink:// protocol links back to [[target]] syntax.
 */
export function postprocessMarkdown(markdown: string): string {
  let result = markdown;

  // Convert [display](wikilink://target) back to [[target]]
  result = result.replace(
    /\[([^\]]*)\]\(wikilink:\/\/([^)]+)\)/g,
    (_match, _display: string, target: string) => `[[${decodeURIComponent(target)}]]`,
  );

  return result;
}
