import { buildBatch, buildReturns, getNameDirectory, manageName, remainingQuantity } from '../services/movements.ts';
import { validateDatabase, mergeDatabase, canonical } from '../services/backupValidation.ts';
import type { TrackerData } from '../services/tracker.ts';
const at = '2026-11-15T10:00:00.000Z';
let counter = 0; const makeId = (prefix: string) => `${prefix}-${++counter}`;
function check(value: unknown, message: string) { if (!value) throw new Error(message); }
function equal(a: unknown, b: unknown) { if (canonical(a) !== canonical(b)) throw new Error(`Expected ${canonical(b)}, received ${canonical(a)}`); }
function rejects(fn: () => unknown) { let failed = false; try { fn(); } catch { failed = true; } check(failed, 'Expected validation failure'); }
function fixture(): TrackerData { return { version: 1, assets: [{ id: 'a1', name: 'Radio', serial: '001', notes: 'Serialized radio', createdAt: at, updatedAt: at }, { id: 'a2', name: 'Battery lot', serial: 'LOT-02', notes: 'Rechargeable batteries', quantity: 6, createdAt: at, updatedAt: at }], withdrawals: [], activities: [], notices: [], settings: { theme: 'system', role: 'operator', notificationVolume: 100, alarmVolume: 100, enabled: true, warningHours: 24, alarmEnabled: true, notificationSound: null, alarmSound: null } }; }
function input(id = 'TX-1') { return { requestId: id, items: [{ assetId: 'a1', quantity: 1 }, { assetId: 'a2', quantity: 4 }], releaser: '  JOHN   Doe  ', receiver: 'Jane Smith', signature: [[{ x: 1, y: 1 }, { x: 10, y: 20 }, { x: 40, y: 20 }]], withdrawalAt: at, dueAt: '2026-11-16T10:00:00.000Z', remarks: 'Training' }; }
Deno.test('single withdrawal preserves original inventory and creates one linked transaction', () => {
  const data = fixture(); const before = canonical(data); const result = buildBatch(data, { ...input(), items: [{ assetId: 'a1', quantity: 1 }] }, at, makeId);
  equal(result.next.withdrawals.length, 1); equal(result.next.assets, data.assets); equal(result.batch.withdrawalIds.length, 1); equal(result.next.withdrawals[0].reference, result.batch.reference); equal(canonical(data), before); validateDatabase(result.next);
});
Deno.test('batch withdrawal keeps one reference with independent item IDs, quantities, snapshots and histories', () => {
  const data = fixture(); const result = buildBatch(data, input(), at, makeId);
  equal(result.next.withdrawals.length, 2); check(result.next.withdrawals[0].id !== result.next.withdrawals[1].id, 'Individual IDs must differ');
  equal(result.next.withdrawals.map(w => w.reference), ['TX-1', 'TX-1']); equal(result.next.withdrawals.map(w => w.quantity), [1, 4]); equal(result.next.activities.filter(a => a.type === 'withdrawal').length, 2);
  equal(result.next.withdrawals[0].equipmentSnapshot?.serial, '001'); validateDatabase(result.next);
  equal(buildBatch(result.next, input(), at, makeId).next, result.next);
  rejects(() => buildBatch(result.next, input('TX-2'), at, makeId));
});
Deno.test('out/unavailable, duplicate items, bad quantities and invalid dates fail without mutation', () => {
  const data = fixture(); const before = canonical(data);
  rejects(() => buildBatch(data, { ...input(), items: [{ assetId: 'a1', quantity: 2 }] }, at, makeId));
  rejects(() => buildBatch(data, { ...input(), items: [{ assetId: 'a1', quantity: 0 }] }, at, makeId));
  rejects(() => buildBatch(data, { ...input(), items: [{ assetId: 'a2', quantity: 1.5 }] }, at, makeId));
  rejects(() => buildBatch(data, { ...input(), items: [{ assetId: 'a1', quantity: 1 }, { assetId: 'a1', quantity: 1 }] }, at, makeId));
  rejects(() => buildBatch(data, { ...input(), dueAt: at }, at, makeId));
  rejects(() => buildBatch(data, { ...input(), signature: [] }, at, makeId));
  rejects(() => buildBatch(data, input(), at, () => 'a1'));
  equal(canonical(data), before);
});
Deno.test('manual items register atomically and cannot reuse another serialized name', () => {
  const data = fixture(); const manual = { assetId: '', manual: true, name: 'Cable lot', serial: 'LOT-03', description: 'Signal cables', quantity: 8 };
  const result = buildBatch(data, { ...input(), items: [manual] }, at, makeId).next;
  equal(result.assets.length, 3); equal(result.assets[0].quantity, 8); equal(result.withdrawals[0].quantity, 8); validateDatabase(result);
  rejects(() => buildBatch(data, { ...input(), items: [{ ...manual, serial: '001' }] }, at, makeId));
});
Deno.test('partial and complete batch returns retain every item history and prevent over-return/retry duplicates', () => {
  const original = buildBatch(fixture(), input(), at, makeId).next; const battery = original.withdrawals.find(w => w.assetId === 'a2')!; const radio = original.withdrawals.find(w => w.assetId === 'a1')!;
  const form = { requestId: 'RET-1', items: [{ withdrawalId: battery.id, quantity: 2 }], returning: 'Jane Smith', receiving: 'John Doe', condition: 'Good', remarks: 'Partial return' };
  const partial = buildReturns(original, form, '2026-11-15T11:00:00.000Z', makeId);
  equal(remainingQuantity(partial.withdrawals.find(w => w.id === battery.id)!), 2); equal(partial.withdrawals.find(w => w.id === battery.id)?.returnedAt, undefined); equal(remainingQuantity(partial.withdrawals.find(w => w.id === radio.id)!), 1);
  validateDatabase(partial); equal(buildReturns(partial, form, at, makeId), partial);
  rejects(() => buildReturns(partial, { ...form, requestId: 'RET-X', items: [{ withdrawalId: battery.id, quantity: 3 }] }, '2026-11-15T12:00:00.000Z', makeId));
  const complete = buildReturns(partial, { ...form, requestId: 'RET-2', items: [{ withdrawalId: battery.id, quantity: 2 }, { withdrawalId: radio.id, quantity: 1 }] }, '2026-11-15T12:00:00.000Z', makeId);
  check(complete.withdrawals.every(w => w.returnedAt && remainingQuantity(w) === 0), 'All equipment must be IN'); equal(complete.returnRecords?.length, 3); equal(complete.withdrawals.map(w => w.id), original.withdrawals.map(w => w.id)); validateDatabase(complete);
  buildBatch(complete, input('TX-3'), '2026-11-15T13:00:00.000Z', makeId);
});
Deno.test('name history separates roles, normalizes duplicates, persists and leaves historical records unchanged', () => {
  const data = buildBatch(fixture(), input(), at, makeId).next; const directory = getNameDirectory(data);
  equal(directory.releasers[0].name, 'JOHN Doe'); equal(directory.receivers[0].name, 'Jane Smith');
  equal(getNameDirectory(JSON.parse(JSON.stringify(data))), directory);
  const changed = manageName(data, 'releasers', directory.releasers[0].id, 'John D.');
  equal(changed.withdrawals, data.withdrawals); equal(changed.nameDirectory?.releasers[0].name, 'John D.');
  const removed = manageName(changed, 'releasers', directory.releasers[0].id, null);
  equal(getNameDirectory(JSON.parse(JSON.stringify(removed))).releasers.length, 0);
});
Deno.test('complete database JSON retains archive/history/settings and merge skips identical transactions', () => {
  const data = buildBatch(fixture(), input(), at, makeId).next; const restored = validateDatabase(JSON.parse(JSON.stringify(data)));
  equal(restored.withdrawals, data.withdrawals); equal(restored.settings.theme, 'system'); equal(restored.batches, data.batches);
  const merged = mergeDatabase(data, restored); equal(merged.withdrawals.length, 2); equal(merged.batches?.length, 1);
  const tampered = JSON.parse(JSON.stringify(restored)); tampered.withdrawals[0].receiver = 'Changed'; rejects(() => mergeDatabase(data, tampered)); equal(data.withdrawals[0].receiver, 'Jane Smith');
  const unrelated = fixture(); unrelated.assets = [{ ...unrelated.assets[0], id: 'new', serial: 'NEW-01' }]; const combined = mergeDatabase(data, unrelated); equal(combined.assets.length, 3);
  const missing = JSON.parse(JSON.stringify(restored)); missing.assets = []; rejects(() => validateDatabase(missing));
  const badReturn = JSON.parse(JSON.stringify(restored)); badReturn.withdrawals[0].returnedQuantity = 10; rejects(() => validateDatabase(badReturn));
});
