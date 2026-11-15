export interface BackupEnvelope { format: 'OG6-COMPLETE-BACKUP'; version: 1; exportedAt: string; checksum: string; payload: string }
export function createBackupEnvelope(payload: string, exportedAt: string, checksum: string): string {
  if (!Number.isFinite(Date.parse(exportedAt)) || !/^[a-f0-9]{64}$/.test(checksum)) throw new Error('Invalid backup integrity metadata.');
  return JSON.stringify({ format: 'OG6-COMPLETE-BACKUP', version: 1, exportedAt, checksum, payload });
}
export function readBackupEnvelope(source: string): BackupEnvelope {
  let e: unknown; try { e = JSON.parse(source); } catch { throw new Error('Backup is not valid JSON.'); }
  const b = e as Partial<BackupEnvelope> | null;
  if (b?.format !== 'OG6-COMPLETE-BACKUP' || b.version !== 1 || typeof b.payload !== 'string' || typeof b.checksum !== 'string' || !/^[a-f0-9]{64}$/.test(b.checksum) || typeof b.exportedAt !== 'string' || !Number.isFinite(Date.parse(b.exportedAt))) throw new Error('This file is not a compatible complete OG6 backup.');
  return b as BackupEnvelope;
}
export function verifyBackupChecksum(envelope: BackupEnvelope, actualChecksum: string) {
  if (envelope.checksum !== actualChecksum) throw new Error('Backup integrity check failed. The file is incomplete or changed.');
}
