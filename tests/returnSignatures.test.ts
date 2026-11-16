import { buildBatch, buildReturns, remainingQuantity } from '../services/movements.ts';
import type { ReturnMovementInput } from '../services/movements.ts';
import { validateDatabase, mergeDatabase } from '../services/backupValidation.ts';
import { getTransactionReceiptModel, validateReturnDraft } from '../services/withdrawalTransactions.ts';
import { returnSignatureEntries, validateReturnSignature } from '../services/returnSignatures.ts';
import type { Signature, TrackerData } from '../services/tracker.ts';
const at = '2026-11-16T08:00:00.000Z';
const returnedAt = '2026-11-16T09:00:00.000Z';
let counter = 0; const makeId = (prefix: string) => `${prefix}-${++counter}`;
const sign = (offset = 0): Signature => [[{ x: 10 + offset, y: 10 }, { x: 40 + offset, y: 50 }, { x: 80 + offset, y: 30 }]];
function equal(actual: unknown, expected: unknown) { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`); }
function rejects(run: () => unknown) { let failed = false; try { run(); } catch { failed = true; } if (!failed) throw new Error('Expected signature validation failure'); }
function fixture(): TrackerData {
  const data: TrackerData = { version: 1, assets: [{ id: 'radio', name: 'Radio', serial: 'R-1', notes: 'Radio', createdAt: at, updatedAt: at }, { id: 'lot', name: 'Batteries', serial: 'B-1', notes: 'Battery lot', quantity: 4, createdAt: at, updatedAt: at }], withdrawals: [], activities: [], notices: [], settings: { theme: 'dark', enabled: true, role: 'operator', warningHours: 24, notificationVolume: 100, alarmVolume: 100 } };
  return buildBatch(data, { requestId: 'TX-signed', items: [{ assetId: 'radio', quantity: 1 }, { assetId: 'lot', quantity: 4 }], releaser: 'John', receiver: 'Jane', signature: sign(100), withdrawalAt: at, dueAt: '2026-11-17T08:00:00.000Z', remarks: '' }, at, makeId).next;
}
function form(data: TrackerData, reference = 'RET-signed'): ReturnMovementInput {
  return { requestId: reference, items: [{ withdrawalId: data.withdrawals.find(w => w.assetId === 'lot')!.id, quantity: 2 }], returning: 'Jane', receiving: 'John', condition: 'Good', remarks: 'Partial return', returnSignature: sign() };
}
Deno.test('new returns require a finite bounded handwritten signature without mutating data', () => {
  const data = fixture(); const before = JSON.stringify(data); const input = form(data);
  for (const invalid of [undefined, null, [], [[{ x: 1, y: 1 }]], [[{ x: 1, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 1 }]], [[{ x: NaN, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }]], [[{ x: 501, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }]], [[{ x: 2, y: -1 }, { x: 2, y: 2 }, { x: 3, y: 3 }]], [Array.from({ length: 20001 }, () => ({ x: 1, y: 1 }))]]) {
    rejects(() => validateReturnSignature(invalid));
    rejects(() => validateReturnDraft(data, { ...input, returnSignature: invalid as Signature }, returnedAt));
  }
  validateReturnDraft(data, input, returnedAt); equal(JSON.stringify(data), before);
});
Deno.test('partial return records a copied signature without altering withdrawal signature or other equipment', () => {
  const original = fixture(); const input = form(original); const captured = sign();
  const next = buildReturns(original, input, returnedAt, makeId);
  equal(next.returnRecords?.[0].returnSignature, captured);
  const lot = next.withdrawals.find(w => w.assetId === 'lot')!;
  equal(lot.returnSignature, captured); equal(lot.signature, sign(100)); equal(remainingQuantity(lot), 2);
  equal(next.withdrawals.find(w => w.assetId === 'radio'), original.withdrawals.find(w => w.assetId === 'radio'));
  input.returnSignature[0][0].x = 499;
  equal(next.returnRecords?.[0].returnSignature, captured); equal(lot.returnSignature, captured);
  equal(buildReturns(next, input, returnedAt, makeId), next); validateDatabase(next);
});
Deno.test('later return signer never replaces the signature on a previous return event', () => {
  const original = fixture(); const first = buildReturns(original, form(original), returnedAt, makeId);
  const second = buildReturns(first, { ...form(first, 'RET-later'), returning: 'Other returning person', returnSignature: sign(20) }, '2026-11-16T10:00:00.000Z', makeId);
  const withdrawal = second.withdrawals.find(w => w.assetId === 'lot')!;
  equal(remainingQuantity(withdrawal), 0); equal(withdrawal.returnSignature, sign(20));
  const oldReceipt = getTransactionReceiptModel(second, withdrawal, 'return', 'RET-signed');
  const newReceipt = getTransactionReceiptModel(second, withdrawal, 'return', 'RET-later');
  equal(oldReceipt.returns[0].returnSignature, sign()); equal(oldReceipt.returns[0].returning, 'Jane');
  equal(newReceipt.returns[0].returnSignature, sign(20)); equal(newReceipt.returns[0].returning, 'Other returning person');
  validateDatabase(second);
});
Deno.test('a multi-item return exports a single signer entry for the selected event', () => {
  const original = fixture(); const input = { ...form(original), items: original.withdrawals.map(w => ({ withdrawalId: w.id, quantity: w.quantity ?? 1 })) };
  const next = buildReturns(original, input, returnedAt, makeId);
  equal(next.returnRecords?.length, 2); equal(returnSignatureEntries(next.returnRecords || []).length, 1);
  equal(next.withdrawals.map(remainingQuantity), [0, 0]);
  equal(next.returnRecords?.map(r => r.returnSignature), [sign(), sign()]);
});
Deno.test('backup validation and merge retain signed return event snapshots', () => {
  const original = fixture(); const data = buildReturns(original, form(original), returnedAt, makeId);
  const restored = validateDatabase(JSON.parse(JSON.stringify(data)));
  equal(restored.withdrawals, data.withdrawals); equal(restored.returnRecords, data.returnRecords);
  equal(mergeDatabase(restored, restored).returnRecords?.length, 1);
});
Deno.test('older return backups and receipts remain unsigned without fabricating a signature', () => {
  const original = fixture(); const signed = buildReturns(original, form(original), returnedAt, makeId);
  const old = { ...signed, withdrawals: signed.withdrawals.map(({ returnSignature: _signature, ...w }) => w), returnRecords: signed.returnRecords?.map(({ returnSignature: _signature, ...r }) => r) };
  const restored = validateDatabase(JSON.parse(JSON.stringify(old)));
  equal(restored.returnRecords?.[0].returnSignature, undefined);
  const selected = getTransactionReceiptModel(restored, restored.withdrawals.find(w => w.assetId === 'lot')!, 'return', 'RET-signed');
  equal(selected.returns[0].returnSignature, undefined);
  const legacyW = { ...original.withdrawals.find(w => w.assetId === 'radio')!, batchId: undefined, reference: undefined, quantity: undefined, returnedQuantity: undefined, returnedAt, returning: 'Jane', receiving: 'John', condition: 'Good' };
  const legacy = { ...original, withdrawals: [legacyW], batches: undefined, returnRecords: undefined, activities: [] };
  validateDatabase(legacy); equal(getTransactionReceiptModel(legacy, legacyW, 'return').returns[0].returnSignature, undefined);
});
