import { validateDatabase, mergeDatabase, canonical } from '../services/backupValidation.ts';
import type { TrackerData } from '../services/tracker.ts';
const at = '2026-11-15T10:00:00.000Z';
function archivedFixture(): TrackerData { return { version: 1, assets: [{ id: 'asset', name: 'Radio', serial: '001', notes: 'Retained archive', createdAt: at, updatedAt: at, archivedAt: at }], withdrawals: [{ id: 'legacy-withdrawal', assetId: 'asset', releaser: 'John', receiver: 'Jane', signature: [[{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }]], withdrawalAt: '2026-11-10T10:00:00.000Z', dueAt: '2026-11-11T10:00:00.000Z', createdAt: '2026-11-10T10:00:00.000Z', returnedAt: '2026-11-12T10:00:00.000Z', returning: 'Jane', receiving: 'John', condition: 'Good', notes: 'Original', deletedAt: at }], activities: [{ id: 'audit', assetId: 'asset', transactionId: 'legacy-withdrawal', type: 'archive', person: 'Authorized operator', at, description: 'Original archive audit' }], notices: [], settings: { theme: 'light', notificationVolume: 73, alarmVolume: 45, enabled: true, warningHours: 24, role: 'operator' } }; }
Deno.test('legacy archived inventory, complete returns and audit history survive a portable database round trip', () => {
  const data = archivedFixture(); const restored = validateDatabase(JSON.parse(JSON.stringify(data)));
  if (canonical(restored.assets) !== canonical(data.assets) || canonical(restored.withdrawals) !== canonical(data.withdrawals) || canonical(restored.activities) !== canonical(data.activities)) throw new Error('Archive/legacy history changed');
  if (restored.settings.theme !== 'light' || restored.settings.notificationVolume !== 73) throw new Error('Settings were not retained');
  const merged = mergeDatabase(restored, restored);
  if (merged.withdrawals.length !== 1 || merged.activities.length !== 1) throw new Error('Merge duplicated historical transactions');
});
