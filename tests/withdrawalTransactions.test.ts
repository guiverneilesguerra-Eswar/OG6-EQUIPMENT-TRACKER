import { buildBatch, buildReturns, remainingQuantity } from '../services/movements.ts';
import { getTransactionReceiptModel, getTransactionReturns, getWithdrawalItems, validateReturnDraft, validateWithdrawalDraft } from '../services/withdrawalTransactions.ts';
import { validateDatabase, mergeDatabase } from '../services/backupValidation.ts';
import type { TrackerData } from '../services/tracker.ts';
const at = '2026-11-16T08:00:00.000Z';
let counter = 0; const makeId = (prefix: string) => `${prefix}-${++counter}`;
function equal(actual: unknown, expected: unknown) { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`); }
function fails(run: () => unknown) { let failed = false; try { run(); } catch { failed = true; } if (!failed) throw new Error('Expected validation failure'); }
function fixture(): TrackerData { return { version: 1, assets: [{ id: 'radio', name: 'Radio', serial: 'R-1', notes: 'Radio description', createdAt: at, updatedAt: at }, { id: 'batteries', name: 'Battery lot', serial: 'B-1', notes: 'Six batteries', quantity: 6, createdAt: at, updatedAt: at }], withdrawals: [], activities: [], notices: [], settings: { theme: 'dark', enabled: true, role: 'operator', warningHours: 24, notificationVolume: 100, alarmVolume: 100 } }; }
const input = () => ({ requestId: 'TX-standard', items: [{ assetId: 'radio', quantity: 1 }, { assetId: 'batteries', quantity: 4 }], releaser: '  John   Doe ', receiver: 'JANE DOE', signature: [[{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 4 }]], withdrawalAt: at, dueAt: '2026-11-17T08:00:00.000Z', remarks: 'Standard form: multiple equipment' });
Deno.test('one standard transaction supports single or multiple equipment with read-only confirmation', () => {
  const data = fixture(); const before = JSON.stringify(data);
  validateWithdrawalDraft(data, input(), true, at); equal(JSON.stringify(data), before);
  fails(() => validateWithdrawalDraft(data, input(), false, at));
  const single = buildBatch(data, { ...input(), items: [input().items[0]] }, at, makeId);
  equal(single.next.withdrawals.length, 1); equal(getWithdrawalItems(single.next, single.next.withdrawals[0]).length, 1);
  const result = buildBatch(data, input(), at, makeId);
  equal(result.next.withdrawals.map(w => w.reference), ['TX-standard', 'TX-standard']);
  equal(result.next.withdrawals.map(w => w.quantity), [1, 4]);
  const model = getTransactionReceiptModel(result.next, result.next.withdrawals[1], 'withdrawal');
  equal(model.items.length, 2); equal(model.items[0].equipmentSnapshot?.name, 'Radio'); equal(model.returns, []);
  equal(buildBatch(result.next, input(), at, makeId).next, result.next);
  validateDatabase(result.next);
});
Deno.test('confirmation rejects OUT, archived, duplicate, empty and excess quantities without changing storage', () => {
  const data = fixture(); const before = JSON.stringify(data);
  fails(() => validateWithdrawalDraft(data, { ...input(), items: [] }, true, at));
  fails(() => validateWithdrawalDraft(data, { ...input(), items: [{ assetId: 'radio', quantity: 2 }] }, true, at));
  fails(() => validateWithdrawalDraft(data, { ...input(), items: [{ assetId: 'batteries', quantity: 0 }] }, true, at));
  fails(() => validateWithdrawalDraft(data, { ...input(), items: [{ assetId: 'batteries', quantity: 1.2 }] }, true, at));
  fails(() => validateWithdrawalDraft(data, { ...input(), items: [input().items[0], input().items[0]] }, true, at));
  const out = buildBatch(data, input(), at, makeId).next;
  fails(() => validateWithdrawalDraft(out, { ...input(), requestId: 'TX-new' }, true, at));
  const archived = { ...data, assets: data.assets.map(a => ({ ...a, archivedAt: at })) };
  fails(() => validateWithdrawalDraft(archived, input(), true, at));
  equal(JSON.stringify(data), before);
});
Deno.test('partial return event affects only selected quantities and complete receipt keeps all original items', () => {
  const original = buildBatch(fixture(), input(), at, makeId).next;
  const battery = original.withdrawals.find(w => w.assetId === 'batteries')!; const radio = original.withdrawals.find(w => w.assetId === 'radio')!;
  const form = { requestId: 'RET-1', items: [{ withdrawalId: battery.id, quantity: 2 }], returning: 'Jane Doe', receiving: 'John Doe', condition: 'Good', remarks: 'Two batteries only' };
  validateReturnDraft(original, form, '2026-11-16T09:00:00.000Z');
  const partial = buildReturns(original, form, '2026-11-16T09:00:00.000Z', makeId);
  equal(remainingQuantity(partial.withdrawals.find(w => w.id === battery.id)!), 2);
  equal(partial.withdrawals.find(w => w.id === radio.id), radio);
  const receipt = getTransactionReceiptModel(partial, partial.withdrawals.find(w => w.id === battery.id)!, 'return', 'RET-1');
  equal(receipt.items.length, 2); equal(receipt.returns.length, 1); equal(receipt.returns[0].quantity, 2);
  equal(receipt.returns[0].at, '2026-11-16T09:00:00.000Z');
  fails(() => getTransactionReceiptModel(partial, battery, 'return', 'missing-event'));
  fails(() => validateReturnDraft(partial, { ...form, requestId: 'RET-invalid', items: [{ withdrawalId: battery.id, quantity: 3 }] }, '2026-11-16T10:00:00.000Z'));
  const complete = buildReturns(partial, { ...form, requestId: 'RET-2', items: [{ withdrawalId: radio.id, quantity: 1 }, { withdrawalId: battery.id, quantity: 2 }] }, '2026-11-16T10:00:00.000Z', makeId);
  equal(complete.withdrawals.map(w => remainingQuantity(w)), [0, 0]);
  equal(getTransactionReturns(complete, complete.withdrawals).length, 3);
  equal(getTransactionReceiptModel(complete, complete.withdrawals[0], 'return', 'RET-1').returns[0].quantity, 2);
  equal(buildReturns(complete, { ...form, requestId: 'RET-2' }, at, makeId), complete);
  validateDatabase(complete);
});
Deno.test('existing grouped and legacy single history stays readable and backup-compatible', () => {
  const data = buildBatch(fixture(), input(), at, makeId).next;
  const restored = validateDatabase(JSON.parse(JSON.stringify(data)));
  equal(restored.withdrawals, data.withdrawals); equal(mergeDatabase(data, restored).withdrawals.length, 2);
  equal(restored.nameDirectory?.releasers[0].name, 'John Doe');
  const w = { ...data.withdrawals[0], batchId: undefined, reference: undefined, returnedAt: '2026-11-16T11:00:00.000Z', quantity: undefined, returnedQuantity: undefined, returning: 'Jane', receiving: 'John', condition: 'Good' };
  const legacy = { ...fixture(), withdrawals: [w] };
  equal(getWithdrawalItems(legacy, w), [w]);
  equal(getTransactionReceiptModel(legacy, w, 'return').returns[0].at, w.returnedAt);
  equal(getTransactionReceiptModel(legacy, w, 'return').returns[0].quantity, 1);
});
