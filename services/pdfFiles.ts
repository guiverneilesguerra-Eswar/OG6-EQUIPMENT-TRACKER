// Expo/Metro selects pdfFiles.web.ts or pdfFiles.native.ts for platform bundles.
// The native fallback keeps standard TypeScript module resolution consistent.
export type { PdfSaveLocation } from './pdfFileTypes';
export { cachePdf, savePdf, previewPdf } from './pdfFiles.native';
