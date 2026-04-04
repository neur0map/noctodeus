import { Node, mergeAttributes } from '@tiptap/core';

interface EmbedInfo {
  type: 'iframe' | 'card';
  embedUrl?: string;
  provider?: string;
}

const PROVIDERS: { pattern: RegExp; transform: (match: RegExpMatchArray, url?: string) => string; name: string }[] = [
  {
    name: 'YouTube',
    pattern: /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]+)/,
    transform: (m) => `https://www.youtube.com/embed/${m[1]}`,
  },
  {
    name: 'Vimeo',
    pattern: /vimeo\.com\/(\d+)/,
    transform: (m) => `https://player.vimeo.com/video/${m[1]}`,
  },
  {
    name: 'Spotify',
    pattern: /open\.spotify\.com\/(track|album|playlist|episode)\/([\w]+)/,
    transform: (m) => `https://open.spotify.com/embed/${m[1]}/${m[2]}`,
  },
  {
    name: 'SoundCloud',
    pattern: /soundcloud\.com\/.+/,
    transform: (_m, url?: string) => `https://w.soundcloud.com/player/?url=${encodeURIComponent(url ?? '')}&auto_play=false`,
  },
];

export function detectEmbed(url: string): EmbedInfo {
  for (const provider of PROVIDERS) {
    const match = url.match(provider.pattern);
    if (match) {
      return {
        type: 'iframe',
        embedUrl: provider.transform(match, url),
        provider: provider.name,
      };
    }
  }
  return { type: 'card' };
}

export const EmbedBlock = Node.create({
  name: 'embedBlock',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      url: { default: null },
      embedUrl: { default: null },
      embedType: { default: 'card' },
      provider: { default: null },
      title: { default: null },
      description: { default: null },
      image: { default: null },
      favicon: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-embed-url]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-embed-url': HTMLAttributes.url,
      class: 'media-embed',
    })];
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div');
      dom.className = 'media-block media-block--embed';
      dom.contentEditable = 'false';

      if (node.attrs.embedType === 'iframe' && node.attrs.embedUrl) {
        // Iframe embed for known providers
        const container = document.createElement('div');
        container.className = 'embed-iframe-container';

        const iframe = document.createElement('iframe');
        iframe.src = node.attrs.embedUrl;
        iframe.setAttribute('frameborder', '0');
        iframe.setAttribute('allowfullscreen', 'true');
        iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
        iframe.className = 'embed-iframe';

        // Spotify gets a shorter height
        if (node.attrs.provider === 'Spotify') {
          container.classList.add('embed-iframe-container--compact');
        }

        container.appendChild(iframe);
        dom.appendChild(container);

        if (node.attrs.provider) {
          const badge = document.createElement('span');
          badge.className = 'embed-provider-badge';
          badge.textContent = node.attrs.provider;
          dom.appendChild(badge);
        }
      } else {
        // Link card for unknown URLs
        const card = document.createElement('a');
        card.className = 'embed-card';
        card.href = node.attrs.url;
        card.target = '_blank';
        card.rel = 'noopener noreferrer';

        if (node.attrs.image) {
          const img = document.createElement('img');
          img.src = node.attrs.image;
          img.className = 'embed-card__image';
          card.appendChild(img);
        }

        const body = document.createElement('div');
        body.className = 'embed-card__body';

        if (node.attrs.title) {
          const title = document.createElement('div');
          title.className = 'embed-card__title';
          title.textContent = node.attrs.title;
          body.appendChild(title);
        }

        if (node.attrs.description) {
          const desc = document.createElement('div');
          desc.className = 'embed-card__desc';
          desc.textContent = node.attrs.description;
          body.appendChild(desc);
        }

        const domain = document.createElement('div');
        domain.className = 'embed-card__domain';
        try {
          domain.textContent = new URL(node.attrs.url).hostname;
        } catch {
          domain.textContent = node.attrs.url;
        }
        body.appendChild(domain);

        card.appendChild(body);
        dom.appendChild(card);
      }

      return { dom };
    };
  },

  addCommands() {
    return {
      setEmbed: (attrs: Record<string, unknown>) => ({ commands }: { commands: any }) => {
        return commands.insertContent({ type: 'embedBlock', attrs });
      },
    } as any;
  },
});
