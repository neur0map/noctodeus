import { logger } from '../logger';

const EXPORT_CSS = `body{font-family:system-ui,-apple-system,sans-serif;max-width:720px;margin:2rem auto;padding:0 1rem;color:#e0e0e0;background:#0A0E1A;line-height:1.7;}a{color:#7AA2F7;}pre{background:#111;padding:1rem;border-radius:8px;overflow-x:auto;}code{font-family:monospace;font-size:0.9em;}img{max-width:100%;border-radius:8px;}blockquote{border-left:3px solid #444;padding-left:1rem;color:#aaa;}h1,h2,h3{font-weight:600;letter-spacing:-0.02em;}`;

export function stripMediaFromMarkdown(md: string): string {
  return md.replace(/^!\[.*?\]\(.*?\).*$/gm, '').replace(/\n{3,}/g, '\n\n');
}

export function escapeCsvField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

interface ExportContext {
  corePath: string | undefined;
  coreName: string | undefined;
  allMarkdownFiles: { path: string; title: string | null }[];
}

export async function handleExport(
  format: string,
  includeMedia: boolean,
  targetPath: string,
  ctx: ExportContext,
) {
  const { readFile } = await import('../bridge/commands');
  const { save: saveDialog } = await import('@tauri-apps/plugin-dialog');
  const { writeFile: tauriWrite } = await import('@tauri-apps/plugin-fs');
  const { toast } = await import('../stores/toast.svelte');

  try {
    const baseName = targetPath.split('/').pop()?.replace(/\.(md|markdown)$/i, '') ?? 'export';

    if (format === 'markdown') {
      const { content } = await readFile(targetPath);
      const output = includeMedia ? content : stripMediaFromMarkdown(content);
      const savePath = await saveDialog({
        defaultPath: `${baseName}.md`,
        filters: [{ name: 'Markdown', extensions: ['md'] }],
      });
      if (!savePath) return;
      await tauriWrite(savePath, new TextEncoder().encode(output));

      if (includeMedia) {
        await copyMediaForExport(content, savePath, ctx.corePath);
      }
      toast.success(`Exported ${baseName}.md`);

    } else if (format === 'html') {
      const { content } = await readFile(targetPath);
      const md = includeMedia ? content : stripMediaFromMarkdown(content);
      const MarkdownIt = (await import('markdown-it')).default;
      const html = new MarkdownIt().render(md);
      const fullHtml = `<!DOCTYPE html>\n<html>\n<head>\n<meta charset="utf-8">\n<title>${baseName}</title>\n<style>${EXPORT_CSS}</style>\n</head>\n<body>\n${html}\n</body>\n</html>`;
      const savePath = await saveDialog({
        defaultPath: `${baseName}.html`,
        filters: [{ name: 'HTML', extensions: ['html'] }],
      });
      if (!savePath) return;
      await tauriWrite(savePath, new TextEncoder().encode(fullHtml));

      if (includeMedia) {
        await copyMediaForExport(content, savePath, ctx.corePath);
      }
      toast.success(`Exported ${baseName}.html`);

    } else if (format === 'csv') {
      const rows: string[] = ['path,title,content'];
      for (const file of ctx.allMarkdownFiles) {
        try {
          const { content } = await readFile(file.path);
          const md = includeMedia ? content : stripMediaFromMarkdown(content);
          rows.push(`${escapeCsvField(file.path)},${escapeCsvField(file.title ?? '')},${escapeCsvField(md)}`);
        } catch {
          rows.push(`${escapeCsvField(file.path)},${escapeCsvField(file.title ?? '')},""`);
        }
      }
      const csvContent = rows.join('\n');
      const savePath = await saveDialog({
        defaultPath: `${ctx.coreName ?? 'noctodeus'}-export.csv`,
        filters: [{ name: 'CSV', extensions: ['csv'] }],
      });
      if (!savePath) return;
      await tauriWrite(savePath, new TextEncoder().encode(csvContent));
      toast.success(`Exported ${ctx.allMarkdownFiles.length} files to CSV`);
    }
  } catch (err) {
    logger.error(`Export failed: ${err}`);
    const { toast } = await import('../stores/toast.svelte');
    toast.error(`Export failed: ${err}`);
  }
}

async function copyMediaForExport(content: string, exportPath: string, corePath: string | undefined) {
  const mediaRefs = [...content.matchAll(/!\[.*?\]\((.*?)\)/g)]
    .map(m => m[1])
    .filter(src => src && !src.startsWith('http'));

  if (mediaRefs.length === 0 || !corePath) return;

  const { mkdir, copyFile } = await import('@tauri-apps/plugin-fs');
  const exportDir = exportPath.substring(0, exportPath.lastIndexOf('/'));
  const mediaDir = `${exportDir}/media`;

  try {
    await mkdir(mediaDir, { recursive: true });
  } catch {
    // may already exist
  }

  for (const ref of mediaRefs) {
    try {
      const srcPath = `${corePath}/${ref}`;
      const destPath = `${exportDir}/${ref}`;
      const destDir = destPath.substring(0, destPath.lastIndexOf('/'));
      try { await mkdir(destDir, { recursive: true }); } catch {}
      await copyFile(srcPath, destPath);
    } catch {
      // skip files that can't be copied
    }
  }
}
