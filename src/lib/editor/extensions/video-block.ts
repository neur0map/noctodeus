import { Node, mergeAttributes } from '@tiptap/core';

export const VideoBlock = Node.create({
  name: 'videoBlock',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      src: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'video[src]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['video', mergeAttributes(HTMLAttributes, {
      controls: 'true',
      preload: 'metadata',
      class: 'media-video',
    })];
  },

  addNodeView() {
    return ({ node }) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'media-block media-block--video';

      const video = document.createElement('video');
      video.src = node.attrs.src;
      video.controls = true;
      video.preload = 'metadata';
      video.className = 'media-video';

      wrapper.appendChild(video);
      return { dom: wrapper };
    };
  },

  addCommands() {
    return {
      setVideo: (attrs: { src: string }) => ({ commands }: { commands: any }) => {
        return commands.insertContent({ type: 'videoBlock', attrs });
      },
    } as any;
  },
});
