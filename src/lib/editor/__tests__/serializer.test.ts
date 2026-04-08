import { describe, it, expect } from 'vitest';
import { parseMarkdown } from '../serializer/from-markdown';
import { serializeMarkdown } from '../serializer/to-markdown';
import type { JSONContent } from '@tiptap/core';

describe('parseMarkdown', () => {
  it('converts headings to HTML', () => {
    const html = parseMarkdown('# Hello\n\n## World');
    expect(html).toContain('<h1>Hello</h1>');
    expect(html).toContain('<h2>World</h2>');
  });

  it('converts wiki-links to custom elements', () => {
    const html = parseMarkdown('See [[my-note]] for details');
    expect(html).toContain('<wiki-link target="my-note">my-note</wiki-link>');
  });

  it('converts task lists to checkboxes', () => {
    const html = parseMarkdown('- [x] Done\n- [ ] Todo');
    expect(html).toContain('checked');
    expect(html).toContain('Todo');
  });

  it('converts code blocks with language', () => {
    const html = parseMarkdown('```js\nconsole.log("hi")\n```');
    expect(html).toContain('<code');
    expect(html).toContain('console.log');
  });

  it('converts blockquotes', () => {
    const html = parseMarkdown('> quoted text');
    expect(html).toContain('<blockquote>');
    expect(html).toContain('quoted text');
  });

  it('converts inline formatting', () => {
    const html = parseMarkdown('**bold** and *italic* and `code`');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
    expect(html).toContain('<code>code</code>');
  });

  it('converts images', () => {
    const html = parseMarkdown('![alt text](image.png)');
    expect(html).toContain('<img');
    expect(html).toContain('alt text');
    expect(html).toContain('image.png');
  });

  it('converts links', () => {
    const html = parseMarkdown('[click here](https://example.com)');
    expect(html).toContain('<a');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('click here');
  });

  it('handles empty input', () => {
    const html = parseMarkdown('');
    expect(html).toBe('');
  });
});

describe('serializeMarkdown', () => {
  it('serializes headings', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Title' }],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Subtitle' }],
        },
      ],
    };
    const md = serializeMarkdown(doc);
    expect(md).toContain('# Title');
    expect(md).toContain('## Subtitle');
  });

  it('serializes paragraphs with blank lines', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'First' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Second' }],
        },
      ],
    };
    const md = serializeMarkdown(doc);
    expect(md).toContain('First\n\nSecond');
  });

  it('serializes bold and italic marks', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'bold',
              marks: [{ type: 'bold' }],
            },
            { type: 'text', text: ' and ' },
            {
              type: 'text',
              text: 'italic',
              marks: [{ type: 'italic' }],
            },
          ],
        },
      ],
    };
    const md = serializeMarkdown(doc);
    expect(md).toContain('**bold**');
    expect(md).toContain('*italic*');
  });

  it('serializes wiki-links', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'See ' },
            { type: 'wikiLink', attrs: { target: 'my-note' } },
          ],
        },
      ],
    };
    const md = serializeMarkdown(doc);
    expect(md).toContain('[[my-note]]');
  });

  it('serializes code blocks with language', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'codeBlock',
          attrs: { language: 'js' },
          content: [{ type: 'text', text: 'console.log("hi")' }],
        },
      ],
    };
    const md = serializeMarkdown(doc);
    expect(md).toContain('```js\nconsole.log("hi")\n```');
  });

  it('serializes bullet lists', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Item one' }],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Item two' }],
                },
              ],
            },
          ],
        },
      ],
    };
    const md = serializeMarkdown(doc);
    expect(md).toContain('- Item one');
    expect(md).toContain('- Item two');
  });

  it('serializes horizontal rule', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Above' }],
        },
        { type: 'horizontalRule' },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Below' }],
        },
      ],
    };
    const md = serializeMarkdown(doc);
    expect(md).toContain('---');
  });

  it('serializes empty document', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [],
    };
    const md = serializeMarkdown(doc);
    expect(md).toBe('\n');
  });

  it('treats transient aiPrompt nodes as empty paragraphs', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Before' }],
        },
        {
          type: 'aiPrompt',
          attrs: {
            prompt: 'Draft something here',
            state: 'loading',
          },
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'After' }],
        },
      ],
    };

    const md = serializeMarkdown(doc);

    expect(md).toContain('Before\n\n\n\nAfter');
  });
});
