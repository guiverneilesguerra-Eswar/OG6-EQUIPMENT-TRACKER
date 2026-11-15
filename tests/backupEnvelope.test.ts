import { createBackupEnvelope, readBackupEnvelope, verifyBackupChecksum } from '../services/backupEnvelope.ts';
function rejects(fn: () => unknown) { let failed = false; try { fn(); } catch { failed = true; } if (!failed) throw new Error('Expected invalid backup rejection'); }
async function sha256(value: string) { const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))); return Array.from(bytes, n => n.toString(16).padStart(2, '0')).join(''); }
Deno.test('portable JSON envelope retains original IDs/timestamps and verifies a real SHA-256 digest', async () => {
  const payload = JSON.stringify({ data: { withdrawals: [{ id: 'original-id', createdAt: '2020-01-01T00:00:00.000Z' }] }, audio: [] });
  const encoded = createBackupEnvelope(payload, '2026-11-15T10:00:00.000Z', await sha256(payload)); const parsed = readBackupEnvelope(encoded);
  verifyBackupChecksum(parsed, await sha256(parsed.payload));
  if (parsed.payload !== payload || JSON.parse(parsed.payload).data.withdrawals[0].id !== 'original-id') throw new Error('Backup changed original transaction data');
  const changed = parsed.payload.replace('original-id', 'modified-id'); rejects(() => verifyBackupChecksum(parsed, '0'.repeat(64))); const checksum = await sha256(changed); rejects(() => verifyBackupChecksum(parsed, checksum));
});
Deno.test('corrupt, foreign, unsupported and incomplete backups fail before data restoration', () => {
  rejects(() => readBackupEnvelope('{')); rejects(() => readBackupEnvelope('{}'));
  rejects(() => readBackupEnvelope(JSON.stringify({ format: 'OG6-COMPLETE-BACKUP', version: 99, exportedAt: '2026-11-15T10:00:00Z', payload: '{}', checksum: 'a'.repeat(64) })));
  rejects(() => createBackupEnvelope('{}', 'invalid date', 'a'.repeat(64)));
});
