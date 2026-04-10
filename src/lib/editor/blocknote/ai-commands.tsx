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

const CREATE_TAGS_PROMPT = `Generate 3-7 relevant tags for this document suitable
for a knowledge management system. Tags must be lowercase and hyphenated (e.g.
machine-learning, project-planning). Output a single paragraph containing the tags
as a comma-separated list.`;

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
      onItemClick: makeClickHandler(CREATE_TAGS_PROMPT),
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
