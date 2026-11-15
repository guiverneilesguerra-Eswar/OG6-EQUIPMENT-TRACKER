import { PDFDocument, PDFFont, StandardFonts, rgb } from 'pdf-lib';
import type { Asset, Signature, Withdrawal } from './tracker';
import { receiptLayout as layout } from '../constants/receipt';

export type ReceiptKind = 'withdrawal' | 'return';
export interface ReceiptPdfInput {
  asset: Asset; withdrawal: Withdrawal; kind: ReceiptKind; generatedAt: string;
  formatDate: (value: string) => string;
}

// Until a licensed Arial font asset is supplied, retain the existing Helvetica
// font honestly. This is not an Arial alias or a claim of embedded Arial.
export async function buildReceiptPdf({ asset, withdrawal: w, kind, generatedAt, formatDate }: ReceiptPdfInput): Promise<Uint8Array> {
  if (w.assetId !== asset.id) throw new Error('Receipt equipment does not match this transaction.');
  if (kind === 'return' && !w.returnedAt) throw new Error('A return receipt is available only after equipment has been returned.');
  const doc = await PDFDocument.create();
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([layout.width, layout.height]);
  const size = layout.fontSize; const ink = rgb(0, 0, 0); const line = rgb(0.55, 0.55, 0.55);
  const usableWidth = layout.width - layout.margin * 2;
  let shortened = false;
  const safe = (value: string, font: PDFFont) => Array.from(value.replace(/\t/g, ' ').replace(/\r/g, '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')).map(char => {
    if (char === '\n') return char;
    try { font.encodeText(char); return char; } catch {
      const plain = char.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
      try { font.encodeText(plain); return plain || '?'; } catch { return '?'; }
    }
  }).join('');
  const fit = (value: string, font: PDFFont, width: number) => {
    const cleaned = safe(value, font).replace(/\s+/g, ' ');
    if (font.widthOfTextAtSize(cleaned, size) <= width) return cleaned;
    shortened = true;
    let low = 0; let high = cleaned.length;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (font.widthOfTextAtSize(`${cleaned.slice(0, middle)}...`, size) <= width) low = middle;
      else high = middle - 1;
    }
    return `${cleaned.slice(0, low)}...`;
  };
  const wrap = (value: string, width: number, maxLines: number) => {
    const text = safe(value, normal);
    const all: string[] = [];
    for (const paragraph of text.split('\n')) {
      let current = '';
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        const proposed = current ? `${current} ${word}` : word;
        if (normal.widthOfTextAtSize(proposed, size) <= width) { current = proposed; continue; }
        if (current) { all.push(current); current = ''; }
        for (const char of word) {
          if (current && normal.widthOfTextAtSize(current + char, size) > width) { all.push(current); current = ''; }
          current += char;
        }
      }
      all.push(current || '-');
    }
    if (all.length <= maxLines) return all;
    shortened = true;
    const rows = all.slice(0, maxLines);
    let last = rows[maxLines - 1];
    while (last && normal.widthOfTextAtSize(`${last}...`, size) > width) last = last.slice(0, -1);
    rows[maxLines - 1] = `${last}...`;
    return rows;
  };
  const draw = (value: string, x: number, y: number, font = normal) => page.drawText(value, { x, y, size, font, color: ink });
  const title = kind === 'return' ? 'EQUIPMENT RETURN RECEIPT' : 'EQUIPMENT WITHDRAWAL RECEIPT';
  doc.setTitle(`${title} - ${w.id}`); doc.setAuthor('OG6 EQUIPMENT TRACKER'); doc.setCreator('OG6 EQUIPMENT TRACKER');
  doc.setCreationDate(new Date(generatedAt));
  draw('OG6 EQUIPMENT TRACKER', layout.margin, 800, bold);
  draw(title, layout.margin, 780, bold);
  draw(fit(`Reference: ${w.id}`, normal, usableWidth), layout.margin, 760);
  draw(fit(`Generated: ${formatDate(generatedAt)} (Asia/Manila)`, normal, usableWidth), layout.margin, 740);
  page.drawLine({ start: { x: layout.margin, y: 726 }, end: { x: layout.width - layout.margin, y: 726 }, thickness: 0.8, color: ink });
  let y = 706;
  const field = (label: string, value: string | undefined, maxLines = 1) => {
    const rows = wrap(value || '-', usableWidth - layout.labelWidth, maxLines);
    const nextY = y - rows.length * layout.lineHeight - layout.fieldGap;
    // Fixed field budgets reserve signature and footer space. Never add a page,
    // shrink the font, or silently render below the signature section.
    if (nextY < layout.signatureTop + 28) throw new Error('Receipt content cannot fit on one A4 page at 12 points.');
    draw(fit(label, bold, layout.labelWidth - 8), layout.margin, y, bold);
    rows.forEach((row, index) => draw(row, layout.margin + layout.labelWidth, y - index * layout.lineHeight));
    y = nextY;
  };
  field('Event status', kind === 'return' ? 'RETURNED / EQUIPMENT IN' : 'WITHDRAWN / EQUIPMENT OUT');
  field('Equipment', asset.name, 2); field('Serial / Product ID', asset.serial, 2); field('Asset ID', asset.id);
  field('Releaser', w.releaser); field('Original receiver', w.receiver);
  field('Withdrawn (PHT)', formatDate(w.withdrawalAt)); field('Due (PHT)', formatDate(w.dueAt));
  field('Recorded (PHT)', formatDate(w.createdAt));
  if (kind === 'return') {
    field('Returned (PHT)', formatDate(w.returnedAt!)); field('Returning personnel', w.returning); field('Receiving personnel', w.receiving);
    field('Return condition', w.condition, 2); field('Return remarks', w.remarks, 3);
  }
  field('Withdrawal notes', w.notes, 3);
  const boxWidth = (usableWidth - layout.signatureGap) / 2;
  const boxY = layout.signatureTop - layout.signatureHeight;
  const signatureBox = (label: string, person: string, signature: Signature | undefined, x: number, capturedAt?: string) => {
    draw(fit(label, bold, boxWidth), x, layout.signatureTop + 12, bold);
    page.drawRectangle({ x, y: boxY, width: boxWidth, height: layout.signatureHeight, borderWidth: 0.7, borderColor: line });
    let hasInk = false;
    for (const stroke of signature || []) {
      for (let index = 1; index < stroke.length; index++) {
        const a = stroke[index - 1]; const b = stroke[index];
        if (![a.x, a.y, b.x, b.y].every(Number.isFinite)) continue;
        const point = (p: { x: number; y: number }) => ({ x: x + 6 + Math.max(0, Math.min(500, p.x)) * (boxWidth - 12) / 500, y: boxY + 6 + (180 - Math.max(0, Math.min(180, p.y))) * (layout.signatureHeight - 12) / 180 });
        page.drawLine({ start: point(a), end: point(b), thickness: 1.2, color: ink }); hasInk = true;
      }
    }
    if (!hasInk) draw('Not captured (legacy record)', x + 8, boxY + 38);
    draw(fit(person || '-', normal, boxWidth), x, boxY - 18);
    if (capturedAt) draw(fit(formatDate(capturedAt), normal, boxWidth), x, boxY - 36);
  };
  signatureBox(kind === 'return' ? 'Withdrawal signature' : 'Receiver signature', w.receiver, w.signature, layout.margin);
  if (kind === 'return') {
    signatureBox('Receiver signature on return', w.receiving || '', w.receivingSignature, layout.margin + boxWidth + layout.signatureGap, w.receivingSignatureAt);
    draw('Withdrawal signature is original; return signature is separate.', layout.margin, 92);
  }
  if (shortened) draw('Long fields shortened (...); full details remain in the app.', layout.margin, 70);
  page.drawLine({ start: { x: layout.margin, y: 58 }, end: { x: layout.width - layout.margin, y: 58 }, thickness: 0.5, color: line });
  draw('Personnel record - authorized recipients only.', layout.margin, layout.footerY);
  draw('1 / 1', layout.width - layout.margin - 26, layout.footerY);
  return doc.save();
}
