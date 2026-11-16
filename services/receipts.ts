import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { Asset, Withdrawal, TrackerData } from './tracker';
import type { ReceiptPreviewDocument } from './receiptPreview';
import type { ReceiptTextDocument } from './receiptText';
import { createTransactionReceipt } from './transactionReceipts';

export type ReceiptKind = 'withdrawal' | 'return';
export interface ReceiptFile { filename: string; bytes: Uint8Array; base64: string; preview?: ReceiptPreviewDocument; readable?: ReceiptTextDocument }
export type ReceiptDelivery = 'downloaded' | 'saved' | 'share-sheet' | 'shared' | 'cancelled' | 'download-fallback';

export async function createReceipt(asset: Asset, withdrawal: Withdrawal, kind: ReceiptKind, data?: TrackerData, returnReference?: string): Promise<ReceiptFile> {
  if (withdrawal.assetId !== asset.id) throw new Error('Receipt equipment does not match this transaction.');
  if (data) return createTransactionReceipt(data, withdrawal, kind, returnReference);
  if (kind === 'return' && !withdrawal.returnedAt) throw new Error('A return receipt is available only after equipment has been returned.');
  // Legacy single-record API uses the same one-sheet renderer without writing a migration.
  const localSnapshot: TrackerData = {
    version: 1, assets: [asset], withdrawals: [withdrawal], activities: [], notices: [],
    settings: { theme: 'light', role: 'viewer', enabled: false, warningHours: 24, notificationVolume: 100, alarmVolume: 100 },
  };
  return createTransactionReceipt(localSnapshot, withdrawal, kind);
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
