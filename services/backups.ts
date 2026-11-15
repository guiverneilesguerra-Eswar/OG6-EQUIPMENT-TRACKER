import { CryptoDigestAlgorithm, digestStringAsync } from 'expo-crypto';
import { decode, encode } from 'base64-arraybuffer';
import type { TrackerData } from './tracker';
import type { AuthorizedAlertSound } from './alertSoundValidation';
import { validateAlertSoundBytes } from './alertSoundValidation';
import { validateDatabase, backupSummary } from './backupValidation';
import { resolveAuthorizedAlertSound, stageRestoredAlertSound, discardUncommittedAlertSound } from './authorizedAlertSound';
import { backupFileLimit, readLocalBytes, deliverFile } from './portableFiles';
import { createBackupEnvelope, readBackupEnvelope, verifyBackupChecksum } from './backupEnvelope';
export interface BackupPackage { data: TrackerData; audio: { id: string; base64: string }[] }
export interface BackupPreview { filename: string; checksum: string; exportedAt: string; payload: BackupPackage; summary: string }
const hash = (value: string) => digestStringAsync(CryptoDigestAlgorithm.SHA256, value);
function sounds(d: TrackerData) { const map = new Map<string, AuthorizedAlertSound>(); for (const s of [d.settings.notificationSound, d.settings.alarmSound, d.settings.alertSound]) if (s) map.set(s.id, s); return [...map.values()]; }
export async function exportBackup(data: TrackerData) {
  const validated = validateDatabase(data); const audio: BackupPackage['audio'] = [];
  for (const sound of sounds(validated)) {
    const bytes = await readLocalBytes(await resolveAuthorizedAlertSound(sound), 10485760);
    validateAlertSoundBytes(sound.filename, bytes);
    if (bytes.length !== sound.sizeBytes) throw new Error('Selected audio has changed. Re-upload it before exporting a complete backup.');
    const copy = new Uint8Array(bytes); audio.push({ id: sound.id, base64: encode(copy.buffer) });
  }
  const payload = JSON.stringify({ data: validated, audio }); const at = new Date().toISOString();
  const envelope = createBackupEnvelope(payload, at, await hash(payload));
  const bytes = new TextEncoder().encode(envelope);
  if (bytes.length > backupFileLimit) throw new Error('Complete backup exceeds 64 MB. No partial backup was generated.');
  return deliverFile(bytes, `OG6_Complete_Backup_${at.replace(/[:.]/g, '-')}.json`, 'application/json');
}
export async function inspectBackup(filename: string, source: string): Promise<BackupPreview> {
  if (new TextEncoder().encode(source).length > backupFileLimit) throw new Error('Backup exceeds 64 MB.');
  const envelope = readBackupEnvelope(source);
  verifyBackupChecksum(envelope, await hash(envelope.payload));
  let parsed; try { parsed = JSON.parse(envelope.payload); } catch { throw new Error('Backup payload is invalid.'); }
  const data = validateDatabase(parsed?.data);
  if (!Array.isArray(parsed?.audio)) throw new Error('Backup audio manifest is missing.');
  const expected = sounds(data); const seen = new Set<string>(); const audio: BackupPackage['audio'] = [];
  for (const file of parsed.audio) {
    const metadata = expected.find(s => s.id === file?.id);
    if (!metadata || seen.has(file.id) || typeof file.base64 !== 'string' || file.base64.length > 14000000 || (file.base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(file.base64))) throw new Error('Backup contains invalid or duplicate audio.');
    const bytes = new Uint8Array(decode(file.base64)); const format = validateAlertSoundBytes(metadata.filename, bytes);
    if (bytes.length !== metadata.sizeBytes || format.extension !== metadata.extension || format.mimeType !== metadata.mimeType) throw new Error('Audio file does not match the saved metadata.');
    seen.add(file.id); audio.push({ id: file.id, base64: file.base64 });
  }
  if (expected.some(s => !seen.has(s.id))) throw new Error('Selected audio files are missing from this backup.');
  return { filename, checksum: envelope.checksum, exportedAt: envelope.exportedAt, payload: { data, audio }, summary: backupSummary(data) };
}
export async function stageBackupAudio(payload: BackupPackage) {
  const staged: AuthorizedAlertSound[] = [];
  try {
    const mapped = new Map<string, AuthorizedAlertSound>();
    for (const sound of sounds(payload.data)) {
      const file = payload.audio.find(f => f.id === sound.id); if (!file) throw new Error('Backup audio is missing.');
      const selected = await stageRestoredAlertSound(sound, new Uint8Array(decode(file.base64))); staged.push(selected); mapped.set(sound.id, selected);
    }
    const s = payload.data.settings;
    return { data: { ...payload.data, settings: { ...s, notificationSound: s.notificationSound ? mapped.get(s.notificationSound.id) : s.notificationSound, alarmSound: s.alarmSound ? mapped.get(s.alarmSound.id) : s.alarmSound, alertSound: s.alertSound ? mapped.get(s.alertSound.id) : undefined } }, staged };
  } catch (e) { await Promise.all(staged.map(s => discardUncommittedAlertSound(s).catch(() => {}))); throw e; }
}
