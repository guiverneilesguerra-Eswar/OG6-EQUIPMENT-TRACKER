import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'pdf-lib';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Asset, Withdrawal, formatDate, manilaParts } from './tracker';
import { palettes } from '@/constants/theme';
import type { Signature, TrackerData } from './tracker';
import { createTransactionReceipt } from './transactionReceipts';
import { getReturnSignatureDetails } from './returnSignatures';

export type ReceiptKind = 'withdrawal' | 'return';
export interface ReceiptFile { filename: string; bytes: Uint8Array; base64: string }
export type ReceiptDelivery = 'downloaded' | 'saved' | 'share-sheet' | 'shared' | 'cancelled' | 'download-fallback';

const pdfColor = (hex: string) => rgb(parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255);

export async function createReceipt(asset: Asset, withdrawal: Withdrawal, kind: ReceiptKind, data?: TrackerData, returnReference?: string): Promise<ReceiptFile> {
  if (withdrawal.assetId !== asset.id) throw new Error('Receipt equipment does not match this transaction.');
  if (data) return createTransactionReceipt(data, withdrawal, kind, returnReference);
  if (kind === 'return' && !withdrawal.returnedAt) throw new Error('A return receipt is available only after equipment has been returned.');
  const doc = await PDFDocument.create();
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const generated = new Date().toISOString();
  const c = palettes.light;
  const ink = pdfColor(c.text), blue = pdfColor(c.primary), subtle = pdfColor(c.subtle), lineColor = pdfColor(c.border);
  const title = kind === 'return' ? 'EQUIPMENT RETURN RECEIPT' : 'EQUIPMENT WITHDRAWAL RECEIPT';
  doc.setTitle(`${title} - ${withdrawal.id}`); doc.setAuthor('OG6 EQUIPMENT TRACKER'); doc.setCreator('OG6 EQUIPMENT TRACKER'); doc.setCreationDate(new Date(generated));
  let page!: PDFPage; let y = 0;
  // Standard PDF fonts support Latin names. Unsupported glyphs are transliterated,
  // rather than causing receipt generation to fail for a pasted symbol.
  const textSafe = (value: string, font: PDFFont = normal) => Array.from(value.replace(/\t/g, ' ').replace(/\r/g, '')).map(char => {
    if (char === '\n') return char;
    try { font.encodeText(char); return char; } catch {
      const plain = char.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
      try { font.encodeText(plain); return plain || '?'; } catch { return '?'; }
    }
  }).join('');
  const addPage = () => {
    page = doc.addPage([595.28, 841.89]); y = 790;
    page.drawText('OG6 EQUIPMENT TRACKER', { x: 44, y, size: 18, font: bold, color: ink }); y -= 26;
    page.drawText(title, { x: 44, y, size: 12, font: bold, color: blue }); y -= 19;
    page.drawText(textSafe(`Reference: ${withdrawal.id}`), { x: 44, y, size: 10, font: normal, color: subtle }); y -= 16;
    page.drawText(textSafe(`Generated: ${formatDate(generated)} (Asia/Manila)`), { x: 44, y, size: 9, font: normal, color: subtle }); y -= 16;
    page.drawLine({ start: { x: 44, y }, end: { x: 551, y }, thickness: 1, color: blue }); y -= 24;
  };
  const ensureSpace = (height: number) => { if (y - height < 65) addPage(); };
  const wrap = (value: string, font: PDFFont, size: number, width: number): string[] => {
    const result: string[] = [];
    for (const paragraph of textSafe(value, font).split('\n')) {
      let current = '';
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        const proposed = current ? `${current} ${word}` : word;
        if (font.widthOfTextAtSize(proposed, size) <= width) { current = proposed; continue; }
        if (current) { result.push(current); current = ''; }
        for (const char of word) {
          if (current && font.widthOfTextAtSize(current + char, size) > width) { result.push(current); current = ''; }
          current += char;
        }
      }
      result.push(current || ' ');
    }
    return result;
  };
  const field = (label: string, value?: string) => {
    ensureSpace(45);
    page.drawText(label.toUpperCase(), { x: 44, y, size: 9, font: bold, color: subtle }); y -= 17;
    for (const row of wrap(value || '-', normal, 11, 507)) {
      ensureSpace(18); page.drawText(row, { x: 44, y, size: 11, font: normal, color: ink }); y -= 16;
    }
    y -= 11;
  };
  addPage();
  field('Transaction status at this event', kind === 'return' ? 'RETURNED / EQUIPMENT IN' : 'WITHDRAWN / EQUIPMENT OUT');
  field('Transaction reference', withdrawal.reference || withdrawal.id);
  field('Equipment name', withdrawal.equipmentSnapshot?.name || asset.name); field('Serial / Product ID', withdrawal.equipmentSnapshot?.serial || asset.serial); field('Asset ID', asset.id);
  field('Quantity withdrawn', String(withdrawal.quantity ?? 1));
  if (kind === 'return') field('Total quantity returned', String(withdrawal.returnedQuantity ?? withdrawal.quantity ?? 1));
  field('Releaser', withdrawal.releaser); field('Original receiver', withdrawal.receiver);
  field('Withdrawal date and time (PHT)', formatDate(withdrawal.withdrawalAt));
  field('Due date and time (PHT)', formatDate(withdrawal.dueAt));
  field('Withdrawal recorded at (PHT)', formatDate(withdrawal.createdAt));
  if (kind === 'return') {
    field('Actual return date and time (PHT)', formatDate(withdrawal.returnedAt!));
    field('Returning personnel', withdrawal.returning); field('Receiving personnel', withdrawal.receiving);
    field('Equipment condition on return', withdrawal.condition);
    if (withdrawal.remarks) field('Return remarks', withdrawal.remarks);
  }
  if (withdrawal.notes) field('Withdrawal notes / purpose', withdrawal.notes);
  const drawSignature = (label: string, person: string, signature: Signature) => {
    ensureSpace(170);
    page.drawText(label, { x: 44, y, size: 9, font: bold, color: subtle }); y -= 15;
    const boxY = y - 106;
    page.drawRectangle({ x: 44, y: boxY, width: 300, height: 106, borderWidth: 0.7, borderColor: lineColor });
    for (const stroke of signature) for (let i = 1; i < stroke.length; i++) {
      const a = stroke[i - 1], b = stroke[i];
      if (![a.x, a.y, b.x, b.y].every(Number.isFinite)) continue;
      const point = (p: { x: number; y: number }) => ({ x: 50 + Math.max(0, Math.min(500, p.x)) * 288 / 500, y: boxY + 6 + (180 - Math.max(0, Math.min(180, p.y))) * 94 / 180 });
      page.drawLine({ start: point(a), end: point(b), thickness: 1.3, color: ink });
    }
    y = boxY - 15;
    for (const row of wrap(person || '-', normal, 10, 507)) { ensureSpace(18); page.drawText(row, { x: 44, y, size: 10, font: normal, color: ink }); y -= 15; }
    y -= 10;
  };
  drawSignature(kind === 'return' ? 'ORIGINAL WITHDRAWAL SIGNATURE' : 'RECEIVER SIGNATURE', withdrawal.receiver, withdrawal.signature || []);
  if (kind === 'return') {
    field('Original signature', 'Captured at withdrawal; separate from the return signature.');
    const details = getReturnSignatureDetails(withdrawal);
    if (details.signature.some(stroke => stroke.length > 2)) drawSignature(details.label.toUpperCase(), details.person, details.signature);
    else field(details.label, details.missing);
  }
  const pages = doc.getPages();
  pages.forEach((p, index) => {
    p.drawLine({ start: { x: 44, y: 48 }, end: { x: 551, y: 48 }, thickness: 0.5, color: lineColor });
    p.drawText('Personnel record - share with authorized recipients only.', { x: 44, y: 33, size: 8, font: normal, color: subtle });
    p.drawText(`${index + 1} / ${pages.length}`, { x: 515, y: 33, size: 8, font: normal, color: subtle });
  });
  const bytes = await doc.save(); const base64 = await doc.saveAsBase64();
  const safeId = withdrawal.id.replace(/[^a-zA-Z0-9_-]/g, '_');
  const date = manilaParts(kind === 'return' ? withdrawal.returnedAt! : withdrawal.withdrawalAt).date;
  return { filename: `OG6_${kind === 'return' ? 'Return' : 'Withdrawal'}_Receipt_${safeId}_${date}.pdf`, bytes, base64 };
}

function receiptBlob(receipt: ReceiptFile) {
  return new Blob([receipt.bytes.buffer.slice(receipt.bytes.byteOffset, receipt.bytes.byteOffset + receipt.bytes.byteLength) as ArrayBuffer], { type: 'application/pdf' });
}
function downloadWeb(receipt: ReceiptFile) {
  const url = URL.createObjectURL(receiptBlob(receipt));
  const link = document.createElement('a'); link.href = url; link.download = receipt.filename;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
async function saveNative(receipt: ReceiptFile, permanent: boolean) {
  const fs = FileSystem as unknown as { File?: new (uri: string) => { create: (options: { overwrite: boolean; intermediates: boolean }) => void; write: (bytes: Uint8Array) => void }; Paths?: { document: string | { uri: string }; cache: string | { uri: string } }; documentDirectory?: string | null; cacheDirectory?: string | null; makeDirectoryAsync?: (uri: string, o: { intermediates: boolean }) => Promise<void>; writeAsStringAsync?: (uri: string, value: string, o: { encoding: 'base64' }) => Promise<void> };
  const path = permanent ? fs.Paths?.document : fs.Paths?.cache;
  const root = typeof path === 'string' ? path : path?.uri || (permanent ? fs.documentDirectory : fs.cacheDirectory);
  if (!root) throw new Error('File storage is unavailable on this device.');
  const folder = `${root.replace(/\/$/, '')}/og6-receipts/`; const uri = `${folder}${receipt.filename}`;
  if (fs.File) { const file = new fs.File(uri); file.create({ overwrite: true, intermediates: true }); file.write(receipt.bytes); }
  else if (fs.writeAsStringAsync && fs.makeDirectoryAsync) { await fs.makeDirectoryAsync(folder, { intermediates: true }); await fs.writeAsStringAsync(uri, receipt.base64, { encoding: 'base64' }); }
  else throw new Error('PDF file storage is not supported in this build.');
  return uri;
}
export async function downloadReceipt(receipt: ReceiptFile): Promise<ReceiptDelivery> {
  if (Platform.OS === 'web') { downloadWeb(receipt); return 'downloaded'; }
  await saveNative(receipt, true); return 'saved';
}
export async function shareReceipt(receipt: ReceiptFile): Promise<ReceiptDelivery> {
  if (Platform.OS === 'web') {
    const browser = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean; share?: (data: { files: File[]; title: string }) => Promise<void> };
    const file = new File([receiptBlob(receipt)], receipt.filename, { type: 'application/pdf' });
    if (browser.share && browser.canShare?.({ files: [file] })) {
      try { await browser.share({ files: [file], title: 'OG6 Equipment Receipt' }); return 'shared'; }
      catch (error) { if (error instanceof Error && error.name === 'AbortError') return 'cancelled'; throw new Error('Unable to share the PDF. Try Download PDF and attach the file manually.'); }
    }
    downloadWeb(receipt); return 'download-fallback';
  }
  if (!await Sharing.isAvailableAsync()) throw new Error('File sharing is unavailable. Save the PDF and send it from your device.');
  const uri = await saveNative(receipt, false);
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Share or send OG6 receipt' });
  return 'share-sheet';
}
