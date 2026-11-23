import type { TrackerData, Withdrawal, Activity } from './tracker';
import { dueSnapshotKey, parseDueChanges, parseDueSnapshot } from '../supabase/functions/_shared/dueItemValidation';
import type { DueItemChanges, DueItemSnapshot } from '../supabase/functions/_shared/dueItemValidation';
export type { DueItemChanges, DueItemSnapshot } from '../supabase/functions/_shared/dueItemValidation';
export interface DueEditAudit { id: string; before: DueItemSnapshot; approved: DueItemSnapshot; actor: string; at: string }
function sameAudit(a: DueEditAudit, b: DueEditAudit) { return a.id === b.id && a.actor === b.actor && a.at === b.at && dueSnapshotKey(a.before) === dueSnapshotKey(b.before) && dueSnapshotKey(a.approved) === dueSnapshotKey(b.approved); }
function sameDetails(a: DueItemChanges | undefined, b: DueItemChanges | undefined) { return JSON.stringify(a ? Object.entries(a).sort(([x], [y]) => x.localeCompare(y)) : null) === JSON.stringify(b ? Object.entries(b).sort(([x], [y]) => x.localeCompare(y)) : null); }
export function dueItemSnapshot(data: TrackerData, id: string): DueItemSnapshot {
  const w = data.withdrawals.find(w => w.id === id); const a = data.assets.find(a => a.id === w?.assetId);
  if (!w || !a || a.archivedAt || w.deletedAt || w.returnedAt || (w.quantity ?? 1) <= (w.returnedQuantity ?? 0)) throw new Error('This withdrawal is no longer outstanding or available for editing.');
  return parseDueSnapshot({ withdrawalId: w.id, assetId: a.id, name: a.name, serial: a.serial, description: a.notes, receiver: w.receiver, releaser: w.releaser, dueAt: w.dueAt, notes: w.notes, withdrawalAt: w.withdrawalAt, createdAt: w.createdAt, assetUpdatedAt: a.updatedAt, recordUpdatedAt: w.updatedAt || w.createdAt, quantity: w.quantity ?? 1, returnedQuantity: w.returnedQuantity ?? 0, dueRevision: w.dueRevision || 0 });
}
export function validateDueItemChanges(data: TrackerData, before: DueItemSnapshot, changes: DueItemChanges): DueItemChanges {
  if (dueSnapshotKey(dueItemSnapshot(data, before.withdrawalId)) !== dueSnapshotKey(before)) throw new Error('This equipment or withdrawal changed after authorization. Reopen Edit and verify the password again.');
  const normalized = parseDueChanges(changes, before.withdrawalAt);
  if (data.assets.some(a => a.id !== before.assetId && a.serial.trim().toLowerCase() === normalized.serial.toLowerCase())) throw new Error('An equipment record with this Serial/Product ID already exists.');
  if (dueSnapshotKey({ ...before, ...normalized }) === dueSnapshotKey(before)) throw new Error('No changes to save.');
  return normalized;
}
export function originalDueDetails(w: Withdrawal, before: DueItemSnapshot): DueItemChanges {
  return w.originalDetails || { name: w.equipmentSnapshot?.name || before.name, serial: w.equipmentSnapshot?.serial || before.serial, description: w.equipmentSnapshot?.description || before.description, receiver: w.receiver, releaser: w.releaser, dueAt: w.dueAt, notes: w.notes };
}
export function applyDueItemEdit(data: TrackerData, audit: DueEditAudit): TrackerData {
  const previous = data.dueItemEdits?.find(e => e.id === audit.id);
  if (previous) { if (!sameAudit(previous, audit)) throw new Error('Conflicting saved edit authorization.'); return data; }
  const changes = Object.fromEntries(['name', 'serial', 'description', 'receiver', 'releaser', 'dueAt', 'notes'].map(k => [k, audit.approved[k as keyof DueItemSnapshot]])) as unknown as DueItemChanges;
  const normalized = validateDueItemChanges(data, audit.before, changes);
  if (!Number.isFinite(Date.parse(audit.at)) || !audit.actor.trim() || dueSnapshotKey(audit.approved) !== dueSnapshotKey({ ...audit.before, ...normalized })) throw new Error('Invalid authorized edit. No records were changed.');
  const old = data.withdrawals.find(w => w.id === audit.before.withdrawalId)!;
  const dueChanged = old.dueAt !== audit.approved.dueAt;
  const equipmentChanged = ['name', 'serial', 'description'].some(k => audit.before[k as keyof DueItemSnapshot] !== audit.approved[k as keyof DueItemSnapshot]);
  const edited: Withdrawal = { ...old, receiver: audit.approved.receiver, releaser: audit.approved.releaser, notes: audit.approved.notes, dueAt: audit.approved.dueAt, updatedAt: audit.at, originalDetails: originalDueDetails(old, audit.before), equipmentSnapshot: { name: audit.approved.name, serial: audit.approved.serial, description: audit.approved.description }, ...(dueChanged ? { dueRevision: (old.dueRevision || 0) + 1, alarmAcknowledgedAt: undefined } : {}) };
  const event: Activity = { id: `DUE-EDIT-${audit.id}`, assetId: old.assetId, transactionId: old.id, type: 'edit', person: `${audit.actor} (edit-password authorized; name supplied by operator)`, at: audit.at, authorizationId: audit.id,
    description: dueChanged ? `Due date changed: ${old.dueAt || 'No due date'} -> ${edited.dueAt || 'No due date'}. Receiver: ${old.receiver} -> ${edited.receiver}. Equipment/remarks corrections retained in edit audit.` : 'Due item details corrected with server authorization; original transaction and signatures retained.' };
  return { ...data, assets: equipmentChanged ? data.assets.map(a => a.id === old.assetId ? { ...a, name: audit.approved.name, serial: audit.approved.serial, notes: audit.approved.description, updatedAt: audit.at } : a) : data.assets,
    withdrawals: data.withdrawals.map(w => w.id === old.id ? edited : w), dueItemEdits: [audit, ...(data.dueItemEdits || [])], activities: [event, ...data.activities],
    notices: dueChanged ? data.notices.map(n => n.withdrawalId === old.id && (n.type === 'due' || n.type === 'overdue') ? { ...n, acknowledged: true, read: true } : n) : data.notices };
}
// Full restore is not an alternate due-date editor. Recovery cannot silently bypass
// the record-scoped edit authorization or erase its existing original/audit history.
export function assertProtectedRestore(current: TrackerData, incoming: TrackerData) {
  for (const w of current.withdrawals) {
    const restored = incoming.withdrawals.find(r => r.id === w.id);
    if ((!restored && w.dueAt) || (restored && restored.dueAt !== w.dueAt)) throw new Error('This backup changes an existing due date. Use password-protected Edit on that item first; a restore cannot bypass due-date authorization.');
    if (w.originalDetails && (!restored || !sameDetails(restored.originalDetails, w.originalDetails))) throw new Error('This backup would overwrite original transaction history. Use merge or a current backup.');
  }
  for (const audit of current.dueItemEdits || []) {
    if (!incoming.dueItemEdits?.some(a => sameAudit(a, audit))) throw new Error('This backup would remove protected edit history. Use merge or a current backup.');
  }
}
