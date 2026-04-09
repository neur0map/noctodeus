import { BlockNoteSchema, defaultBlockSpecs, defaultInlineContentSpecs } from '@blocknote/core';
import { WikiLink } from './wiki-link';
import { AiPromptBlock } from './ai-prompt-block';

/**
 * Extended BlockNote schema with custom block and inline content types.
 */
export const noctodeusSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    aiPrompt: AiPromptBlock as any,
  },
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    wikiLink: WikiLink,
  },
});

export type NoctodeusSchema = typeof noctodeusSchema;
