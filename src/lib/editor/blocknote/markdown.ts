/**
 * Splits frontmatter (YAML between --- delimiters) from markdown body.
 * Returns [frontmatter, body]. Frontmatter includes the --- delimiters.
 */
export function splitFrontmatter(markdown: string): [string, string] {
  const trimmed = markdown.trimStart();
  if (!trimmed.startsWith('---')) {
    return ['', markdown];
  }

  const endIndex = trimmed.indexOf('---', 3);
  if (endIndex === -1) {
    return ['', markdown];
  }

  const fmEnd = endIndex + 3;
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
