export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
}

let toasts = $state<ToastItem[]>([]);
let nextId = 0;

function getDuration(type: ToastType): number {
  switch (type) {
    case 'info':
    case 'success':
      return 3000;
    case 'warning':
      return 6000;
    case 'error':
      return 0; // persistent
  }
}

export function getToastState() {
  return {
    get toasts() {
      return toasts;
    },

    add(type: ToastType, message: string, duration?: number) {
      const id = `toast-${++nextId}`;
      const dur = duration ?? getDuration(type);
      const item: ToastItem = { id, type, message, duration: dur };
      toasts = [...toasts, item];

      if (dur > 0) {
        setTimeout(() => this.remove(id), dur);
      }
    },

    remove(id: string) {
      toasts = toasts.filter((t) => t.id !== id);
    },

    reset() {
      toasts = [];
    },
  };
}

/** Convenience shorthands -- singleton */
const state = getToastState();
export const toast = {
  info: (msg: string) => state.add('info', msg),
  success: (msg: string) => state.add('success', msg),
  warn: (msg: string) => state.add('warning', msg),
  error: (msg: string) => state.add('error', msg),
};
