import { buildBatch, buildReturns } from '../services/movements.ts';
import { getTransactionReceiptModel } from '../services/withdrawalTransactions.ts';
import { getReturnSignatureBlocks } from '../services/returnSignatures.ts';
import { validateDatabase } from '../services/backupValidation.ts';
import type { TrackerData } from '../services/tracker.ts';
const at = '2026-11-23T08:00:00.000Z';
const ink = (x: number) => [[{ x, y: 20 }, { x: x + 20, y: 40 }, { x: x + 40, y: 60 }]];
function equal(a: unknown, b: unknown) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error('Signature history changed'); }
Deno.test('a subsequent unsigned releaser never inherits prior ink while earlier return history stays intact', () => {
  const base: TrackerData = { version: 1, assets: [{ id: 'lot', name: 'Equipment lot', serial: 'LOT-1', notes: 'Two units', quantity: 2, createdAt: at, updatedAt: at }], withdrawals: [], activities: [], notices: [], settings: { theme: 'dark', enabled: true, role: 'operator', warningHours: 24, notificationVolume: 100, alarmVolume: 100 } };
  let n = 0; const makeId = (prefix: string) => `${prefix}-${++n}`;
  const batch = buildBatch(base, { requestId: 'TX-A', items: [{ assetId: 'lot', quantity: 2 }], releaser: 'Storekeeper', receiver: 'Borrower', signature: ink(10), withdrawalAt: at, dueAt: '2026-11-24T08:00:00.000Z', remarks: '' }, at, makeId).next;
  const first = buildReturns(batch, { requestId: 'RET-A', items: [{ withdrawalId: batch.withdrawals[0].id, quantity: 1 }], returning: 'First releaser', receiving: 'Storekeeper', receivingSignature: ink(20), releasingSignature: ink(70), condition: 'Serviceable', remarks: '' }, '2026-11-23T09:00:00.000Z', makeId);
  const second = buildReturns(first, { requestId: 'RET-B', items: [{ withdrawalId: batch.withdrawals[0].id, quantity: 1 }], returning: 'Second releaser', receiving: 'Other receiver', receivingSignature: ink(100), condition: 'Serviceable', remarks: '' }, '2026-11-23T10:00:00.000Z', makeId);
  equal(second.withdrawals[0].signature, ink(10)); equal(second.withdrawals[0].releasingSignature, undefined);
  const restored = validateDatabase(JSON.parse(JSON.stringify(second)));
  const old = getTransactionReceiptModel(restored, restored.withdrawals[0], 'return', 'RET-A');
  const latest = getTransactionReceiptModel(restored, restored.withdrawals[0], 'return', 'RET-B');
  equal(getReturnSignatureBlocks(old.returns[0]).map(s => [s.person, s.signature]), [['Storekeeper', ink(20)], ['First releaser', ink(70)]]);
  equal(getReturnSignatureBlocks(latest.returns[0]).map(s => [s.person, s.signature]), [['Other receiver', ink(100)]]);
});
