import React from 'react';
import type { BlockNoteEditor } from '@blocknote/core';
import { AIExtension, type AIMenuSuggestionItem } from '@blocknote/xl-ai';
import {
  RiLightbulbLine,
  RiHashtag,
  RiListIndefinite,
  RiGraduationCapLine,
  RiBookOpenLine,
} from 'react-icons/ri';
import { splitFrontmatter } from './markdown';

// ── System prompts (5 unique Noctodeus Fabric patterns) ─────────────
//
// xl-ai's default menu already covers the overlapping patterns
// (summarize, action_items, improve_writing, fix_spelling, translate,
// simplify, continue_writing, write_anything). These five are the ones
// xl-ai doesn't ship — they became AIMenuSuggestionItems merged alongside
// the defaults.

const EXTRACT_WISDOM_PROMPT = `You are an expert at extracting the most surprising,
insightful, and useful information from content.

Extract Ideas (3-7 bullets of the most interesting ideas), Insights (3-5 bullets
of the most non-obvious insights), Quotes (any notable exact quotes from the text
with speaker if known), and Facts (any specific facts, statistics, or data points)
from the document. Organize each category as a Heading 2 section with bullets
underneath. Each bullet max 20 words. Skip sections with no content.`;

const CREATE_TAGS_PROMPT = `Generate 3-7 relevant tags for the following document,
suitable for a knowledge management system. Tags must be lowercase and hyphenated
(e.g. machine-learning, project-planning, note-taking).

Output ONLY the tags as a comma-separated list on a single line. No prose, no
prefix, no markdown, no quotes. Example of a valid response:

machine-learning, neural-networks, deep-learning, research

Document:
`;

const CREATE_OUTLINE_PROMPT = `Create a clear hierarchical outline from this
document. Identify main topics and organize them into a logical hierarchy. Use
Heading 2 for main sections, Heading 3 for subsections, and bullets for details.
Max 12 words per bullet. No introductory text.`;

const CREATE_FLASHCARDS_PROMPT = `Create 5-10 flashcards from this educational
content for spaced repetition study. Each flashcard is a paragraph formatted as:
**Q:** (question)
**A:** (concise answer, max 2 sentences)

Questions should test understanding, not trivia. Each answer is self-contained.
Focus on key concepts.`;

const EXPLAIN_TERMS_PROMPT = `Identify technical or domain-specific terms in this
document and define them for a general reader. Output a definition list where each
term is a paragraph formatted as:
**Term**: Plain-language definition (one sentence)

Only include terms a general reader would not know. Order alphabetically. Max 15
terms.`;

// ── Command factory ──────────────────────────────────────────────────

/**
 * Build the 5 Noctodeus-unique AI commands that supplement xl-ai's
 * default menu. All 5 are insert-only (add:true, update/delete:false) so
 * they append their output to the document without modifying existing
 * content.
 *
 * Intended to be merged with getDefaultAIMenuItems(editor, status) inside
 * AIMenuController's `items` prop.
 */
export function getFabricAICommands(
  editor: BlockNoteEditor<any, any, any>,
): AIMenuSuggestionItem[] {
  const ai = editor.getExtension(AIExtension);
  if (!ai) return [];

  // These patterns all append analysis/summary output to the document.
  // xl-ai's default streamToolsProvider (add + update + delete) is fine
  // because the prompts themselves instruct the model to insert new
  // content rather than modify existing blocks. If a pattern ever
  // misbehaves and starts rewriting, narrow this to add-only via the
  // internal aiDocumentFormats API.
  const makeClickHandler = (userPrompt: string) => async () => {
    await ai.invokeAI({ userPrompt });
  };

  return [
    {
      key: 'extract_wisdom',
      title: 'Extract Wisdom',
      aliases: ['insights', 'wisdom', 'key points', 'ideas'],
      icon: <RiLightbulbLine size={18} />,
      onItemClick: makeClickHandler(EXTRACT_WISDOM_PROMPT),
      size: 'small',
    },
    {
      key: 'create_tags',
      title: 'Create Tags',
      aliases: ['tags', 'keywords', 'categorize'],
      icon: <RiHashtag size={18} />,
      // Create Tags is SPECIAL — it writes directly to the note's YAML
      // frontmatter `tags:` field instead of inserting a paragraph block.
      // That's why it bypasses xl-ai's invokeAI pipeline entirely.
      onItemClick: async () => {
        ai.closeAIMenu();
        await runCreateTags(editor).catch(async (err) => {
          const { toast } = await import('$lib/stores/toast.svelte');
          toast.error(
            `Create Tags failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        });
      },
      size: 'small',
    },
    {
      key: 'create_outline',
      title: 'Create Outline',
      aliases: ['outline', 'structure', 'toc'],
      icon: <RiListIndefinite size={18} />,
      onItemClick: makeClickHandler(CREATE_OUTLINE_PROMPT),
      size: 'small',
    },
    {
      key: 'create_flashcards',
      title: 'Create Flashcards',
      aliases: ['flashcards', 'study', 'cards', 'quiz'],
      icon: <RiGraduationCapLine size={18} />,
      onItemClick: makeClickHandler(CREATE_FLASHCARDS_PROMPT),
      size: 'small',
    },
    {
      key: 'explain_terms',
      title: 'Explain Terms',
      aliases: ['glossary', 'definitions', 'terms'],
      icon: <RiBookOpenLine size={18} />,
      onItemClick: makeClickHandler(EXPLAIN_TERMS_PROMPT),
      size: 'small',
    },
  ];
}

// ── Create Tags custom runner ────────────────────────────────────────
//
// Reads the active file's raw content, asks the LLM for tags, parses
// them, splices them into the YAML frontmatter's `tags:` field, and
// writes back. Reloads the editor so the PropertiesPanel picks up the
// change. Does NOT go through xl-ai's invokeAI / tool-call pipeline
// because we want metadata, not document content.

async function runCreateTags(editor: BlockNoteEditor<any, any, any>): Promise<void> {
  const [{ getFilesState }, { readFile, writeFile }, { generateText }, { getAIModel, getMaxTokens }, { toast }] =
    await Promise.all([
      import('$lib/stores/files.svelte'),
      import('$lib/bridge/commands'),
      import('ai'),
      import('$lib/ai/client'),
      import('$lib/stores/toast.svelte'),
    ]);

  const files = getFilesState();
  const path = files.activeFilePath;
  if (!path) {
    throw new Error('No active file');
  }

  const model = getAIModel();
  if (!model) {
    throw new Error('AI provider not configured — open Settings → AI');
  }

  // 1. Read the raw file content (not the editor document — we need the
  //    original frontmatter which may have other keys we must preserve)
  const fileContent = await readFile(path);
  const raw = fileContent.content;
  const [existingFm, body] = splitFrontmatter(raw);

  if (!body.trim()) {
    throw new Error('Note body is empty — nothing to tag');
  }

  // 2. Ask the LLM for tags (plain comma-separated, no frontmatter)
  const bodyForAI = body.length > 6000 ? body.slice(0, 6000) + '\n\n...(truncated)' : body;
  const { text } = await generateText({
    model,
    prompt: `${CREATE_TAGS_PROMPT}${bodyForAI}`,
    maxOutputTokens: Math.min(getMaxTokens() ?? 200, 200),
  });

  // 3. Parse the response into a clean list of hyphen-lowercase tags
  const tags = parseTagList(text);
  if (tags.length === 0) {
    throw new Error(`AI returned no usable tags: "${text.slice(0, 100)}"`);
  }

  // 4. Splice into frontmatter
  const newFm = upsertTagsInFrontmatter(existingFm, tags);
  const newContent = newFm + '\n\n' + body.trimStart();

  // 5. Write the file back to disk
  await writeFile(path, newContent);

  // 6. Tell the host Svelte page to reload its `currentContent` state
  //    from the new file. `+page.svelte` holds the reactive content that
  //    feeds PropertiesPanel — we can't update its $state from React
  //    directly, so we dispatch a CustomEvent that the page listens for.
  //    The page is responsible for updating currentContent AND reloading
  //    the editor blocks without triggering a save loop.
  window.dispatchEvent(
    new CustomEvent('noctodeus-content-reloaded', {
      detail: { path, content: newContent },
    }),
  );

  toast.success(`Added ${tags.length} tag${tags.length === 1 ? '' : 's'}: ${tags.join(', ')}`);
}

/**
 * Parse a raw LLM tag response into a clean list of lowercase-hyphen tags.
 * Tolerates responses prefixed with "Tags:", wrapped in markdown, split
 * by commas or spaces, or quoted.
 */
function parseTagList(raw: string): string[] {
  // Strip common prefixes and markdown wrappers
  const cleaned = raw
    .replace(/^\s*\*?\*?tags\*?\*?\s*:\s*/i, '')
    .replace(/`/g, '')
    .replace(/^\*+|\*+$/g, '')
    .trim();

  // Split on commas first, then whitespace if the model ignored commas
  const parts = cleaned.includes(',') ? cleaned.split(',') : cleaned.split(/\s+/);

  const tags: string[] = [];
  for (const part of parts) {
    const tag = part
      .trim()
      .toLowerCase()
      .replace(/^["'#]+|["'#]+$/g, '') // strip wrapping punctuation
      .replace(/\s+/g, '-'); // "machine learning" → "machine-learning"

    if (!tag) continue;
    if (!/^[a-z0-9][a-z0-9-]*$/.test(tag)) continue; // drop non-conforming
    if (tags.includes(tag)) continue; // dedupe
    tags.push(tag);
    if (tags.length >= 10) break;
  }
  return tags;
}

/**
 * Take existing YAML frontmatter (including --- delimiters) and return
 * a new frontmatter block with the `tags:` field set to the provided
 * tags, preserving all other keys. If there's no frontmatter at all,
 * creates a minimal one with only `tags`.
 */
function upsertTagsInFrontmatter(existingFm: string, tags: string[]): string {
  const tagsLine = `tags: [${tags.join(', ')}]`;

  if (!existingFm) {
    return `---\n${tagsLine}\n---`;
  }

  // Strip the delimiters so we can work on the YAML body
  const inner = existingFm
    .replace(/^---\r?\n/, '')
    .replace(/\r?\n---\r?\n?$/, '');

  const lines = inner.split(/\r?\n/);
  const tagsIdx = lines.findIndex((l) => /^\s*tags\s*:/.test(l));

  if (tagsIdx >= 0) {
    // Replace single-line tags entry
    lines[tagsIdx] = tagsLine;
    // If the original was a multi-line (YAML list) tags block, also drop
    // the following indented continuation lines
    let i = tagsIdx + 1;
    while (i < lines.length && /^\s{2,}-\s/.test(lines[i])) {
      lines.splice(i, 1);
    }
  } else {
    lines.push(tagsLine);
  }

  return `---\n${lines.join('\n')}\n---`;
}
