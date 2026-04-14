import React from 'react';
import type { BlockNoteEditor } from '@blocknote/core';
import { AIExtension, type AIMenuSuggestionItem } from '@blocknote/xl-ai';
import {
  RiLightbulbLine,
  RiHashtag,
  RiListIndefinite,
  RiGraduationCapLine,
  RiBookOpenLine,
  RiStethoscopeLine,
} from 'react-icons/ri';
import { splitFrontmatter } from './markdown';

// ── System prompts (5 unique Nodeus Fabric patterns) ─────────────
//
// xl-ai's default menu already covers the overlapping patterns
// (summarize, action_items, improve_writing, fix_spelling, translate,
// simplify, continue_writing, write_anything). These five are the ones
// xl-ai doesn't ship — they became AIMenuSuggestionItems merged alongside
// the defaults.

const EXTRACT_WISDOM_SYSTEM = `You are an expert at extracting surprising, insightful, and useful information from content, and at identifying key concepts and entities worth their own knowledge-base entries.

Analyze the document and return ONLY a valid JSON object (no markdown fences, no commentary) with this structure:

{
  "ideas": ["idea 1", "idea 2"],
  "insights": ["insight 1"],
  "quotes": ["\\"exact quote\\" — Speaker"],
  "facts": ["fact 1"],
  "concepts": [
    {
      "slug": "concept-name",
      "title": "Concept Name",
      "definition": "One-sentence definition.",
      "details": "2-3 sentences: how it works, when to use, pitfalls."
    }
  ],
  "entities": [
    {
      "slug": "entity-name",
      "title": "Entity Name",
      "type": "person|tool|organization|framework|product",
      "description": "2-3 sentences about this entity and its relevance."
    }
  ]
}

Rules:
- ideas: 3-7 bullets, max 20 words each. Most interesting or surprising.
- insights: 3-5 non-obvious insights or connections.
- quotes: exact quotes with speaker if known. Empty array if none.
- facts: specific facts, statistics, data points. Empty array if none.
- concepts: 2-5 key concepts substantial enough for their own note. Lowercase-hyphen slugs.
- entities: 0-5 people, tools, orgs, or products mentioned substantively (not in passing). Lowercase-hyphen slugs.
- Return ONLY the JSON object. No markdown fences, no prose, no prefix.`;

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

const LINT_NOTE_PROMPT = `Analyze this note for quality issues and suggest specific improvements.
Check for:

1. **Structure** — Heading hierarchy problems, wall-of-text paragraphs, sections that
   should be split or merged, overly deep nesting.
2. **Clarity** — Vague claims without evidence, filler phrases ("it should be noted
   that…"), redundant content, unclear references.
3. **Connections** — Key terms, concepts, or people that should be [[wiki-links]] but
   aren't. Suggest the link target as [[lowercase-hyphen-name]].
4. **Confidence** — Claims that need a source or caveat. Flag as low-confidence.
5. **Completeness** — Unfinished sections, TODO markers, missing context that a reader
   would need.

Output a Heading 2 "Note Review" section. Each finding is a bullet starting with a
bold category label: **Structure**, **Clarity**, **Connections**, **Confidence**, or
**Completeness**. Be actionable — say what to fix, not just what's wrong. Max 10
findings. If the note is solid, say so in one line.`;

// ── Command factory ──────────────────────────────────────────────────

/**
 * Build the 6 Nodeus-unique AI commands that supplement xl-ai's
 * default menu. Most append their output to the document without modifying
 * existing content. Extract Wisdom and Create Tags bypass invokeAI to do
 * multi-file operations (creating concept/entity notes, writing frontmatter).
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
      aliases: ['insights', 'wisdom', 'key points', 'ideas', 'ingest'],
      icon: <RiLightbulbLine size={18} />,
      onItemClick: async () => {
        ai.closeAIMenu();
        await runExtractWisdom(editor).catch(async (err) => {
          const { toast } = await import('$lib/stores/toast.svelte');
          toast.error(
            `Extract Wisdom failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        });
      },
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
    {
      key: 'lint_note',
      title: 'Lint Note',
      aliases: ['review', 'audit', 'check', 'quality', 'lint', 'health'],
      icon: <RiStethoscopeLine size={18} />,
      onItemClick: makeClickHandler(LINT_NOTE_PROMPT),
      size: 'small',
    },
  ];
}

// ── Extract Wisdom custom runner ─────────────────────────────────────
//
// Reads the active note, asks the LLM for structured wisdom (ideas,
// insights, quotes, facts) PLUS key concepts and entities, then:
//   1. Appends a "## Extracted Wisdom" section (with wiki-links) to
//      the current note
//   2. Creates concept notes in concepts/<slug>.md (or appends a
//      source reference if the note already exists)
//   3. Creates entity notes in entities/<slug>.md (same logic)
//
// This merges the "LLM wiki ingest" pattern — a single command that
// grows the knowledge graph by extracting structured knowledge and
// cross-linking it automatically.

interface ExtractedWisdom {
  ideas: string[];
  insights: string[];
  quotes: string[];
  facts: string[];
  concepts: { slug: string; title: string; definition: string; details: string }[];
  entities: { slug: string; title: string; type: string; description: string }[];
}

async function runExtractWisdom(editor: BlockNoteEditor<any, any, any>): Promise<void> {
  const [{ getFilesState }, { readFile, writeFile, createFile }, { generateText }, { getAIModel, getMaxTokens }, { toast }] =
    await Promise.all([
      import('$lib/stores/files.svelte'),
      import('$lib/bridge/commands'),
      import('ai'),
      import('$lib/ai/client'),
      import('$lib/stores/toast.svelte'),
    ]);

  const files = getFilesState();
  const path = files.activeFilePath;
  if (!path) throw new Error('No active file');

  const model = getAIModel();
  if (!model) throw new Error('AI provider not configured — open Settings → AI');

  const fileContent = await readFile(path);
  const raw = fileContent.content;
  const [existingFm, body] = splitFrontmatter(raw);

  if (!body.trim()) throw new Error('Note body is empty — nothing to extract');

  toast.info('Extracting wisdom…');

  const bodyForAI = body.length > 12000 ? body.slice(0, 12000) + '\n\n...(truncated)' : body;

  // Fetch wiki context if enabled
  let wikiContext = '';
  try {
    const { getSettings } = await import('$lib/stores/settings.svelte');
    const settings = getSettings();
    if (settings.wikiEnabled) {
      const { getCoreState } = await import('$lib/stores/core.svelte');
      const core = getCoreState();
      if (core.activeCore?.path) {
        const { wikiSearch } = await import('$lib/bridge/wiki');
        const results = await wikiSearch(bodyForAI, core.activeCore.path, 3);
        if (results.length > 0) {
          wikiContext = '\n\nRelevant wiki context:\n' +
            results.map(r => `${r.title || r.path}: ${r.chunk}`).join('\n');
        }
      }
    }
  } catch { /* continue without wiki */ }

  const { text } = await generateText({
    model,
    system: EXTRACT_WISDOM_SYSTEM + wikiContext,
    prompt: bodyForAI,
    maxOutputTokens: Math.min(getMaxTokens() ?? 4096, 4096),
  });

  // Parse the structured JSON response
  let wisdom: ExtractedWisdom;
  try {
    const cleaned = text
      .replace(/^```(?:json)?\s*\n?/, '')
      .replace(/\n?```\s*$/, '')
      .trim();
    wisdom = JSON.parse(cleaned);
  } catch {
    throw new Error(`AI returned invalid JSON — try again. Preview: "${text.slice(0, 150)}…"`);
  }

  // Normalize: ensure all arrays exist
  wisdom.ideas ??= [];
  wisdom.insights ??= [];
  wisdom.quotes ??= [];
  wisdom.facts ??= [];
  wisdom.concepts ??= [];
  wisdom.entities ??= [];

  if (!wisdom.ideas.length && !wisdom.insights.length) {
    throw new Error('AI found no ideas or insights in this note');
  }

  // Build the wisdom markdown section with wiki-links
  const wisdomMd = buildWisdomMarkdown(wisdom);

  // Append to the current document
  const separator = raw.endsWith('\n') ? '\n' : '\n\n';
  const newContent = raw + separator + wisdomMd;
  await writeFile(path, newContent);

  // Create concept and entity notes in parallel
  const sourceTitle = extractNoteTitle(existingFm, path);
  const sourceSlug = path.replace(/\.md$/, '');
  const today = new Date().toISOString().split('T')[0];

  let conceptsCreated = 0;
  let entitiesCreated = 0;

  const noteOps = [
    ...wisdom.concepts.map(async (c) => {
      const result = await upsertKnowledgeNote(
        `concepts/${c.slug}.md`,
        c.title,
        'concept',
        `${c.definition}\n\n${c.details}`,
        sourceTitle,
        sourceSlug,
        today,
        readFile, writeFile, createFile,
      );
      if (result === 'created') conceptsCreated++;
    }),
    ...wisdom.entities.map(async (e) => {
      const result = await upsertKnowledgeNote(
        `entities/${e.slug}.md`,
        e.title,
        e.type || 'entity',
        e.description,
        sourceTitle,
        sourceSlug,
        today,
        readFile, writeFile, createFile,
      );
      if (result === 'created') entitiesCreated++;
    }),
  ];

  // Don't let a single note failure abort everything
  await Promise.allSettled(noteOps);

  // Reload the editor
  window.dispatchEvent(
    new CustomEvent('nodeus-content-reloaded', {
      detail: { path, content: newContent },
    }),
  );

  // Summary toast
  const parts: string[] = [];
  if (wisdom.ideas.length) parts.push(`${wisdom.ideas.length} ideas`);
  if (wisdom.insights.length) parts.push(`${wisdom.insights.length} insights`);
  if (conceptsCreated) parts.push(`${conceptsCreated} concept note${conceptsCreated > 1 ? 's' : ''}`);
  if (entitiesCreated) parts.push(`${entitiesCreated} entity note${entitiesCreated > 1 ? 's' : ''}`);
  toast.success(`Extracted: ${parts.join(', ')}`);
}

/**
 * Build the markdown section appended to the source note.
 * Includes wiki-links to concept and entity notes.
 */
function buildWisdomMarkdown(w: ExtractedWisdom): string {
  const sections: string[] = ['## Extracted Wisdom\n'];

  if (w.ideas.length) {
    sections.push('### Ideas');
    sections.push(w.ideas.map((i) => `- ${i}`).join('\n'));
    sections.push('');
  }
  if (w.insights.length) {
    sections.push('### Insights');
    sections.push(w.insights.map((i) => `- ${i}`).join('\n'));
    sections.push('');
  }
  if (w.quotes.length) {
    sections.push('### Quotes');
    sections.push(w.quotes.map((q) => `- ${q}`).join('\n'));
    sections.push('');
  }
  if (w.facts.length) {
    sections.push('### Facts');
    sections.push(w.facts.map((f) => `- ${f}`).join('\n'));
    sections.push('');
  }
  if (w.concepts.length) {
    sections.push('### Concepts');
    sections.push(
      w.concepts
        .map((c) => `- [[concepts/${c.slug}|${c.title}]] — ${c.definition}`)
        .join('\n'),
    );
    sections.push('');
  }
  if (w.entities.length) {
    sections.push('### Entities');
    sections.push(
      w.entities
        .map((e) => `- [[entities/${e.slug}|${e.title}]] — ${truncateSentence(e.description)}`)
        .join('\n'),
    );
    sections.push('');
  }

  return sections.join('\n');
}

/** First sentence only, for inline summaries. */
function truncateSentence(text: string): string {
  const dot = text.indexOf('. ');
  return dot > 0 ? text.slice(0, dot + 1) : text;
}

/** Extract the note title from frontmatter, falling back to filename. */
function extractNoteTitle(frontmatter: string, filePath: string): string {
  const match = frontmatter.match(/^\s*title\s*:\s*["']?(.+?)["']?\s*$/m);
  if (match) return match[1].trim();
  const name = filePath.replace(/\.md$/, '').split('/').pop() || 'Untitled';
  return name.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Create a concept/entity note at `notePath`, or append a source
 * reference if it already exists. Returns 'created' or 'updated'.
 */
async function upsertKnowledgeNote(
  notePath: string,
  title: string,
  type: string,
  body: string,
  sourceTitle: string,
  sourceSlug: string,
  date: string,
  readFile: (p: string) => Promise<{ content: string }>,
  writeFile: (p: string, c: string) => Promise<unknown>,
  createFile: (p: string, c: string) => Promise<unknown>,
): Promise<'created' | 'updated'> {
  const sourceRef = `- [[${sourceSlug}|${sourceTitle}]] — ${date}`;

  try {
    // Check if the note already exists
    const existing = await readFile(notePath);
    // Exists — append source reference if not already listed
    if (!existing.content.includes(`[[${sourceSlug}`)) {
      const trimmed = existing.content.trimEnd();
      // Append under the Sources heading if it exists, otherwise add it
      if (/^## Sources/m.test(trimmed)) {
        await writeFile(notePath, trimmed + '\n' + sourceRef + '\n');
      } else {
        await writeFile(notePath, trimmed + '\n\n## Sources\n' + sourceRef + '\n');
      }
    }
    return 'updated';
  } catch {
    // Doesn't exist — create it
    const content = `---
title: "${title}"
tags: [${type}]
created: ${date}
---

# ${title}

${body}

## Sources
${sourceRef}
`;
    await createFile(notePath, content);
    return 'created';
  }
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

  // Fetch wiki context if enabled
  let wikiContext = '';
  try {
    const { getSettings } = await import('$lib/stores/settings.svelte');
    const settings = getSettings();
    if (settings.wikiEnabled) {
      const { getCoreState } = await import('$lib/stores/core.svelte');
      const core = getCoreState();
      if (core.activeCore?.path) {
        const { wikiSearch } = await import('$lib/bridge/wiki');
        const results = await wikiSearch(bodyForAI, core.activeCore.path, 3);
        if (results.length > 0) {
          wikiContext = '\n\nRelevant wiki context:\n' +
            results.map(r => `${r.title || r.path}: ${r.chunk}`).join('\n');
        }
      }
    }
  } catch { /* continue without wiki */ }

  const { text } = await generateText({
    model,
    prompt: `${CREATE_TAGS_PROMPT}${bodyForAI}${wikiContext}`,
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
    new CustomEvent('nodeus-content-reloaded', {
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
