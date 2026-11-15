import { encodeToBase64 } from 'pdf-lib';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Asset, Withdrawal, formatDate, manilaParts } from './tracker';
import { buildReceiptPdf } from './receiptPdf';
import type { ReceiptKind } from './receiptPdf';
export type { ReceiptKind } from './receiptPdf';

export interface ReceiptFile { filename: string; bytes: Uint8Array; base64: string }
export type ReceiptDelivery = 'downloaded' | 'saved' | 'share-sheet' | 'shared' | 'cancelled' | 'download-fallback';

export async function createReceipt(asset: Asset, withdrawal: Withdrawal, kind: ReceiptKind): Promise<ReceiptFile> {
  const bytes = await buildReceiptPdf({ asset, withdrawal, kind, generatedAt: new Date().toISOString(), formatDate });
  const safeId = withdrawal.id.replace(/[^a-zA-Z0-9_-]/g, '_');
  const date = manilaParts(kind === 'return' ? withdrawal.returnedAt! : withdrawal.withdrawalAt).date;
  return { filename: `OG6_${kind === 'return' ? 'Return' : 'Withdrawal'}_Receipt_${safeId}_${date}.pdf`, bytes, base64: encodeToBase64(bytes) };
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
  const root = permanent ? FileSystem.documentDirectory : FileSystem.cacheDirectory;
  if (!root) throw new Error('File storage is unavailable on this device.');
  const folder = `${root}og6-receipts/`;
  await FileSystem.makeDirectoryAsync(folder, { intermediates: true });
  const uri = `${folder}${receipt.filename}`;
  await FileSystem.writeAsStringAsync(uri, receipt.base64, { encoding: FileSystem.EncodingType.Base64 });
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
