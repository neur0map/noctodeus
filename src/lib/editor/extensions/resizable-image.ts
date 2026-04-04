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

      const dom = document.createElement('div');
      dom.className = 'resizable-image';

      const img = document.createElement('img');
      img.src = node.attrs.src || '';
      if (node.attrs.alt) img.alt = node.attrs.alt;
      if (node.attrs.width) img.style.width = `${node.attrs.width}px`;
      img.className = 'resizable-image__img';
      img.draggable = false;
      dom.appendChild(img);

      // Left and right edge handles
      const handleL = document.createElement('div');
      handleL.className = 'resizable-image__edge resizable-image__edge--left';
      dom.appendChild(handleL);

      const handleR = document.createElement('div');
      handleR.className = 'resizable-image__edge resizable-image__edge--right';
      dom.appendChild(handleR);

      function startResize(e: PointerEvent, direction: 'left' | 'right') {
        e.preventDefault();
        e.stopPropagation();

        const startX = e.clientX;
        const startWidth = img.offsetWidth;
        const el = e.currentTarget as HTMLElement;

        el.setPointerCapture(e.pointerId);
        dom.classList.add('resizable-image--resizing');

        function onMove(ev: PointerEvent) {
          const dx = ev.clientX - startX;
          const delta = direction === 'right' ? dx : -dx;
          const newWidth = Math.max(80, Math.min(startWidth + delta, dom.parentElement?.clientWidth ?? 9999));
          img.style.width = `${newWidth}px`;
        }

        function onUp() {
          el.removeEventListener('pointermove', onMove);
          el.removeEventListener('pointerup', onUp);
          el.removeEventListener('pointercancel', onUp);
          dom.classList.remove('resizable-image--resizing');

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

        el.addEventListener('pointermove', onMove);
        el.addEventListener('pointerup', onUp);
        el.addEventListener('pointercancel', onUp);
      }

      handleL.addEventListener('pointerdown', (e) => startResize(e, 'left'));
      handleR.addEventListener('pointerdown', (e) => startResize(e, 'right'));

      return { dom };
    };
  },
});
