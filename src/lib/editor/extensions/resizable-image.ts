import { Node, mergeAttributes } from '@tiptap/core';
import type { NodeViewRendererProps } from '@tiptap/core';

export const ResizableImage = Node.create({
  name: 'image',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      title: { default: null },
      width: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'img[src]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(HTMLAttributes)];
  },

  addCommands() {
    return {
      setImage: (attrs: { src: string; alt?: string; title?: string; width?: number }) =>
        ({ commands }: { commands: any }) => {
          return commands.insertContent({ type: 'image', attrs });
        },
    } as any;
  },

  addNodeView() {
    return (props: NodeViewRendererProps) => {
      const { node, editor, getPos } = props;

      // Container
      const dom = document.createElement('div');
      dom.className = 'resizable-image';

      // Image
      const img = document.createElement('img');
      img.src = node.attrs.src || '';
      if (node.attrs.alt) img.alt = node.attrs.alt;
      if (node.attrs.width) img.style.width = `${node.attrs.width}px`;
      img.className = 'resizable-image__img';
      img.draggable = false;
      dom.appendChild(img);

      // Resize handle (bottom-right corner)
      const handle = document.createElement('div');
      handle.className = 'resizable-image__handle';
      dom.appendChild(handle);

      // Resize logic
      handle.addEventListener('pointerdown', (e: PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const startX = e.clientX;
        const startWidth = img.offsetWidth;

        handle.setPointerCapture(e.pointerId);
        dom.classList.add('resizable-image--resizing');

        function onMove(ev: PointerEvent) {
          const dx = ev.clientX - startX;
          const newWidth = Math.max(80, startWidth + dx);
          img.style.width = `${newWidth}px`;
        }

        function onUp(ev: PointerEvent) {
          handle.removeEventListener('pointermove', onMove);
          handle.removeEventListener('pointerup', onUp);
          handle.removeEventListener('pointercancel', onUp);
          dom.classList.remove('resizable-image--resizing');

          // Persist the width to the node attribute
          const finalWidth = img.offsetWidth;
          const pos = typeof getPos === 'function' ? getPos() : null;
          if (pos !== null && pos !== undefined) {
            editor.chain().focus()
              .command(({ tr }) => {
                tr.setNodeMarkup(pos, undefined, { ...node.attrs, width: finalWidth });
                return true;
              })
              .run();
          }
        }

        handle.addEventListener('pointermove', onMove);
        handle.addEventListener('pointerup', onUp);
        handle.addEventListener('pointercancel', onUp);
      });

      return { dom };
    };
  },
});
