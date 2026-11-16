import type { ReceiptFile } from './receipts';
import type { PdfSaveLocation } from './pdfFileTypes';
export type { PdfSaveLocation } from './pdfFileTypes';

interface SaveHandle {
  name: string;
  createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }>;
}
function pdfBlob(file: ReceiptFile): Blob {
  return new Blob([new Uint8Array(file.bytes).buffer], { type: 'application/pdf' });
}
// This API is used only by native share/print callers, never by browser exports.
export async function cachePdf(_file: ReceiptFile): Promise<string> {
  throw new Error('Browser PDFs use download or preview URLs, not native file storage.');
}
export async function savePdf(file: ReceiptFile, location: PdfSaveLocation): Promise<string> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('Browser file saving is not available yet.');
  }
  const browser = window as unknown as {
    showSaveFilePicker?: (options: object) => Promise<SaveHandle>;
  };
  if (location === 'choose' && browser.showSaveFilePicker) {
    try {
      const handle = await browser.showSaveFilePicker({
        suggestedName: file.filename,
        types: [{ description: 'PDF document', accept: { 'application/pdf': ['.pdf'] } }],
      });
      const writer = await handle.createWritable();
      await writer.write(pdfBlob(file));
      await writer.close();
      return `Operating system confirmed file write: ${handle.name}`;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return 'Saving cancelled; PDF remains ready.';
      }
      throw error;
    }
  }
  const url = URL.createObjectURL(pdfBlob(file));
  const link = document.createElement('a');
  link.href = url;
  link.download = file.filename;
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  return location === 'choose'
    ? 'Folder picker unsupported. Browser download requested; destination and completion are controlled by your browser.'
    : 'Browser Downloads requested. The browser controls the folder; saving is not confirmed.';
}
export async function previewPdf(file: ReceiptFile): Promise<string> {
  if (typeof window === 'undefined') throw new Error('PDF preview unavailable.');
  const url = URL.createObjectURL(pdfBlob(file));
  window.open(url, '_blank', 'noopener,noreferrer');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  // noopener may return null even after successfully opening the viewer.
  return 'PDF preview requested. If your browser blocked the new tab, allow pop-ups or save the PDF.';
}
