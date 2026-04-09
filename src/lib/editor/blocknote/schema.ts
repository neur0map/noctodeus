import { BlockNoteSchema, defaultInlineContentSpecs } from '@blocknote/core';
import { WikiLink } from './wiki-link';

/**
 * Extended BlockNote schema with custom inline content types.
 */
export const noctodeusSchema = BlockNoteSchema.create({
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    wikiLink: WikiLink,
  },
});

export type NoctodeusSchema = typeof noctodeusSchema;
