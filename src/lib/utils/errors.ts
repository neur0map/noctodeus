/// Extract a human-readable error message from any error type.
/// Handles Tauri's {code, message} objects, plain strings, and Error instances.
export function errorMessage(err: unknown): string {
  if (!err) return 'Unknown error';
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message;
  if (typeof err === 'object') {
    const obj = err as Record<string, unknown>;
    if (typeof obj.message === 'string') return obj.message;
    if (typeof obj.detail === 'string') return obj.detail;
    try { return JSON.stringify(err); } catch { /* fall through */ }
  }
  return String(err);
}
