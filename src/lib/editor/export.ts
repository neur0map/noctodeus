import type { BlockNoteEditor } from '@blocknote/core';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';

/**
 * Export the current editor document as a PDF file.
 * Uses @blocknote/xl-pdf-exporter + @react-pdf/renderer with a custom
 * wikiLink mapping so Noctodeus's custom inline content renders as
 * styled text in the output.
 */
export async function exportPDF(
  editor: BlockNoteEditor<any, any, any>,
  suggestedName = 'note.pdf',
): Promise<void> {
  const [{ PDFExporter, pdfDefaultSchemaMappings }, ReactPDF, React] = await Promise.all([
    import('@blocknote/xl-pdf-exporter'),
    import('@react-pdf/renderer'),
    import('react'),
  ]);

  const exporter = new PDFExporter(editor.schema, {
    blockMapping: pdfDefaultSchemaMappings.blockMapping,
    inlineContentMapping: {
      ...pdfDefaultSchemaMappings.inlineContentMapping,
      wikiLink: (ic: any) =>
        React.createElement(
          ReactPDF.Text,
          { style: { color: '#7aa2f7' } },
          String(ic.props?.target ?? ''),
        ),
    } as any,
    styleMapping: pdfDefaultSchemaMappings.styleMapping,
  } as any);

  const doc = await exporter.toReactPDFDocument(editor.document);
  const blob = await (ReactPDF as any).pdf(doc).toBlob();
  const bytes = new Uint8Array(await (blob as Blob).arrayBuffer());

  const path = await save({
    defaultPath: suggestedName,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (!path) return;
  await writeFile(path, bytes);
}

/**
 * Export the current editor document as a DOCX (Word) file.
 * Uses @blocknote/xl-docx-exporter + docx, with a custom wikiLink
 * mapping that renders as blue-tinted text runs.
 */
export async function exportDOCX(
  editor: BlockNoteEditor<any, any, any>,
  suggestedName = 'note.docx',
): Promise<void> {
  const [{ DOCXExporter, docxDefaultSchemaMappings }, { Packer, TextRun }] = await Promise.all([
    import('@blocknote/xl-docx-exporter'),
    import('docx'),
  ]);

  const exporter = new DOCXExporter(editor.schema, {
    blockMapping: docxDefaultSchemaMappings.blockMapping,
    inlineContentMapping: {
      ...docxDefaultSchemaMappings.inlineContentMapping,
      wikiLink: (ic: any) =>
        new TextRun({ text: String(ic.props?.target ?? ''), color: '7AA2F7' }),
    } as any,
    styleMapping: docxDefaultSchemaMappings.styleMapping,
  } as any);

  const docxDoc = await exporter.toDocxJsDocument(editor.document);
  const bytes = new Uint8Array(await Packer.toBuffer(docxDoc));

  const path = await save({
    defaultPath: suggestedName,
    filters: [{ name: 'Word Document', extensions: ['docx'] }],
  });
  if (!path) return;
  await writeFile(path, bytes);
}

/**
 * Export the current editor document as an ODT (OpenDocument Text) file.
 * Uses @blocknote/xl-odt-exporter with a custom wikiLink mapping that
 * falls back to literal [[target]] since ODT doesn't have a rich
 * inline-element concept we can map to.
 */
export async function exportODT(
  editor: BlockNoteEditor<any, any, any>,
  suggestedName = 'note.odt',
): Promise<void> {
  const { ODTExporter, odtDefaultSchemaMappings } = await import('@blocknote/xl-odt-exporter');

  const exporter = new ODTExporter(editor.schema, {
    blockMapping: odtDefaultSchemaMappings.blockMapping,
    inlineContentMapping: {
      ...odtDefaultSchemaMappings.inlineContentMapping,
      wikiLink: (ic: any) => `[[${String(ic.props?.target ?? '')}]]`,
    } as any,
    styleMapping: odtDefaultSchemaMappings.styleMapping,
  } as any);

  const bytes = await (exporter as any).toODTDocument(editor.document);

  const path = await save({
    defaultPath: suggestedName,
    filters: [{ name: 'OpenDocument Text', extensions: ['odt'] }],
  });
  if (!path) return;
  await writeFile(path, bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
}

/**
 * Copy the current editor document as Markdown to the clipboard.
 * Uses BlockNote's built-in markdown exporter — no extra package needed.
 */
export async function copyAsMarkdown(
  editor: BlockNoteEditor<any, any, any>,
): Promise<void> {
  const markdown = await editor.blocksToMarkdownLossy(editor.document);
  await navigator.clipboard.writeText(markdown);
}
