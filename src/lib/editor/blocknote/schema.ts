import { BlockNoteSchema, defaultInlineContentSpecs } from '@blocknote/core';
import { withMultiColumn } from '@blocknote/xl-multi-column';
import { WikiLink } from './wiki-link';

/**
 * Extended BlockNote schema with custom inline content types and
 * Notion-style multi-column layouts via @blocknote/xl-multi-column.
 */
const baseSchema = BlockNoteSchema.create({
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    wikiLink: WikiLink,
  },
});

export const nodeusSchema = withMultiColumn(baseSchema);

export type NodeusSchema = typeof nodeusSchema;
