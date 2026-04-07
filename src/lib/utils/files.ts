/**
 * Sanitize a file or directory name for safe filesystem use.
 *
 * - Replaces whitespace runs with dashes
 * - Strips unsafe characters (<>:"|?*\)
 * - Appends `defaultExtension` when the name has no extension and `isDir` is false
 */
export function sanitizeFileName(
  name: string,
  isDir: boolean,
  defaultExtension: string = ".md",
): string {
  // Replace spaces with dashes
  let clean = name.trim().replace(/\s+/g, "-");
  // Remove unsafe characters
  clean = clean.replace(/[<>:"|?*\\]/g, "");
  // Ensure default extension for files (not directories)
  if (!isDir && !clean.includes(".")) {
    clean += defaultExtension;
  }
  return clean;
}
