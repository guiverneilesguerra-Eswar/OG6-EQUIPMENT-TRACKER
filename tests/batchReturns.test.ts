import { buildBatch, buildReturns, remainingQuantity } from '../services/movements.ts';
import { validateDatabase, mergeDatabase } from '../services/backupValidation.ts';
import { getTransactionReceiptModel, validateReturnDraft } from '../services/withdrawalTransactions.ts';
import { equipmentConditions, getOutstandingWithdrawals, filterReturnItems, selectedReturnLines } from '../services/returnSelection.ts';
import type { TrackerData } from '../services/tracker.ts';
const at = '2026-11-16T08:00:00.000Z'; const returnedAt = '2026-11-16T09:00:00.000Z';
const signature = [[{ x: 10, y: 20 }, { x: 40, y: 60 }, { x: 70, y: 30 }]];
let count = 0; const makeId = (prefix: string) => `${prefix}-${++count}`;
function equal(a: unknown, b: unknown) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error('Values differ'); }
function rejects(run: () => unknown) { let failed = false; try { run(); } catch { failed = true; } if (!failed) throw new Error('Expected rejection'); }
function fixture(): TrackerData {
  let data: TrackerData = { version: 1, assets: ['a', 'b', 'c'].map(id => ({ id, name: `Equipment ${id}`, serial: `Serial-${id}`, notes: 'Equipment lot', quantity: 4, createdAt: at, updatedAt: at })), withdrawals: [], activities: [], notices: [], settings: { theme: 'dark', enabled: true, role: 'operator', warningHours: 24, notificationVolume: 100, alarmVolume: 100 } };
  data = buildBatch(data, { requestId: 'TX-A', items: [{ assetId: 'a', quantity: 3 }, { assetId: 'c', quantity: 4 }], releaser: 'Officer A', receiver: 'Borrower A', signature, withdrawalAt: at, dueAt: '2026-11-17T08:00:00.000Z', remarks: '' }, at, makeId).next;
  return buildBatch(data, { requestId: 'TX-B', items: [{ assetId: 'b', quantity: 4 }], releaser: 'Officer B', receiver: 'Borrower B', signature, withdrawalAt: at, dueAt: '2026-11-16T08:30:00.000Z', remarks: '' }, at, makeId).next;
}
function form(data: TrackerData) {
  return { requestId: 'RET-BATCH', items: data.withdrawals.filter(w => w.assetId !== 'c').map(w => ({ withdrawalId: w.id, quantity: w.assetId === 'a' ? 1 : 2 })), returning: 'Delivering personnel', receiving: 'Receiving officer', receivingSignature: signature, condition: 'Serviceable', remarks: 'Consolidated check-in' };
}
Deno.test('batch selection includes all outstanding transactions and search does not mutate selection', () => {
  const data = fixture(); const items = getOutstandingWithdrawals(data); equal(items.length, 3);
  equal(filterReturnItems(data, items, 'Borrower B').length, 1); equal(filterReturnItems(data, items, 'Serial-a').length, 1);
  const all = Object.fromEntries(items.map(w => [w.id, String(remainingQuantity(w))])); equal(selectedReturnLines(all).length, 3);
  equal(selectedReturnLines({ a: '0', b: '', c: '2' }), [{ withdrawalId: 'c', quantity: 2 }]);
});
Deno.test('partial cross-transaction return changes only selected equipment and has one complete return receipt', () => {
  const original = fixture(); const before = JSON.stringify(original); const input = form(original);
  validateReturnDraft(original, input, returnedAt); equal(JSON.stringify(original), before);
  const next = buildReturns(original, input, returnedAt, makeId);
  equal(next.returnRecords?.length, 2); equal(remainingQuantity(next.withdrawals.find(w => w.assetId === 'a')!), 2); equal(remainingQuantity(next.withdrawals.find(w => w.assetId === 'b')!), 2);
  equal(next.withdrawals.find(w => w.assetId === 'c'), original.withdrawals.find(w => w.assetId === 'c'));
  const first = next.withdrawals.find(w => w.assetId === 'a')!; const other = next.withdrawals.find(w => w.assetId === 'b')!;
  const receipt = getTransactionReceiptModel(next, first, 'return', input.requestId);
  equal(receipt.isBatchReturn, true); equal(receipt.reference, input.requestId); equal(receipt.items.length, 2); equal(receipt.returns.length, 2);
  equal(new Set(receipt.items.map(w => w.reference)).size, 2); equal(receipt.returns.reduce((sum, r) => sum + r.quantity, 0), 3);
  equal(getTransactionReceiptModel(next, other, 'return', input.requestId).returns, receipt.returns);
  rejects(() => getTransactionReceiptModel(next, next.withdrawals.find(w => w.assetId === 'c')!, 'return', 'unrelated-reference'));
  equal(getTransactionReceiptModel(next, first, 'withdrawal').items.length, 2);
  equal(buildReturns(next, input, returnedAt, makeId), next);
  validateDatabase(next); const restored = validateDatabase(JSON.parse(JSON.stringify(next))); equal(mergeDatabase(restored, restored).returnRecords?.length, 2);
});
Deno.test('new return conditions accept exact choices and reject free text with no partial update', () => {
  const data = fixture(); const before = JSON.stringify(data);
  for (const condition of equipmentConditions) { const next = buildReturns(data, { ...form(data), condition }, returnedAt, makeId); equal(next.returnRecords?.every(r => r.condition === condition), true); }
  for (const condition of ['', 'Good', 'Damaged', 'serviceable']) rejects(() => buildReturns(data, { ...form(data), condition }, returnedAt, makeId));
  const input = form(data);
  rejects(() => buildReturns(data, { ...input, items: [{ ...input.items[0], quantity: 999 }, input.items[1]] }, returnedAt, makeId));
  rejects(() => buildReturns(data, { ...input, items: [input.items[0], input.items[0]] }, returnedAt, makeId));
  equal(JSON.stringify(data), before);
});
Deno.test('batch return can select every outstanding item even across more than 200 withdrawals', () => {
  let data: TrackerData = { version: 1, assets: Array.from({ length: 201 }, (_, i) => ({ id: `asset-${i}`, name: `Equipment ${i}`, serial: `S-${i}`, notes: 'Serialized', createdAt: at, updatedAt: at })), withdrawals: [], activities: [], notices: [], settings: { theme: 'dark', enabled: true, role: 'operator', warningHours: 24, notificationVolume: 100, alarmVolume: 100 } };
  for (const [index, assets] of [data.assets.slice(0, 200), data.assets.slice(200)].entries()) data = buildBatch(data, { requestId: `TX-${index}`, items: assets.map(a => ({ assetId: a.id, quantity: 1 })), releaser: 'Officer', receiver: 'Borrower', signature, withdrawalAt: at, dueAt: '2026-11-17T08:00:00.000Z', remarks: '' }, at, makeId).next;
  const next = buildReturns(data, { ...form(data), items: getOutstandingWithdrawals(data).map(w => ({ withdrawalId: w.id, quantity: remainingQuantity(w) })) }, returnedAt, makeId);
  equal(next.returnRecords?.length, 201); equal(getOutstandingWithdrawals(next).length, 0); validateDatabase(next);
});
