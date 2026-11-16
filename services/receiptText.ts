import type { A4Block } from './singleA4Document';
import type { Signature } from './tracker';
import { receiptPreviewLayout } from '../constants/theme';

export interface ReceiptTextField { label: string; value: string }
export type ReceiptTextEntry =
  | { id: string; kind: 'text'; text: string; heading: boolean }
  | { id: string; kind: 'equipment'; title: string; fields: ReceiptTextField[] }
  | { id: string; kind: 'signature'; label: string; person: string; signature: Signature; note: string };
export interface ReceiptTextDocument { title: string; entries: ReceiptTextEntry[] }
export type ReceiptViewMode = 'a4' | 'text';

// Use the original structured receipt content, not SVG extraction or a second PDF.
// Text remains Unicode and untruncated; independent strokes cannot mutate history.
export function createReceiptTextDocument(title: string, blocks: A4Block[]): ReceiptTextDocument {
  const entries: ReceiptTextEntry[] = [];
  blocks.forEach((block, blockIndex) => {
    const key = `block-${blockIndex}`;
    if (block.kind === 'text') {
      entries.push({ id: key, kind: 'text', text: block.text, heading: Boolean(block.heading) });
    } else if (block.kind === 'table') {
      block.rows.forEach((row, rowIndex) => entries.push({
        id: `${key}-equipment-${rowIndex}`, kind: 'equipment', title: row[0]?.split('\n')[0] || `Equipment ${rowIndex + 1}`,
        fields: block.headers.map((label, column) => ({ label, value: row[column] || '-' })),
      }));
    } else {
      block.entries.forEach((entry, entryIndex) => entries.push({
        id: `${key}-signature-${entryIndex}`, kind: 'signature', label: entry.label, person: entry.person || '-', note: entry.note || '',
        signature: entry.signature.map(stroke => stroke.map(point => ({ x: point.x, y: point.y }))),
      }));
    }
  });
  return { title, entries };
}

export function receiptTextViewportHeight(screenHeight: number): number {
  const height = Number.isFinite(screenHeight) && screenHeight > 0 ? screenHeight : 667;
  return Math.max(1, Math.max(receiptPreviewLayout.minHeight, Math.min(receiptPreviewLayout.maxHeight, height * receiptPreviewLayout.heightFraction)));
}
