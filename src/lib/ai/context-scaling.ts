import type { AiMessage } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const CHARS_PER_TOKEN = 4;
export const DEFAULT_CONTEXT = 32_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContextBudget {
  sourceBudgetChars: number;
  historyBudgetChars: number;
}

export interface ResearchSourceInput {
  path: string;
  title: string;
  content: string;
}

export interface RankedSource extends ResearchSourceInput {
  score: number;
  originalIndex: number;
}

export interface IncludedSourceMeta {
  index: number;
  level: 'top' | 'middle' | 'bottom';
}

export interface BuiltContext {
  block: string;
  includedSources: IncludedSourceMeta[];
}

// ---------------------------------------------------------------------------
// Model context window lookup
// ---------------------------------------------------------------------------

interface ModelPattern {
  pattern: RegExp;
  tokens: number;
}

const MODEL_PATTERNS: ModelPattern[] = [
  // Claude — all variants map to 200 k
  { pattern: /claude.*(opus|sonnet|haiku)/i, tokens: 200_000 },
  // GPT-4o and GPT-4-turbo (must come before plain gpt-4)
  { pattern: /gpt-4o/i, tokens: 128_000 },
  { pattern: /gpt-4-turbo/i, tokens: 128_000 },
  // Plain GPT-4
  { pattern: /^gpt-4$/i, tokens: 8_000 },
  // GPT-3.5
  { pattern: /gpt-3\.5/i, tokens: 16_000 },
  // o1 / o3
  { pattern: /^o[13](-|$)/i, tokens: 200_000 },
  // Llama 3.1+
  { pattern: /llama.?3\.[1-9]/i, tokens: 128_000 },
  // Llama 3 (plain, must come after 3.1+)
  { pattern: /llama.?3/i, tokens: 8_000 },
  // Mistral large
  { pattern: /mistral.*large/i, tokens: 128_000 },
  // Mixtral
  { pattern: /mixtral/i, tokens: 32_000 },
  // Gemini pro / flash
  { pattern: /gemini.*(pro|flash)/i, tokens: 1_000_000 },
];

/**
 * Returns the context window size in tokens for a given model name.
 * Falls back to DEFAULT_CONTEXT when no pattern matches.
 */
export function getContextWindowTokens(modelName: string): number {
  for (const { pattern, tokens } of MODEL_PATTERNS) {
    if (pattern.test(modelName)) {
      return tokens;
    }
  }
  return DEFAULT_CONTEXT;
}

// ---------------------------------------------------------------------------
// Budget calculation
// ---------------------------------------------------------------------------

/**
 * Calculates character budgets for sources and history given a model name.
 * Sources: 60 % of context window, history: 25 %.
 */
export function calculateBudget(modelName: string): ContextBudget {
  const contextTokens = getContextWindowTokens(modelName);
  const contextChars = contextTokens * CHARS_PER_TOKEN;

  return {
    sourceBudgetChars: Math.floor(contextChars * 0.6),
    historyBudgetChars: Math.floor(contextChars * 0.25),
  };
}

// ---------------------------------------------------------------------------
// Source ranking
// ---------------------------------------------------------------------------

/**
 * Ranks sources by relevance to the question:
 *   +100 for each source whose name/title is mentioned in the question
 *   +index * 0.5 for recency (lower index = earlier = less recent)
 *   +2 per keyword overlap between question words and source title/path
 */
export function rankSources(
  question: string,
  sources: ResearchSourceInput[],
): RankedSource[] {
  const questionLower = question.toLowerCase();
  const questionWords = questionLower
    .split(/\W+/)
    .filter((w) => w.length > 2);

  const ranked: RankedSource[] = sources.map((src, index) => {
    let score = 0;

    // Name / title mention
    const titleLower = src.title.toLowerCase();
    const pathLower = src.path.toLowerCase();
    if (questionLower.includes(titleLower) || questionLower.includes(pathLower)) {
      score += 100;
    }

    // Recency (higher index treated as more recent → higher score)
    score += index * 0.5;

    // Keyword overlap
    const titleWords = titleLower.split(/\W+/);
    const pathWords = pathLower.split(/\W+/);
    const sourceWords = new Set([...titleWords, ...pathWords]);
    for (const word of questionWords) {
      if (sourceWords.has(word)) {
        score += 2;
      }
    }

    return { ...src, score, originalIndex: index };
  });

  return ranked.sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------------------
// Context block builder
// ---------------------------------------------------------------------------

const TOP_TIER_MAX = 12_000;
const MIDDLE_TIER_MAX = 3_000;

/**
 * Fits ranked sources into the character budget using three tiers:
 *   top    — full content (up to TOP_TIER_MAX chars)
 *   middle — truncated to MIDDLE_TIER_MAX chars
 *   bottom — one-line identifier only
 */
export function buildSourceContext(
  sources: ResearchSourceInput[],
  question: string,
  budgetChars: number,
): BuiltContext {
  const ranked = rankSources(question, sources);
  const includedSources: IncludedSourceMeta[] = [];
  const parts: string[] = [];
  let remaining = budgetChars;

  for (const src of ranked) {
    const headerLine = `--- Note "${src.title}" (${src.path}) ---`;

    if (remaining <= 0) {
      // No budget left — skip entirely
      break;
    }

    // Try top tier: full content capped at TOP_TIER_MAX
    const fullContent = src.content.slice(0, TOP_TIER_MAX);
    const topEntry = `${headerLine}\n${fullContent}`;

    if (topEntry.length <= remaining) {
      parts.push(topEntry);
      remaining -= topEntry.length;
      includedSources.push({ index: src.originalIndex, level: 'top' });
      continue;
    }

    // Try middle tier: truncated to MIDDLE_TIER_MAX
    const truncated = src.content.slice(0, MIDDLE_TIER_MAX) + '\n... (truncated)';
    const middleEntry = `${headerLine}\n${truncated}`;

    if (middleEntry.length <= remaining) {
      parts.push(middleEntry);
      remaining -= middleEntry.length;
      includedSources.push({ index: src.originalIndex, level: 'middle' });
      continue;
    }

    // Bottom tier: one-line identifier only
    if (headerLine.length <= remaining) {
      parts.push(headerLine);
      remaining -= headerLine.length;
      includedSources.push({ index: src.originalIndex, level: 'bottom' });
    }
  }

  const block =
    parts.length > 0
      ? `The user has loaded ${sources.length} note(s) for analysis:\n\n${parts.join('\n\n')}`
      : '';

  return { block, includedSources };
}

// ---------------------------------------------------------------------------
// History trimming
// ---------------------------------------------------------------------------

const HISTORY_KEEP_LONG = 8;   // 4 pairs
const HISTORY_KEEP_SHORT = 4;  // 2 pairs

/**
 * Trims conversation history to fit within budgetChars.
 * Keeps last 8 messages if within budget, falls back to last 4 if still over.
 * Returns the full array unchanged when it already fits.
 */
export function trimHistory(messages: AiMessage[], budgetChars: number): AiMessage[] {
  const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);

  if (totalChars <= budgetChars) {
    return messages;
  }

  // Try keeping last 8
  const last8 = messages.slice(-HISTORY_KEEP_LONG);
  const chars8 = last8.reduce((sum, m) => sum + m.content.length, 0);
  if (chars8 <= budgetChars) {
    return last8;
  }

  // Fall back to last 4
  return messages.slice(-HISTORY_KEEP_SHORT);
}
