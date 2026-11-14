import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { decode, encode } from 'base64-arraybuffer';
import { inventoryImportLimits } from './inventoryImportValidation';

const xlsxMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
interface NativeFile { uri: string; size?: number; bytes: () => Promise<Uint8Array>; create: (options: { overwrite: boolean; intermediates: boolean }) => void; write: (bytes: Uint8Array) => void }
// Support both installed Expo filesystem generations without importing /legacy.
const fs = FileSystem as unknown as { File?: new (uri: string) => NativeFile; Paths?: { cache: { uri: string } | string }; cacheDirectory?: string | null; getInfoAsync?: (uri: string) => Promise<{ exists: boolean; size?: number }>; readAsStringAsync?: (uri: string, options: { encoding: 'base64' }) => Promise<string>; writeAsStringAsync?: (uri: string, value: string, options: { encoding: 'base64' }) => Promise<void> };
export async function selectInventorySpreadsheet() {
  const result = await DocumentPicker.getDocumentAsync({ type: [xlsxMime, 'application/octet-stream', 'application/zip'], copyToCacheDirectory: true, multiple: false });
  if (result.canceled) return null;
  const asset = result.assets?.[0];
  if (!asset || !/\.xlsx$/i.test(asset.name)) throw new Error('Only .xlsx files are accepted. Download and use the official inventory template.');
  if (typeof asset.size === 'number' && asset.size > inventoryImportLimits.fileBytes) throw new Error('The Excel file is too large. Maximum file size is 5 MB.');
  return asset;
}
export async function readInventorySpreadsheet(asset: DocumentPicker.DocumentPickerAsset): Promise<Uint8Array> {
  let bytes: Uint8Array;
  if (Platform.OS === 'web') {
    if (asset.file) {
      if (asset.file.size > inventoryImportLimits.fileBytes) throw new Error('The Excel file exceeds the 5 MB import limit.');
      bytes = new Uint8Array(await asset.file.arrayBuffer());
    }
    else { const response = await fetch(asset.uri); if (!response.ok) throw new Error('Unable to read the selected Excel file.'); bytes = new Uint8Array(await response.arrayBuffer()); }
  } else if (fs.File) {
    const file = new fs.File(asset.uri);
    if (typeof file.size === 'number' && file.size > inventoryImportLimits.fileBytes) throw new Error('The Excel file exceeds the 5 MB import limit.');
    bytes = await file.bytes();
  } else if (fs.readAsStringAsync) {
    if (fs.getInfoAsync) {
      const info = await fs.getInfoAsync(asset.uri);
      if (!info.exists) throw new Error('The selected file is no longer available. Select it again.');
      if (typeof info.size === 'number' && info.size > inventoryImportLimits.fileBytes) throw new Error('The Excel file exceeds the 5 MB import limit.');
    }
    bytes = new Uint8Array(decode(await fs.readAsStringAsync(asset.uri, { encoding: 'base64' })));
  }
  else throw new Error('File reading is not supported in this build. Update the app and try again.');
  if (!bytes.length || bytes.length > inventoryImportLimits.fileBytes) throw new Error('Choose a non-empty .xlsx file no larger than 5 MB.');
  return bytes;
}
export async function saveSpreadsheet(bytes: Uint8Array, filename: string): Promise<string> {
  if (Platform.OS === 'web') {
    if (typeof document === 'undefined') throw new Error('Download is available after the application has loaded.');
    const copy = new Uint8Array(bytes.length); copy.set(bytes);
    const url = URL.createObjectURL(new Blob([copy.buffer], { type: xlsxMime }));
    const link = document.createElement('a'); link.href = url; link.download = filename; document.body.appendChild(link);
    try { link.click(); } finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000); }
  } else {
    if (!await Sharing.isAvailableAsync()) throw new Error('File sharing is not available on this device.');
    const cache = fs.Paths?.cache;
    const directory = typeof cache === 'string' ? cache : cache?.uri || fs.cacheDirectory;
    if (!directory) throw new Error('The app cache is unavailable. Please try again.');
    const uri = `${directory.replace(/\/$/, '')}/${filename}`;
    if (fs.File) { const file = new fs.File(uri); file.create({ overwrite: true, intermediates: true }); file.write(bytes); }
    else if (fs.writeAsStringAsync) { const copy = new Uint8Array(bytes.length); copy.set(bytes); await fs.writeAsStringAsync(uri, encode(copy.buffer), { encoding: 'base64' }); }
    else throw new Error('File saving is not supported in this build. Update the app and try again.');
    await Sharing.shareAsync(uri, { mimeType: xlsxMime, UTI: 'org.openxmlformats-officedocument.spreadsheetml.sheet', dialogTitle: filename });
  }
  return filename;
}
