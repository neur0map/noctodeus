import { describe, expect, it } from 'vitest';
import {
  buildInlineLoadingLabel,
  shouldUseInlineContext,
  tryGenerateInlineMarkdown,
} from '../inline-ai';

describe('tryGenerateInlineMarkdown', () => {
  it('generates multiplication tables locally', () => {
    const markdown = tryGenerateInlineMarkdown('write a 5x5 multiplication table of 8');

    expect(markdown).toContain('| x | 1 | 2 | 3 | 4 | 5 |');
    expect(markdown).toContain('| 5 | 40 | 80 | 120 | 160 | 200 |');
  });

  it('returns null for non-local prompts', () => {
    expect(tryGenerateInlineMarkdown('continue this paragraph in the same tone')).toBeNull();
  });
});

describe('shouldUseInlineContext', () => {
  it('skips note context for standalone utility prompts', () => {
    expect(shouldUseInlineContext('5x5 multiplication table of 8')).toBe(false);
  });

  it('keeps note context for contextual writing prompts', () => {
    expect(shouldUseInlineContext('continue this section in the same tone')).toBe(true);
  });
});

describe('buildInlineLoadingLabel', () => {
  it('uses table-specific loading copy', () => {
    expect(buildInlineLoadingLabel('make a markdown table of release dates')).toBe('Laying out table...');
  });

  it('falls back to a generic drafting label', () => {
    expect(buildInlineLoadingLabel('write a short paragraph')).toBe('Drafting...');
  });
});
