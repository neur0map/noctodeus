import type { BlockNoteEditor } from '@blocknote/core';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';

/**
 * BlockNote XL exporter wrappers.
 *
 * These functions mirror the official BlockNote example at
 * https://github.com/TypeCellOS/BlockNote/tree/main/examples/05-interoperability/05-converting-blocks-to-pdf
 * as closely as possible. The Nodeus-specific parts are:
 *
 *   1. We use dynamic imports so the exporters aren't pulled into the
 *      SvelteKit SSR bundle.
 *   2. We pipe the resulting blob through Tauri's plugin-dialog
 *      (native save dialog) + plugin-fs (write file) instead of the
 *      browser anchor-download trick.
 *   3. **We override `resolveFileUrl` to be a pass-through identity.**
 *      The exporters' default resolver routes every image URL through
 *      BlockNote's CORS proxy (https://corsproxy.api.blocknotejs.org/...)
 *      which fails in a Tauri WebView with the generic WebKit error
 *      "Load failed". In our WebView we have direct access to both
 *      `asset://` URLs (Tauri's local-file protocol) and any HTTPS URL
 *      via the relaxed CSP, so we don't need a proxy at all.
 *   4. Custom `wikiLink` inline content mappings on each exporter so
 *      notes containing [[target]] don't crash the exporter.
 */

/**
 * Pass-through resolveFileUrl. The exporter base class calls this for
 * every image/file URL in the document; the returned URL is then
 * fetch()'d inside the WebView. Since Tauri's WebView can already
 * reach both `asset://` local files and https:// endpoints directly,
 * we just return the URL unchanged. No CORS proxy involved.
 */
const passthroughResolveFileUrl = async (url: string): Promise<string> => url;

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

  const exporter = new PDFExporter(editor.schema, mappings as any, {
    resolveFileUrl: passthroughResolveFileUrl,
  });
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

  const exporter = new DOCXExporter(editor.schema, mappings as any, {
    resolveFileUrl: passthroughResolveFileUrl,
  });
  const docxDocument = await exporter.toDocxJsDocument(editor.document);
  // Use toArrayBuffer() not toBuffer(). toBuffer() returns a Node.js
  // Buffer which doesn't exist in the Tauri WebView — it throws
  // "nodebuffer is not supported by this platform" from JSZip.
  const arrayBuffer = await docxLib.Packer.toArrayBuffer(docxDocument);
  const bytes = new Uint8Array(arrayBuffer);

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

  const exporter = new ODTExporter(editor.schema, mappings as any, {
    resolveFileUrl: passthroughResolveFileUrl,
  });
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
