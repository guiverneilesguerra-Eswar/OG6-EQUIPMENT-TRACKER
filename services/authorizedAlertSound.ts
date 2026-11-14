import { Platform, Linking } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';
import { randomUUID } from 'expo-crypto';
import { decode, encode } from 'base64-arraybuffer';
import { AuthorizedAlertSound, alertSoundLimits, alertSoundReference, validateAlertSoundBytes, validateAlertSoundDuration } from './alertSoundValidation';

interface NativeFile { size?: number; bytes: () => Promise<Uint8Array>; create: (options: { overwrite: boolean; intermediates: boolean }) => void; write: (bytes: Uint8Array) => void; delete: () => void }
const fs = FileSystem as unknown as {
  File?: new (uri: string) => NativeFile;
  Paths?: { document: { uri: string } | string };
  documentDirectory?: string | null;
  getInfoAsync?: (uri: string) => Promise<{ exists: boolean; size?: number }>;
  readAsStringAsync?: (uri: string, options: { encoding: 'base64' }) => Promise<string>;
  writeAsStringAsync?: (uri: string, value: string, options: { encoding: 'base64' }) => Promise<void>;
  deleteAsync?: (uri: string, options: { idempotent: boolean }) => Promise<void>;
};
const objectUrls = new Map<string, string>();
function nativeUri(selection: Pick<AuthorizedAlertSound, 'id' | 'extension'>) {
  if (!/^[a-f0-9-]{36}$/i.test(selection.id) || !['mp3', 'wav'].includes(selection.extension)) throw new Error('Saved sound metadata is invalid. Upload the authorized file again.');
  const path = fs.Paths?.document;
  const directory = typeof path === 'string' ? path : path?.uri || fs.documentDirectory;
  if (!directory) throw new Error('Persistent audio storage is unavailable in this build. Update the app.');
  return `${directory.replace(/\/$/, '')}/og6-authorized-alert-${selection.id}.${selection.extension}`;
}
function openAudioDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('This browser cannot save audio locally. Use a supported browser with storage enabled.')); return; }
    let rejected = false;
    const request = indexedDB.open('og6.authorizedAlertAudio.v1', 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('clips')) request.result.createObjectStore('clips'); };
    request.onerror = () => { rejected = true; reject(new Error('Browser audio storage is unavailable. Check storage permissions and free space.')); };
    request.onblocked = () => { rejected = true; reject(new Error('Close older app tabs and retry the audio upload.')); };
    request.onsuccess = () => { if (rejected) request.result.close(); else resolve(request.result); };
  });
}
async function browserClip(id: string, operation: 'get' | 'put' | 'delete', blob?: Blob): Promise<Blob | undefined> {
  const database = await openAudioDatabase();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('clips', operation === 'get' ? 'readonly' : 'readwrite');
    const store = tx.objectStore('clips');
    const request = operation === 'get' ? store.get(id) : operation === 'put' ? store.add(blob, id) : store.delete(id);
    let result: Blob | undefined;
    request.onsuccess = () => { if (operation === 'get' && request.result instanceof Blob) result = request.result; };
    tx.oncomplete = () => { database.close(); resolve(result); };
    tx.onerror = tx.onabort = () => { database.close(); reject(new Error('Unable to save/read local audio. Check browser storage and free space; the prior selection is unchanged.')); };
  });
}
function checkSize(size: number | undefined) { if (typeof size === 'number' && size > alertSoundLimits.maxBytes) throw new Error('Maximum audio upload size is 10 MB.'); }
async function readSelectedFile(asset: DocumentPicker.DocumentPickerAsset) {
  checkSize(asset.size);
  if (Platform.OS === 'web') {
    if (!asset.file) throw new Error('This browser did not provide a readable file. Select the MP3/WAV again.');
    checkSize(asset.file.size); return new Uint8Array(await asset.file.arrayBuffer());
  }
  if (fs.File) { const file = new fs.File(asset.uri); checkSize(file.size); return file.bytes(); }
  if (fs.readAsStringAsync) {
    if (fs.getInfoAsync) { const info = await fs.getInfoAsync(asset.uri); if (!info.exists) throw new Error('The selected file is no longer available.'); checkSize(info.size); }
    return new Uint8Array(decode(await fs.readAsStringAsync(asset.uri, { encoding: 'base64' })));
  }
  throw new Error('Audio file reading is unavailable in this build. Update the app.');
}
// Bounded local decoder load; a late native result is unloaded after timeout.
export function loadDecodedAlertSound(uri: string, volume = 0): Promise<Awaited<ReturnType<typeof Audio.Sound.createAsync>>> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => { settled = true; reject(new Error('Audio decoding timed out. Choose a supported MP3 or PCM WAV and retry.')); }, 30000);
    void Audio.Sound.createAsync({ uri }, { shouldPlay: false, volume, progressUpdateIntervalMillis: 150 }).then(result => {
      if (settled) { void result.sound.unloadAsync().catch(() => {}); return; }
      settled = true; clearTimeout(timer); resolve(result);
    }, () => {
      if (settled) return;
      settled = true; clearTimeout(timer); reject(new Error('The file cannot be decoded as supported MP3/WAV audio. The previous sound selection is unchanged.'));
    });
  });
}
export async function selectAuthorizedAlertSound(): Promise<AuthorizedAlertSound | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave', 'application/octet-stream'], multiple: false, copyToCacheDirectory: true });
  if (result.canceled) return null;
  const asset = result.assets?.[0];
  if (!asset || !/\.(mp3|wav)$/i.test(asset.name)) throw new Error('Only authorized MP3/WAV audio files are accepted.');
  const bytes = await readSelectedFile(asset); const format = validateAlertSoundBytes(asset.name, bytes);
  const selection: AuthorizedAlertSound = { id: randomUUID(), filename: asset.name.slice(0, 180), ...format,
    sizeBytes: bytes.length, durationMillis: 0, uploadedAt: new Date().toISOString(), authorized: true };
  let uri = ''; let probe: Audio.Sound | null = null; let storedNative = false;
  try {
    if (Platform.OS === 'web') {
      const copy = new Uint8Array(bytes.length); copy.set(bytes);
      uri = URL.createObjectURL(new Blob([copy.buffer], { type: format.mimeType }));
    } else {
      uri = nativeUri(selection);
      if (fs.File) { const file = new fs.File(uri); file.create({ overwrite: false, intermediates: true }); file.write(bytes); }
      else if (fs.writeAsStringAsync) { const copy = new Uint8Array(bytes.length); copy.set(bytes); await fs.writeAsStringAsync(uri, encode(copy.buffer), { encoding: 'base64' }); }
      else throw new Error('Persistent audio saving is unavailable. Update the app.');
      storedNative = true;
    }
    // Decode without playing; reject unsupported/empty/overlong audio before changing preferences.
    const loaded = await loadDecodedAlertSound(uri); probe = loaded.sound;
    selection.durationMillis = validateAlertSoundDuration(loaded.status.isLoaded ? loaded.status.durationMillis : undefined);
    if (Platform.OS === 'web') {
      const copy = new Uint8Array(bytes.length); copy.set(bytes);
      await browserClip(selection.id, 'put', new Blob([copy.buffer], { type: format.mimeType }));
    }
    return selection;
  } catch (error) {
    if (storedNative) await discardUncommittedAlertSound(selection).catch(() => {});
    throw new Error(error instanceof Error ? error.message : 'The audio file could not be decoded. Choose a supported MP3 or PCM WAV.');
  } finally {
    if (probe) { try { await probe.unloadAsync(); } catch {} }
    if (Platform.OS === 'web' && uri) URL.revokeObjectURL(uri);
  }
}
export async function resolveAuthorizedAlertSound(selection: AuthorizedAlertSound): Promise<string> {
  if (selection.authorized !== true) throw new Error('Upload an authorized sound file before enabling playback.');
  validateAlertSoundDuration(selection.durationMillis);
  if (Platform.OS !== 'web') {
    const uri = nativeUri(selection);
    if (fs.getInfoAsync && !fs.File) { const info = await fs.getInfoAsync(uri); if (!info.exists) throw new Error('Saved audio is missing. Upload the same authorized MP3/WAV again.'); }
    return uri;
  }
  const existing = objectUrls.get(selection.id); if (existing) return existing;
  const blob = await browserClip(selection.id, 'get');
  if (!blob) throw new Error('Saved browser audio is missing. Upload the same authorized MP3/WAV again.');
  const url = URL.createObjectURL(blob); objectUrls.set(selection.id, url); return url;
}
export function releaseAuthorizedAlertSound(id: string) {
  const url = objectUrls.get(id);
  if (url && Platform.OS === 'web') { URL.revokeObjectURL(url); objectUrls.delete(id); }
}
// Only newly staged, uncommitted uploads are discarded. Removal clears one selection;
// committed files are retained so migration/shared legacy references remain safe.
export async function discardUncommittedAlertSound(selection: AuthorizedAlertSound) {
  releaseAuthorizedAlertSound(selection.id);
  if (Platform.OS === 'web') { await browserClip(selection.id, 'delete'); return; }
  const uri = nativeUri(selection);
  if (fs.File) new fs.File(uri).delete(); else if (fs.deleteAsync) await fs.deleteAsync(uri, { idempotent: true });
}
export async function openAlertSoundReference() { await Linking.openURL(alertSoundReference); }
