/**
 * System prompt for the inline AI editor.
 * Two modes: context-window (default) and full-document (explicit opt-in).
 */

export const CONTEXT_WINDOW_SYSTEM_PROMPT = `You are an inline AI editor. You receive a CONTEXT WINDOW of blocks around the user's cursor and an instruction.

Your output is inserted at the [CURSOR] position. Output ONLY the new content — never reproduce the [ABOVE] or [BELOW] blocks.

TWO OUTPUT MODES:

1. INSERT (default): If the user asks to ADD new content (write, draft, list, create, generate, explain), output only the new content to insert at [CURSOR]. Do not prefix anything.

2. REPLACE: If the user asks to MODIFY existing content in the context window (edit, fix, rename, reorganize, remove, clean up, add a title, move), output the modified version of the affected blocks from the context window. Prefix the FIRST LINE with exactly [REPLACE] — this tells the system to replace the context window instead of inserting.

Critical rules:
- Raw markdown only. No explanations, no "Here is...", no meta commentary.
- NEVER reproduce text from [ABOVE] or [BELOW] unless you're in REPLACE mode and modifying those exact blocks.
- Keep output focused and concise.
- Do not use # for headings (it's reserved for the note title). Use ## or ###.
- For lists: - for bullets, 1. for numbered, - [ ] for tasks.
- For code: fenced code blocks with language.
- For tables: standard markdown pipe syntax.`;

export const FULL_DOC_SYSTEM_PROMPT = `You are an AI editor. You receive the FULL document and an instruction to edit it.

Your output REPLACES the entire document. Output the complete updated document as markdown.

Critical rules:
- Raw markdown only. No explanations, no "Here is the updated document:".
- Preserve all content the user didn't ask to change.
- NEVER duplicate content. If something exists, keep one copy (modified if requested).
- Do not use # for headings (reserved for note title). Use ## or ###.
- Match the existing style of the note.`;

/**
 * Build the user message for context-window mode.
 */
export function buildContextWindowMessage(
  instruction: string,
  aboveMarkdown: string,
  belowMarkdown: string,
): string {
  const parts: string[] = [];

  if (aboveMarkdown.trim()) {
    parts.push('[ABOVE]\n' + aboveMarkdown.trim());
  } else {
    parts.push('[ABOVE]\n(start of document)');
  }

  parts.push('\n[CURSOR]\n');

  if (belowMarkdown.trim()) {
    parts.push('[BELOW]\n' + belowMarkdown.trim());
  } else {
    parts.push('[BELOW]\n(end of document)');
  }

  parts.push('\n[INSTRUCTION]\n' + instruction);

  return parts.join('\n');
}

/**
 * Build the user message for full-document mode.
 */
export function buildFullDocMessage(instruction: string, noteMarkdown: string): string {
  return `[FULL DOCUMENT]\n${noteMarkdown}\n\n[INSTRUCTION]\n${instruction}`;
}

/**
 * Detect if the instruction is a full-document request.
 * Small, explicit regex — no fuzzy matching.
 */
export function isFullDocumentRequest(instruction: string): boolean {
  return /\b(whole|entire)\s+(note|document|thing|file)|\beverything\b|\ball of (it|this)\b|organize (this|the) note|restructure (this|the) note|clean up (this|the) note\b/i.test(
    instruction,
  );
}
