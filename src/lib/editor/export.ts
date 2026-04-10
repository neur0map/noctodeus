import type { BlockNoteEditor } from '@blocknote/core';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';

/**
 * BlockNote XL exporter wrappers.
 *
 * These functions mirror the official BlockNote example at
 * https://github.com/TypeCellOS/BlockNote/tree/main/examples/05-interoperability/05-converting-blocks-to-pdf
 * as closely as possible. The only Noctodeus-specific parts are:
 *
 *   1. We use dynamic imports so the exporters aren't pulled into the
 *      SvelteKit SSR bundle.
 *   2. We pipe the resulting blob through Tauri's plugin-dialog
 *      (native save dialog) + plugin-fs (write file) instead of the
 *      browser anchor-download trick.
 *
 * We intentionally DO NOT pass custom inlineContentMapping / blockMapping
 * overrides — the default mappings handle standard BlockNote content.
 * Our custom `wikiLink` inline content renders as plain text fallback,
 * which is acceptable for v0.3.x exports. Per-format custom mappings
 * can be added in a later release once the basic exports are proven.
 */

// ── PDF ────────────────────────────────────────────────────────────

export async function exportPDF(
  editor: BlockNoteEditor<any, any, any>,
  suggestedName = 'note.pdf',
): Promise<void> {
  const [{ PDFExporter, pdfDefaultSchemaMappings }, reactPdf, React] = await Promise.all([
    import('@blocknote/xl-pdf-exporter'),
    import('@react-pdf/renderer'),
    import('react'),
  ]);

  // Custom mapping for our wikiLink inline content spec. Without this
  // the exporter will throw "undefined is not a function" the moment
  // it hits a [[target]] in the document, because the default mapping
  // only covers `link` and `text`.
  const mappings = {
    blockMapping: pdfDefaultSchemaMappings.blockMapping,
    inlineContentMapping: {
      ...pdfDefaultSchemaMappings.inlineContentMapping,
      wikiLink: (ic: any) =>
        React.createElement(
          reactPdf.Text,
          { style: { color: '#7aa2f7' } },
          String(ic?.props?.target ?? ''),
        ),
    } as any,
    styleMapping: pdfDefaultSchemaMappings.styleMapping,
  };

  const exporter = new PDFExporter(editor.schema, mappings as any);
  const pdfDocument = await exporter.toReactPDFDocument(editor.document);
  const blob = await reactPdf.pdf(pdfDocument).toBlob();
  const bytes = new Uint8Array(await blob.arrayBuffer());

  const path = await save({
    defaultPath: suggestedName,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (!path) return;
  await writeFile(path, bytes);
}

// ── DOCX ───────────────────────────────────────────────────────────

export async function exportDOCX(
  editor: BlockNoteEditor<any, any, any>,
  suggestedName = 'note.docx',
): Promise<void> {
  const [{ DOCXExporter, docxDefaultSchemaMappings }, docxLib] = await Promise.all([
    import('@blocknote/xl-docx-exporter'),
    import('docx'),
  ]);

  const mappings = {
    blockMapping: docxDefaultSchemaMappings.blockMapping,
    inlineContentMapping: {
      ...docxDefaultSchemaMappings.inlineContentMapping,
      wikiLink: (ic: any) =>
        new docxLib.TextRun({
          text: String(ic?.props?.target ?? ''),
          color: '7AA2F7',
        }),
    } as any,
    styleMapping: docxDefaultSchemaMappings.styleMapping,
  };

  const exporter = new DOCXExporter(editor.schema, mappings as any);
  const docxDocument = await exporter.toDocxJsDocument(editor.document);
  const buffer = await docxLib.Packer.toBuffer(docxDocument);
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  const path = await save({
    defaultPath: suggestedName,
    filters: [{ name: 'Word Document', extensions: ['docx'] }],
  });
  if (!path) return;
  await writeFile(path, bytes);
}

// ── ODT ────────────────────────────────────────────────────────────

export async function exportODT(
  editor: BlockNoteEditor<any, any, any>,
  suggestedName = 'note.odt',
): Promise<void> {
  const { ODTExporter, odtDefaultSchemaMappings } = await import(
    '@blocknote/xl-odt-exporter'
  );

  const mappings = {
    blockMapping: odtDefaultSchemaMappings.blockMapping,
    inlineContentMapping: {
      ...odtDefaultSchemaMappings.inlineContentMapping,
      // ODT's inline content mapping wants a plain string, not a rich
      // object. Fall back to literal [[target]] which is still human
      // readable inside a LibreOffice/Word document.
      wikiLink: (ic: any) => `[[${String(ic?.props?.target ?? '')}]]`,
    } as any,
    styleMapping: odtDefaultSchemaMappings.styleMapping,
  };

  const exporter = new ODTExporter(editor.schema, mappings as any);
  // The ODT exporter's output method name isn't typed in the 0.47
  // release line — use a loose cast and try both common names.
  const out =
    typeof (exporter as any).toODTDocument === 'function'
      ? await (exporter as any).toODTDocument(editor.document)
      : await (exporter as any).toOdtDocument(editor.document);
  const bytes =
    out instanceof Uint8Array
      ? out
      : out instanceof ArrayBuffer
        ? new Uint8Array(out)
        : new Uint8Array(await (out as Blob).arrayBuffer());

  const path = await save({
    defaultPath: suggestedName,
    filters: [{ name: 'OpenDocument Text', extensions: ['odt'] }],
  });
  if (!path) return;
  await writeFile(path, bytes);
}

// ── Markdown (uses BlockNote core's built-in exporter) ────────────

export async function copyAsMarkdown(
  editor: BlockNoteEditor<any, any, any>,
): Promise<void> {
  const markdown = await editor.blocksToMarkdownLossy(editor.document);
  await navigator.clipboard.writeText(markdown);
}
