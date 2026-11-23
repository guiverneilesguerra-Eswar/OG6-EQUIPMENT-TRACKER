import { parseDueSnapshot, parseDueChanges, dueSnapshotKey } from '../_shared/dueItemValidation.ts';
function rejects(run: () => unknown) { let failed = false; try { run(); } catch { failed = true; } if (!failed) throw new Error('Expected validation failure'); }
const before = { withdrawalId: 'WD-1', assetId: 'AST-1', name: 'Radio', serial: 'R-1', description: 'Equipment', receiver: 'Borrower', releaser: 'Storekeeper', notes: '', dueAt: '2026-11-24T08:00:00.000Z', withdrawalAt: '2026-11-23T08:00:00.000Z', createdAt: '2026-11-23T08:00:00.000Z', assetUpdatedAt: '2026-11-23T08:00:00.000Z', recordUpdatedAt: '2026-11-23T08:00:00.000Z', quantity: 2, returnedQuantity: 0, dueRevision: 0 };
Deno.test('only bounded mutable details are accepted and due date removal is explicit', () => {
  const valid = parseDueSnapshot(before);
  const changes = { name: valid.name, serial: valid.serial, description: valid.description, receiver: valid.receiver, releaser: valid.releaser, notes: valid.notes, dueAt: '' };
  if (parseDueChanges(changes, valid.withdrawalAt).dueAt !== '') throw new Error('Removal must remain explicit');
  for (const patch of [{ dueAt: null }, { dueAt: 'invalid' }, { dueAt: valid.withdrawalAt }, { receiver: '' }, { name: 'a'.repeat(201) }, { quantity: 99 }, { assetId: 'different' }, { withdrawalAt: 'different' }]) rejects(() => parseDueChanges({ ...changes, ...patch }, valid.withdrawalAt));
  rejects(() => parseDueSnapshot({ ...before, returnedQuantity: 2 }));
  const reordered = Object.fromEntries(Object.entries(valid).reverse());
  if (dueSnapshotKey(parseDueSnapshot(reordered)) !== dueSnapshotKey(valid)) throw new Error('Property ordering must not affect record identity');
});
