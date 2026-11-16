import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { encode } from 'base64-arraybuffer';
import type { ReceiptFile } from './receipts';
import type { PdfSaveLocation } from './pdfFileTypes';
export type { PdfSaveLocation } from './pdfFileTypes';

interface NativeFile {
  create: (options: { overwrite: boolean; intermediates: boolean }) => void;
  write: (bytes: Uint8Array) => void;
}
interface StorageAccessFramework {
  getUriForDirectoryInRoot?: (folder: string) => string;
  requestDirectoryPermissionsAsync: (initialUri?: string) => Promise<{
    granted: boolean;
    directoryUri: string;
  }>;
  createFileAsync: (directoryUri: string, filename: string, mimeType: string) => Promise<string>;
}
// Older Expo SDKs expose asynchronous file APIs at the package root. Newer
// builds may expose File/Paths instead. Do not import a version-specific subpath.
const fs = FileSystem as unknown as {
  File?: new (uri: string) => NativeFile;
  Paths?: { cache?: string | { uri: string } };
  cacheDirectory?: string | null;
  writeAsStringAsync?: (uri: string, contents: string, options: { encoding: 'base64' }) => Promise<void>;
  StorageAccessFramework?: StorageAccessFramework;
};
async function writePdf(uri: string, file: ReceiptFile, create: boolean): Promise<void> {
  if (fs.File) {
    const destination = new fs.File(uri);
    if (create) destination.create({ overwrite: true, intermediates: true });
    destination.write(new Uint8Array(file.bytes));
    return;
  }
  if (fs.writeAsStringAsync) {
    await fs.writeAsStringAsync(uri, encode(new Uint8Array(file.bytes).buffer), { encoding: 'base64' });
    return;
  }
  throw new Error('PDF writing is unavailable in this build.');
}
export async function cachePdf(file: ReceiptFile): Promise<string> {
  const cache = fs.Paths?.cache;
  const root = typeof cache === 'string' ? cache : cache?.uri || fs.cacheDirectory;
  if (!root) throw new Error('PDF cache unavailable.');
  const filename = file.filename.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const uri = `${root.replace(/\/$/, '')}/${filename}`;
  await writePdf(uri, file, true);
  return uri;
}
async function openFilesInterface(file: ReceiptFile): Promise<void> {
  if (!await Sharing.isAvailableAsync()) throw new Error('Native Files/share interface unavailable.');
  await Sharing.shareAsync(await cachePdf(file), {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: 'Save OG6 PDF to Files',
  });
}
export async function savePdf(file: ReceiptFile, location: PdfSaveLocation): Promise<string> {
  if (Platform.OS === 'android') {
    const saf = fs.StorageAccessFramework;
    if (!saf?.requestDirectoryPermissionsAsync || !saf.createFileAsync) {
      await openFilesInterface(file);
      return 'Folder selection is unavailable in this build. Native share/save interface opened; final saving is handled by the selected app and is not confirmed.';
    }
    const initialUri = location === 'downloads' ? saf.getUriForDirectoryInRoot?.('Download') : undefined;
    const permission = await saf.requestDirectoryPermissionsAsync(initialUri);
    if (!permission.granted) return 'Saving cancelled; no destination write confirmed.';
    const uri = await saf.createFileAsync(
      permission.directoryUri,
      file.filename.replace(/\.pdf$/i, ''),
      'application/pdf',
    );
    await writePdf(uri, file, false);
    return 'Android confirmed PDF write to the selected folder. The folder you authorized controls the destination.';
  }
  await openFilesInterface(file);
  return 'iOS Files/share interface opened. Select Save to Files; the OS does not report the final save location or completion to this app.';
}
export async function previewPdf(file: ReceiptFile): Promise<string> {
  await Print.printAsync({ uri: await cachePdf(file) });
  return 'Native PDF/print preview opened. Cancel the print dialog to return without printing.';
}
