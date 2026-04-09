import { createReactInlineContentSpec } from '@blocknote/react';
import React from 'react';

/**
 * Custom inline content type for [[wiki links]].
 *
 * Renders as a clickable span that dispatches a 'wiki-link-click' custom event.
 *
 * The parse function recognizes <span data-wiki-target="..."> elements
 * (injected by our HTML post-processor) and converts them to wikiLink nodes.
 *
 * The toExternalHTML function outputs [[target]] as plain text so that
 * BlockNote's blocks-to-markdown pipeline preserves the wiki-link syntax.
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
          className="wiki-link"
          data-wiki-target={target}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const event = new CustomEvent('wiki-link-click', {
              bubbles: true,
              detail: { target },
            });
            e.currentTarget.dispatchEvent(event);
          }}
        >
          {display}
        </span>
      );
    },

    /**
     * toExternalHTML: When exporting to HTML for markdown conversion,
     * output [[target]] as plain text. The rehype-remark pipeline will
     * pass this through to markdown as-is because BlockNote's markdown
     * exporter uses a custom text handler that skips escaping.
     */
    toExternalHTML: ({ inlineContent }) => {
      const target = inlineContent.props.target;
      return (
        <span>{'[[' + target + ']]'}</span>
      );
    },

    /**
     * parse: Recognize <span data-wiki-target="..."> elements produced
     * by our HTML preprocessor (injectWikiLinksIntoHTML) during markdown import.
     * Returns the props for the wikiLink inline content node.
     */
    parse: (element: HTMLElement) => {
      const target = element.getAttribute('data-wiki-target');
      if (target) {
        return { target };
      }
      return undefined;
    },
  },
);
