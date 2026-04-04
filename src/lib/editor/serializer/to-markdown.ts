import type { JSONContent } from '@tiptap/core';

function serializeInline(node: JSONContent): string {
  if (node.type === 'text') {
    let text = node.text ?? '';
    if (node.marks) {
      for (const mark of node.marks) {
        switch (mark.type) {
          case 'bold':
            text = `**${text}**`;
            break;
          case 'italic':
            text = `*${text}*`;
            break;
          case 'code':
            text = `\`${text}\``;
            break;
          case 'link':
            text = `[${text}](${mark.attrs?.href ?? ''})`;
            break;
        }
      }
    }
    return text;
  }

  if (node.type === 'wikiLink') {
    return `[[${node.attrs?.target ?? ''}]]`;
  }

  if (node.type === 'hardBreak') {
    return '  \n';
  }

  if (node.type === 'image') {
    const alt = node.attrs?.alt ?? '';
    const src = node.attrs?.src ?? '';
    return `![${alt}](${src})`;
  }

  return '';
}

function serializeChildren(children: JSONContent[] | undefined): string {
  if (!children) return '';
  return children.map((child) => serializeNode(child)).join('');
}

function serializeNode(node: JSONContent): string {
  switch (node.type) {
    case 'doc':
      return serializeChildren(node.content);

    case 'paragraph': {
      const inline = (node.content ?? []).map(serializeInline).join('');
      return inline + '\n\n';
    }

    case 'heading': {
      const level = node.attrs?.level ?? 1;
      const prefix = '#'.repeat(level);
      const inline = (node.content ?? []).map(serializeInline).join('');
      return `${prefix} ${inline}\n\n`;
    }

    case 'bulletList': {
      const items = (node.content ?? []).map((item) => {
        const inner = serializeChildren(item.content).replace(/\n\n$/, '');
        return `- ${inner}\n`;
      });
      return items.join('') + '\n';
    }

    case 'orderedList': {
      const items = (node.content ?? []).map((item, i) => {
        const inner = serializeChildren(item.content).replace(/\n\n$/, '');
        return `${i + 1}. ${inner}\n`;
      });
      return items.join('') + '\n';
    }

    case 'taskList': {
      const items = (node.content ?? []).map((item) => {
        const checked = item.attrs?.checked ? 'x' : ' ';
        const inner = serializeChildren(item.content).replace(/\n\n$/, '');
        return `- [${checked}] ${inner}\n`;
      });
      return items.join('') + '\n';
    }

    case 'codeBlock': {
      const lang = node.attrs?.language ?? '';
      const code = (node.content ?? []).map((c) => c.text ?? '').join('').replace(/\n+$/, '');
      return '```' + lang + '\n' + code + '\n```\n\n';
    }

    case 'blockquote': {
      const inner = serializeChildren(node.content);
      const lines = inner.replace(/\n$/, '').split('\n');
      return lines.map((line) => `> ${line}`).join('\n') + '\n\n';
    }

    case 'horizontalRule':
      return '---\n\n';

    case 'image': {
      const alt = node.attrs?.alt ?? '';
      const src = node.attrs?.src ?? '';
      return `![${alt}](${src})\n\n`;
    }

    case 'videoBlock': {
      const src = node.attrs?.src ?? '';
      return `![video](${src})\n\n`;
    }

    case 'audioBlock': {
      const src = node.attrs?.src ?? '';
      return `![audio](${src})\n\n`;
    }

    case 'embedBlock': {
      const url = node.attrs?.url ?? '';
      return `[embed](${url})\n\n`;
    }

    case 'hardBreak':
      return '  \n';

    default:
      return serializeChildren(node.content);
  }
}

export function serializeMarkdown(doc: JSONContent): string {
  return serializeNode(doc).trimEnd() + '\n';
}
