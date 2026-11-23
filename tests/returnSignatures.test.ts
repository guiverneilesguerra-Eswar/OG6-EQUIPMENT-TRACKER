import { buildBatch, buildReturns, remainingQuantity } from '../services/movements.ts';
import type { ReturnMovementInput } from '../services/movements.ts';
import { validateDatabase, mergeDatabase } from '../services/backupValidation.ts';
import { getTransactionReceiptModel, validateReturnDraft } from '../services/withdrawalTransactions.ts';
import { getReturnSignatureBlocks, getReturnSignatureDetails, returnSignatureEntries, validateReturnSignature } from '../services/returnSignatures.ts';
import type { Signature, TrackerData } from '../services/tracker.ts';
const at = '2026-11-16T08:00:00.000Z'; const returnedAt = '2026-11-16T09:00:00.000Z';
let counter = 0; const makeId = (prefix: string) => `${prefix}-${++counter}`;
const sign = (offset = 0): Signature => [[{ x: 10 + offset, y: 10 }, { x: 40 + offset, y: 50 }, { x: 80 + offset, y: 30 }]];
function equal(actual: unknown, expected: unknown) { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('Values differ'); }
function rejects(run: () => unknown) { let failed = false; try { run(); } catch { failed = true; } if (!failed) throw new Error('Expected validation failure'); }
function fixture(): TrackerData {
  const data: TrackerData = { version: 1, assets: [{ id: 'radio', name: 'Radio', serial: 'R-1', notes: 'Radio', createdAt: at, updatedAt: at }, { id: 'lot', name: 'Batteries', serial: 'B-1', notes: 'Battery lot', quantity: 4, createdAt: at, updatedAt: at }], withdrawals: [], activities: [], notices: [], settings: { theme: 'dark', enabled: true, role: 'operator', warningHours: 24, notificationVolume: 100, alarmVolume: 100 } };
  return buildBatch(data, { requestId: 'TX-signed', items: [{ assetId: 'radio', quantity: 1 }, { assetId: 'lot', quantity: 4 }], releaser: 'John', receiver: 'Jane', signature: sign(100), withdrawalAt: at, dueAt: '2026-11-17T08:00:00.000Z', remarks: '' }, at, makeId).next;
}
function form(data: TrackerData, reference = 'RET-signed'): ReturnMovementInput {
  return { requestId: reference, items: [{ withdrawalId: data.withdrawals.find(w => w.assetId === 'lot')!.id, quantity: 2 }], returning: 'Jane', receiving: 'John', condition: 'Serviceable', remarks: 'Partial return', receivingSignature: sign() };
}
Deno.test('new returns require a bounded receiving signature without mutating data', () => {
  const data = fixture(); const before = JSON.stringify(data); const input = form(data);
  for (const invalid of [undefined, null, [], [[{ x: 1, y: 1 }]], [[{ x: 1, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 1 }]], [[{ x: NaN, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }]], [[{ x: 501, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }]], [[{ x: 2, y: -1 }, { x: 2, y: 2 }, { x: 3, y: 3 }]], [Array.from({ length: 20001 }, () => ({ x: 1, y: 1 }))]]) {
    rejects(() => validateReturnSignature(invalid)); rejects(() => validateReturnDraft(data, { ...input, receivingSignature: invalid as Signature }, returnedAt));
  }
  const legacyOnly = { ...input, receivingSignature: undefined, returnSignature: sign() };
  rejects(() => validateReturnDraft(data, legacyOnly as unknown as ReturnMovementInput, returnedAt));
  validateReturnDraft(data, input, returnedAt); equal(JSON.stringify(data), before);
});
Deno.test('partial return copies receiving signature without altering original withdrawal or other equipment', () => {
  const original = fixture(); const input = form(original); const captured = sign();
  const next = buildReturns(original, input, returnedAt, makeId); const lot = next.withdrawals.find(w => w.assetId === 'lot')!;
  equal(next.returnRecords?.[0].receivingSignature, captured); equal(lot.receivingSignature, captured); equal(lot.returnSignature, undefined);
  equal(lot.signature, sign(100)); equal(remainingQuantity(lot), 2); equal(next.withdrawals.find(w => w.assetId === 'radio'), original.withdrawals.find(w => w.assetId === 'radio'));
  input.receivingSignature[0][0].x = 499; equal(next.returnRecords?.[0].receivingSignature, captured); equal(lot.receivingSignature, captured);
  equal(buildReturns(next, input, returnedAt, makeId), next); validateDatabase(next);
  equal(getReturnSignatureDetails(next.returnRecords![0]).person, 'John');
});
Deno.test('successive return receipts retain their own receiving personnel and signature', () => {
  const original = fixture(); const first = buildReturns(original, form(original), returnedAt, makeId);
  const second = buildReturns(first, { ...form(first, 'RET-later'), receiving: 'Other receiving person', receivingSignature: sign(20) }, '2026-11-16T10:00:00.000Z', makeId);
  const withdrawal = second.withdrawals.find(w => w.assetId === 'lot')!;
  equal(remainingQuantity(withdrawal), 0); equal(withdrawal.receivingSignature, sign(20));
  const oldReceipt = getTransactionReceiptModel(second, withdrawal, 'return', 'RET-signed'); const newReceipt = getTransactionReceiptModel(second, withdrawal, 'return', 'RET-later');
  equal(oldReceipt.returns[0].receivingSignature, sign()); equal(oldReceipt.returns[0].receiving, 'John');
  equal(newReceipt.returns[0].receivingSignature, sign(20)); equal(newReceipt.returns[0].receiving, 'Other receiving person'); validateDatabase(second);
});
Deno.test('multi-item returns export one receiving signer entry and backup round trips preserve snapshots', () => {
  const original = fixture(); const input = { ...form(original), items: original.withdrawals.map(w => ({ withdrawalId: w.id, quantity: w.quantity ?? 1 })) };
  const next = buildReturns(original, input, returnedAt, makeId);
  equal(next.returnRecords?.length, 2); equal(returnSignatureEntries(next.returnRecords || []).length, 1); equal(next.withdrawals.map(remainingQuantity), [0, 0]);
  const restored = validateDatabase(JSON.parse(JSON.stringify(next))); equal(restored.withdrawals, next.withdrawals); equal(restored.returnRecords, next.returnRecords); equal(mergeDatabase(restored, restored).returnRecords?.length, 2);
});
Deno.test('original withdrawal ink is independently copied to every saved equipment record', () => {
  const base = fixture(); const captured = sign(); const input = { requestId: 'TX-copy', items: [{ assetId: 'radio', quantity: 1 }, { assetId: 'lot', quantity: 4 }], releaser: 'John', receiver: 'Jane', signature: captured, withdrawalAt: at, dueAt: '2026-11-17T08:00:00.000Z', remarks: '' };
  const original = { ...base, withdrawals: [], batches: [], activities: [] };
  const result = buildBatch(original, input, at, makeId).next;
  captured[0][0].x = 499;
  equal(result.withdrawals.map(w => w.signature), [sign(), sign()]);
  result.withdrawals[0].signature[0][0].x = 400; equal(result.withdrawals[1].signature, sign());
});
Deno.test('receiving and releaser return ink survives persistence, old-event reopening and backup merge separately', () => {
  const original = fixture(); const input = { ...form(original), releasingSignature: sign(25) };
  const first = buildReturns(original, input, returnedAt, makeId);
  input.releasingSignature[0][0].x = 499; input.receivingSignature[0][0].x = 498;
  equal(first.returnRecords![0].receivingSignature, sign()); equal(first.returnRecords![0].releasingSignature, sign(25));
  const second = buildReturns(first, { ...form(first, 'RET-next'), receivingSignature: sign(10), releasingSignature: sign(30) }, '2026-11-16T10:00:00.000Z', makeId);
  const restored = validateDatabase(JSON.parse(JSON.stringify(second)));
  const selected = getTransactionReceiptModel(restored, restored.withdrawals.find(w => w.assetId === 'lot')!, 'return', 'RET-signed');
  const blocks = getReturnSignatureBlocks(selected.returns[0]);
  equal(blocks.map(b => b.person), ['John', 'Jane']); equal(blocks.map(b => b.signature), [sign(), sign(25)]);
  equal(blocks.map(b => b.label), ['Receiving personnel signature', 'Releaser signature at return']);
  equal(mergeDatabase(restored, restored).returnRecords, restored.returnRecords);
  rejects(() => buildReturns(original, { ...form(original, 'RET-bad'), releasingSignature: [[{ x: 1, y: 1 }]] }, returnedAt, makeId));
});
Deno.test('legacy returning signatures retain their original role, condition, strokes and timestamp', () => {
  const original = fixture(); const data = buildReturns(original, form(original), returnedAt, makeId);
  const legacy = { ...data, withdrawals: data.withdrawals.map(({ receivingSignature, ...w }) => ({ ...w, ...(receivingSignature ? { returnSignature: receivingSignature, condition: 'Good' } : {}) })), returnRecords: data.returnRecords?.map(({ receivingSignature, ...r }) => ({ ...r, returnSignature: receivingSignature, condition: 'Good' })) };
  const restored = validateDatabase(JSON.parse(JSON.stringify(legacy))); const event = restored.returnRecords![0];
  equal(event.receivingSignature, undefined); equal(event.returnSignature, sign()); equal(event.condition, 'Good'); equal(event.at, returnedAt);
  const details = getReturnSignatureDetails(event); equal(details.label, 'Returning personnel signature (historical)'); equal(details.person, 'Jane');
  const unsigned = { ...event, returnSignature: undefined }; equal(getReturnSignatureDetails(unsigned).signature, []);
  equal(mergeDatabase(restored, restored).returnRecords?.length, 1);
});
