import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { decode, encode } from 'base64-arraybuffer';
interface NativeFile { uri: string; size?: number; bytes: () => Promise<Uint8Array>; create: (o: { overwrite: boolean; intermediates: boolean }) => void; write: (b: Uint8Array) => void }
const fs = FileSystem as unknown as { File?: new (uri: string) => NativeFile; Paths?: { cache: string | { uri: string } }; cacheDirectory?: string | null; getInfoAsync?: (uri: string) => Promise<{ exists: boolean; size?: number }>; readAsStringAsync?: (uri: string, o: { encoding: 'base64' }) => Promise<string>; writeAsStringAsync?: (uri: string, b: string, o: { encoding: 'base64' }) => Promise<void> };
export const backupFileLimit = 64 * 1024 * 1024;
export async function readLocalBytes(uri: string, limit = backupFileLimit): Promise<Uint8Array> {
  let bytes: Uint8Array;
  if (Platform.OS === 'web') { const r = await fetch(uri); if (!r.ok) throw new Error('Unable to read selected file.'); const blob = await r.blob(); if (blob.size > limit) throw new Error('File exceeds the supported size limit.'); bytes = new Uint8Array(await blob.arrayBuffer()); }
  else if (fs.File) { const f = new fs.File(uri); if ((f.size || 0) > limit) throw new Error('File exceeds the supported size limit.'); bytes = await f.bytes(); }
  else if (fs.readAsStringAsync) { if (fs.getInfoAsync) { const info = await fs.getInfoAsync(uri); if (!info.exists || (info.size || 0) > limit) throw new Error('File is missing or too large.'); } bytes = new Uint8Array(decode(await fs.readAsStringAsync(uri, { encoding: 'base64' }))); }
  else throw new Error('File access is unavailable in this build.');
  if (!bytes.length || bytes.length > limit) throw new Error('File is empty or exceeds the supported size limit.'); return bytes;
}
export async function pickBackupText() {
  const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', 'application/octet-stream'], multiple: false, copyToCacheDirectory: true });
  if (result.canceled) return null; const a = result.assets?.[0];
  if (!a || !/\.json$/i.test(a.name) || (a.size || 0) > backupFileLimit) throw new Error('Choose an OG6 JSON backup no larger than 64 MB.');
  let bytes: Uint8Array;
  if (Platform.OS === 'web' && a.file) { if (a.file.size > backupFileLimit) throw new Error('Backup is too large.'); bytes = new Uint8Array(await a.file.arrayBuffer()); }
  else bytes = await readLocalBytes(a.uri);
  if (bytes.length > backupFileLimit) throw new Error('Backup is too large.');
  return { filename: a.name, text: new TextDecoder().decode(bytes) };
}
export async function deliverFile(bytes: Uint8Array, filename: string, mime: string) {
  if (Platform.OS === 'web') {
    if (typeof document === 'undefined') throw new Error('Download is not available yet.');
    const copy = new Uint8Array(bytes); const url = URL.createObjectURL(new Blob([copy.buffer], { type: mime })); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a);
    try { a.click(); } finally { a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000); }
    return `Download requested: ${filename}`;
  }
  if (!await Sharing.isAvailableAsync()) throw new Error('File sharing is unavailable on this device.');
  const cache = fs.Paths?.cache; const folder = typeof cache === 'string' ? cache : cache?.uri || fs.cacheDirectory;
  if (!folder) throw new Error('File cache is unavailable.'); const uri = `${folder.replace(/\/$/, '')}/${filename}`;
  if (fs.File) { const f = new fs.File(uri); f.create({ overwrite: true, intermediates: true }); f.write(bytes); }
  else if (fs.writeAsStringAsync) { const copy = new Uint8Array(bytes); await fs.writeAsStringAsync(uri, encode(copy.buffer), { encoding: 'base64' }); }
  else throw new Error('File saving is not supported.');
  await Sharing.shareAsync(uri, { mimeType: mime, dialogTitle: filename }); return `Share sheet opened: ${filename}`;
}
