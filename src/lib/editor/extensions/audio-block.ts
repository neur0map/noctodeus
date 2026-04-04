import { Node, mergeAttributes } from '@tiptap/core';

export const AudioBlock = Node.create({
  name: 'audioBlock',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      src: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'audio[src]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['audio', mergeAttributes(HTMLAttributes, {
      controls: 'true',
      class: 'media-audio',
    })];
  },

  addNodeView() {
    return ({ node }) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'media-block media-block--audio';

      const audio = document.createElement('audio');
      audio.src = node.attrs.src;
      audio.controls = true;
      audio.className = 'media-audio';

      wrapper.appendChild(audio);
      return { dom: wrapper };
    };
  },

  addCommands() {
    return {
      setAudio: (attrs: { src: string }) => ({ commands }: { commands: any }) => {
        return commands.insertContent({ type: 'audioBlock', attrs });
      },
    } as any;
  },
});
