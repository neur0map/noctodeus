/**
 * Curated Fabric AI patterns — a set of specialized prompt templates
 * adapted from github.com/danielmiessler/fabric (MIT license).
 *
 * Each pattern is a hand-tuned system prompt that produces consistently
 * better results than generic "summarize this" asks. Users invoke them
 * through the editor's slash menu.
 */

export type PatternMode =
  | 'insert-after'    // result is inserted as new blocks after the cursor
  | 'replace-block'   // result replaces the current block (or selection)
  | 'replace-selection'; // result replaces only the selected inline text

export type PatternContext =
  | 'full-note'       // send the entire note as input
  | 'current-block'   // send just the current block's text
  | 'selection';      // send only the selected text

export interface FabricPattern {
  id: string;
  name: string;              // Display name in slash menu
  description: string;       // One-line subtitle
  category: string;          // Grouping label (uppercase mono in UI)
  icon: PatternIconName;     // Lucide icon name
  mode: PatternMode;
  context: PatternContext;
  systemPrompt: string;
  /** Optional: a one-line confirmation shown after completion */
  successHint?: string;
}

export type PatternIconName =
  | 'FileText'
  | 'Pencil'
  | 'CheckCheck'
  | 'Lightbulb'
  | 'Tags'
  | 'ListTree'
  | 'GraduationCap'
  | 'BookA'
  | 'ListTodo'
  | 'Languages';

// ── System prompts (adapted from Fabric) ────────────────────────────

const SUMMARIZE_PROMPT = `# IDENTITY and PURPOSE
You summarize content into tight, high-signal bullet points.

# STEPS
- Read the full input
- Identify the 5-7 most important points
- Distill each into one clear, declarative sentence

# OUTPUT
- Markdown bullet list, no heading
- Each bullet max 18 words
- No introductions, no meta-commentary ("This text discusses...")
- No conclusions

# INPUT
INPUT:`;

const IMPROVE_WRITING_PROMPT = `# IDENTITY and PURPOSE
You are an expert editor. You refine prose for clarity, flow, and economy — without changing the author's voice or meaning.

# STEPS
- Fix grammar, spelling, and punctuation
- Tighten sentence structure
- Cut redundant words and phrases
- Preserve the original tone

# OUTPUT
- Return ONLY the improved text
- No explanations, no quotes, no code fences
- Keep the same general length (within 20%)
- Preserve any markdown formatting

# INPUT
INPUT:`;

const FIX_TYPOS_PROMPT = `# IDENTITY and PURPOSE
You are a proofreader. Fix typos, spelling errors, and basic grammar only.

# RULES
- Do NOT rephrase or rewrite
- Do NOT change style or tone
- Change as few words as possible
- Preserve all markdown formatting exactly

# OUTPUT
- Return ONLY the corrected text
- No explanations

# INPUT
INPUT:`;

const EXTRACT_WISDOM_PROMPT = `# IDENTITY and PURPOSE
You extract the most surprising, insightful, and useful information from content.

# OUTPUT
Use this exact format:

## Ideas
- (3-7 bullets of the most interesting ideas)

## Insights
- (3-5 bullets of the most non-obvious insights)

## Quotes
- (any notable exact quotes from the text, with speaker if known)

## Facts
- (any specific facts, statistics, or data points)

Rules:
- Each bullet max 20 words
- Skip sections with no content
- No meta-commentary

# INPUT
INPUT:`;

const CREATE_TAGS_PROMPT = `# IDENTITY and PURPOSE
You generate relevant tags for notes in a knowledge management system.

# OUTPUT
- 3-7 tags as a comma-separated list
- Lowercase, hyphenated (e.g. machine-learning, project-planning)
- Useful for categorization and search
- No explanations — just the tags

Format: tag1, tag2, tag3

# INPUT
INPUT:`;

const CREATE_OUTLINE_PROMPT = `# IDENTITY and PURPOSE
You create clear hierarchical outlines from unstructured content.

# STEPS
- Identify the main topics
- Organize into a logical hierarchy
- Use ## for main sections, ### for subsections

# OUTPUT
- Markdown headings + bullets
- Max 12 words per bullet
- No introductory text, no conclusion
- Skip the # heading (reserved for note title)

# INPUT
INPUT:`;

const CREATE_FLASHCARDS_PROMPT = `# IDENTITY and PURPOSE
You turn educational content into effective flashcards for spaced repetition.

# OUTPUT
Create 5-10 Q/A pairs in this exact format:

**Q:** (question)
**A:** (concise answer, max 2 sentences)

---

# RULES
- Focus on concepts, not trivia
- Questions should test understanding
- Each answer self-contained
- No preamble or conclusion

# INPUT
INPUT:`;

const EXPLAIN_TERMS_PROMPT = `# IDENTITY and PURPOSE
You identify technical or domain-specific terms in text and define them for a general reader.

# OUTPUT
Definition list format:

**Term**: Plain-language definition (one sentence)

# RULES
- Only include terms a general reader wouldn't know
- Order alphabetically
- Max 15 terms
- No introduction

# INPUT
INPUT:`;

const FIND_ACTIONS_PROMPT = `# IDENTITY and PURPOSE
You extract actionable items from notes, meetings, or any text.

# OUTPUT
A markdown task list of action items:

- [ ] Specific action, with who/when if mentioned
- [ ] Another action...

# RULES
- Max 12 actions
- Each action is concrete and verifiable
- Skip vague "think about X" items
- No heading, no commentary

# INPUT
INPUT:`;

const TRANSLATE_PROMPT = `# IDENTITY and PURPOSE
You translate text. If the text is in English, translate to Spanish. Otherwise, translate to English.

# RULES
- Output ONLY the translated text
- Preserve formatting and structure
- Maintain tone and register
- No notes about the translation

# INPUT
INPUT:`;

// ── Pattern registry ────────────────────────────────────────────────

export const FABRIC_PATTERNS: FabricPattern[] = [
  {
    id: 'summarize',
    name: 'Summarize',
    description: 'Distill the note into 5–7 key bullets',
    category: 'Distill',
    icon: 'FileText',
    mode: 'insert-after',
    context: 'full-note',
    systemPrompt: SUMMARIZE_PROMPT,
    successHint: 'Summary inserted',
  },
  {
    id: 'improve-writing',
    name: 'Improve Writing',
    description: 'Refine the current paragraph for clarity and flow',
    category: 'Refine',
    icon: 'Pencil',
    mode: 'replace-block',
    context: 'current-block',
    systemPrompt: IMPROVE_WRITING_PROMPT,
    successHint: 'Text refined',
  },
  {
    id: 'fix-typos',
    name: 'Fix Typos',
    description: 'Quick proofread — spelling and grammar only',
    category: 'Refine',
    icon: 'CheckCheck',
    mode: 'replace-block',
    context: 'current-block',
    systemPrompt: FIX_TYPOS_PROMPT,
    successHint: 'Typos corrected',
  },
  {
    id: 'extract-wisdom',
    name: 'Extract Wisdom',
    description: 'Pull out ideas, insights, quotes, and facts',
    category: 'Distill',
    icon: 'Lightbulb',
    mode: 'insert-after',
    context: 'full-note',
    systemPrompt: EXTRACT_WISDOM_PROMPT,
    successHint: 'Wisdom extracted',
  },
  {
    id: 'create-tags',
    name: 'Create Tags',
    description: 'Auto-generate tags for this note',
    category: 'Organize',
    icon: 'Tags',
    mode: 'insert-after',
    context: 'full-note',
    systemPrompt: CREATE_TAGS_PROMPT,
    successHint: 'Tags generated',
  },
  {
    id: 'create-outline',
    name: 'Create Outline',
    description: 'Structure the note as a hierarchical outline',
    category: 'Organize',
    icon: 'ListTree',
    mode: 'insert-after',
    context: 'full-note',
    systemPrompt: CREATE_OUTLINE_PROMPT,
    successHint: 'Outline created',
  },
  {
    id: 'create-flashcards',
    name: 'Create Flashcards',
    description: 'Turn this note into Q&A study cards',
    category: 'Learn',
    icon: 'GraduationCap',
    mode: 'insert-after',
    context: 'full-note',
    systemPrompt: CREATE_FLASHCARDS_PROMPT,
    successHint: 'Flashcards generated',
  },
  {
    id: 'explain-terms',
    name: 'Explain Terms',
    description: 'Glossary of technical terms in the note',
    category: 'Learn',
    icon: 'BookA',
    mode: 'insert-after',
    context: 'full-note',
    systemPrompt: EXPLAIN_TERMS_PROMPT,
    successHint: 'Glossary added',
  },
  {
    id: 'find-actions',
    name: 'Find Action Items',
    description: 'Extract tasks and todos as a check list',
    category: 'Organize',
    icon: 'ListTodo',
    mode: 'insert-after',
    context: 'full-note',
    systemPrompt: FIND_ACTIONS_PROMPT,
    successHint: 'Actions extracted',
  },
  {
    id: 'translate',
    name: 'Translate',
    description: 'Translate the current paragraph (EN ↔ ES)',
    category: 'Refine',
    icon: 'Languages',
    mode: 'replace-block',
    context: 'current-block',
    systemPrompt: TRANSLATE_PROMPT,
    successHint: 'Translated',
  },
];

export function getPattern(id: string): FabricPattern | undefined {
  return FABRIC_PATTERNS.find((p) => p.id === id);
}
