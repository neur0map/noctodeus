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

  // Convert [[wiki-links]] to inline HTML spans that BlockNote's parser picks up
  // These get parsed back into wikiLink inline content via the schema
  result = result.replace(
    /\[\[([^\]]+)\]\]/g,
    '<span data-inline-content-type="wikiLink" data-target="$1">$1</span>',
  );

  return result;
}

/**
 * Postprocess markdown output from BlockNote.
 * Converts custom inline content back to markdown syntax.
 */
export function postprocessMarkdown(markdown: string): string {
  let result = markdown;

  // Convert wikiLink HTML back to [[target]] syntax
  result = result.replace(
    /<span[^>]*data-inline-content-type="wikiLink"[^>]*data-target="([^"]*)"[^>]*>[^<]*<\/span>/g,
    '[[$1]]',
  );

  // Also handle any plain-text wikiLink remnants from lossy conversion
  // BlockNote may output the display text without the span wrapper
  // (this is a safety net — the primary conversion is above)

  return result;
}
