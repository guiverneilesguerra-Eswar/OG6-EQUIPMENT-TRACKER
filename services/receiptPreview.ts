import { receiptPreviewLayout } from '../constants/theme';
import { a4Layout } from '../constants/pdfLayout';

// Vector commands from the same generation pass as the PDF, never a remote viewer.
export interface ReceiptPreviewDocument { svg: string; width: number; height: number; bodyScale: number }
export interface ReceiptPreviewGeometry { viewportWidth: number; viewportHeight: number; pageWidth: number; pageHeight: number }
export function normalizeReceiptZoom(value: number): number {
  const finite = Number.isFinite(value) ? value : receiptPreviewLayout.minZoom;
  return Math.max(receiptPreviewLayout.minZoom, Math.min(receiptPreviewLayout.maxZoom, finite));
}
export function nextReceiptZoom(current: number, direction: 'in' | 'out'): number {
  const steps = receiptPreviewLayout.zoomSteps;
  const zoom = normalizeReceiptZoom(current);
  return direction === 'in'
    ? steps.find(step => step > zoom + 0.001) ?? receiptPreviewLayout.maxZoom
    : [...steps].reverse().find(step => step < zoom - 0.001) ?? receiptPreviewLayout.minZoom;
}
export function receiptPreviewGeometry(document: ReceiptPreviewDocument, width: number, screenHeight: number, zoom: number): ReceiptPreviewGeometry {
  const viewportWidth = Math.max(1, Number.isFinite(width) && width > 0 ? width : receiptPreviewLayout.initialWidth);
  const availableHeight = Number.isFinite(screenHeight) && screenHeight > 0 ? screenHeight : 667;
  const documentWidth = Number.isFinite(document.width) && document.width > 0 ? document.width : a4Layout.width;
  const documentHeight = Number.isFinite(document.height) && document.height > 0 ? document.height : a4Layout.height;
  const pageWidth = Math.max(1, viewportWidth * normalizeReceiptZoom(zoom));
  const pageHeight = Math.max(1, pageWidth * documentHeight / documentWidth);
  const viewportHeight = Math.min(pageHeight, Math.max(receiptPreviewLayout.minHeight, Math.min(receiptPreviewLayout.maxHeight, availableHeight * receiptPreviewLayout.heightFraction)));
  return { viewportWidth, viewportHeight, pageWidth, pageHeight };
}
