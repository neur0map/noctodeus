import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, NodeSelection } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';

const pluginKey = new PluginKey('blockDragHandle');

export const BlockDragHandle = Extension.create({
  name: 'blockDragHandle',

  addProseMirrorPlugins() {
    let handle: HTMLDivElement | null = null;
    let targetPos: number | null = null;
    let hideTimeout: ReturnType<typeof setTimeout> | null = null;

    function getHandle(): HTMLDivElement {
      if (!handle) {
        handle = document.createElement('div');
        handle.className = 'block-drag-handle';
        handle.draggable = true;
        handle.contentEditable = 'false';
        handle.innerHTML = `<svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor"><circle cx="2.5" cy="2" r="1.2"/><circle cx="7.5" cy="2" r="1.2"/><circle cx="2.5" cy="7" r="1.2"/><circle cx="7.5" cy="7" r="1.2"/><circle cx="2.5" cy="12" r="1.2"/><circle cx="7.5" cy="12" r="1.2"/></svg>`;

        // On mousedown, select the node so ProseMirror can drag it
        handle.addEventListener('mousedown', (e) => {
          e.preventDefault();
          if (targetPos === null || !handle) return;
          const view = (handle as any).__view as EditorView | undefined;
          if (!view) return;

          const node = view.state.doc.nodeAt(targetPos);
          if (!node) return;

          // Create NodeSelection — this makes the node draggable by ProseMirror
          const tr = view.state.tr.setSelection(NodeSelection.create(view.state.doc, targetPos));
          view.dispatch(tr);
        });

        handle.addEventListener('mouseenter', () => {
          if (hideTimeout) { clearTimeout(hideTimeout); hideTimeout = null; }
        });

        handle.addEventListener('mouseleave', () => {
          scheduleHide();
        });
      }
      return handle;
    }

    function showAt(view: EditorView, nodeEl: HTMLElement, pos: number) {
      if (hideTimeout) { clearTimeout(hideTimeout); hideTimeout = null; }

      const h = getHandle();
      (h as any).__view = view;
      targetPos = pos;

      const editorRect = view.dom.getBoundingClientRect();
      const nodeRect = nodeEl.getBoundingClientRect();

      h.style.top = `${nodeRect.top - editorRect.top + view.dom.scrollTop}px`;

      if (!h.parentElement) {
        view.dom.appendChild(h);
      }
      h.style.opacity = '1';
    }

    function scheduleHide() {
      if (hideTimeout) clearTimeout(hideTimeout);
      hideTimeout = setTimeout(() => {
        if (handle) handle.style.opacity = '0';
        targetPos = null;
      }, 300);
    }

    function destroy() {
      if (hideTimeout) clearTimeout(hideTimeout);
      if (handle) {
        handle.remove();
        handle = null;
      }
    }

    return [
      new Plugin({
        key: pluginKey,
        view() {
          return { destroy };
        },
        props: {
          handleDOMEvents: {
            mousemove(view, event) {
              const coords = { left: event.clientX, top: event.clientY };
              const pos = view.posAtCoords(coords);
              if (!pos) { scheduleHide(); return false; }

              const $pos = view.state.doc.resolve(pos.pos);
              if ($pos.depth === 0) { scheduleHide(); return false; }

              // Resolve to top-level block (depth 1)
              const nodePos = $pos.before(1);
              const domNode = view.nodeDOM(nodePos);
              if (!domNode || !(domNode instanceof HTMLElement)) {
                scheduleHide();
                return false;
              }

              showAt(view, domNode, nodePos);
              return false;
            },
            mouseleave() {
              scheduleHide();
              return false;
            },
          },
        },
      }),
    ];
  },
});
