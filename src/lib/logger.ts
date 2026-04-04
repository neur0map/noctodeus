import { logWrite } from './bridge/commands';

export const logger = {
  error(message: string, ctx?: string) {
    console.error(message, ctx);
    logWrite('error', message, ctx).catch(() => {});
  },
  warn(message: string, ctx?: string) {
    console.warn(message, ctx);
    logWrite('warn', message, ctx).catch(() => {});
  },
  info(message: string, ctx?: string) {
    if (import.meta.env.DEV) console.info(message, ctx);
  },
  debug(message: string, ctx?: string) {
    if (import.meta.env.DEV) console.debug(message, ctx);
  },
};

// Capture unhandled errors
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    logger.error(`Unhandled rejection: ${event.reason}`);
  });
  window.addEventListener('error', (event) => {
    logger.error(`Uncaught error: ${event.message}`, `${event.filename}:${event.lineno}`);
  });
}
