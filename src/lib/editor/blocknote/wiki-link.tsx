import { createReactInlineContentSpec } from '@blocknote/react';
import React from 'react';

/**
 * Custom inline content type for [[wiki links]].
 * Renders as a clickable link that triggers navigation.
 */
export const WikiLink = createReactInlineContentSpec(
  {
    type: 'wikiLink' as const,
    propSchema: {
      target: { default: '' },
    },
    content: 'none',
  },
  {
    render: ({ inlineContent }) => {
      const target = inlineContent.props.target;
      const display = target.replace(/\.(md|markdown)$/i, '').split('/').pop() ?? target;

      return (
        <span
          className="bn-wiki-link"
          data-wiki-target={target}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            // Dispatch a custom event that the Svelte bridge can catch
            const event = new CustomEvent('wiki-link-click', {
              bubbles: true,
              detail: { target },
            });
            e.currentTarget.dispatchEvent(event);
          }}
          style={{
            color: 'var(--accent-blue, var(--color-accent, #7aa2f7))',
            cursor: 'pointer',
            textDecoration: 'none',
            borderBottom: '1px solid color-mix(in srgb, var(--accent-blue, #7aa2f7) 30%, transparent)',
          }}
        >
          {display}
        </span>
      );
    },
  },
);
