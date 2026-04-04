import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'];
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/webm'];

export type MediaUploader = (file: File) => Promise<string | null>;

export function createMediaDrop(uploadFile: MediaUploader) {
  return Extension.create({
    name: 'mediaDrop',

    addProseMirrorPlugins() {
      const editorRef = this.editor;

      return [
        new Plugin({
          key: new PluginKey('mediaDrop'),
          props: {
            handleDrop(view: EditorView, event: DragEvent) {
              if (!event.dataTransfer?.files?.length) return false;

              const file = event.dataTransfer.files[0];
              const mime = file.type;

              let nodeType: string | null = null;
              if (IMAGE_TYPES.includes(mime)) nodeType = 'image';
              else if (VIDEO_TYPES.includes(mime)) nodeType = 'videoBlock';
              else if (AUDIO_TYPES.includes(mime)) nodeType = 'audioBlock';

              if (!nodeType) return false;

              event.preventDefault();

              const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });

              uploadFile(file).then((mediaPath) => {
                if (!mediaPath) return;

                if (nodeType === 'image') {
                  editorRef.chain().focus().setImage({ src: mediaPath }).run();
                } else {
                  editorRef.chain().focus().insertContentAt(
                    pos?.pos ?? editorRef.state.selection.head,
                    { type: nodeType!, attrs: { src: mediaPath } },
                  ).run();
                }
              });

              return true;
            },
          },
        }),
      ];
    },
  });
}
