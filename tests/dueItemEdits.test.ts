import { applyDueItemEdit, assertProtectedRestore, dueItemSnapshot, validateDueItemChanges } from '../services/dueItemEdits.ts';
import type { DueEditAudit, DueItemChanges } from '../services/dueItemEdits.ts';
import type { TrackerData } from '../services/tracker.ts';
import { validateDatabase, mergeDatabase, canonical } from '../services/backupValidation.ts';
import { dashboardActivities, dueSoonCount } from '../services/dashboard.ts';
import { pendingOverdueIds } from '../services/alarmPolicy.ts';
import { parseDueChanges } from '../supabase/functions/_shared/dueItemValidation.ts';
const at = '2026-11-23T08:00:00.000Z'; const oldDue = '2026-11-23T09:00:00.000Z'; const editedAt = '2026-11-23T10:00:00.000Z'; const newDue = '2026-11-24T08:00:00.000Z';
const ink = [[{ x: 10, y: 10 }, { x: 40, y: 50 }, { x: 80, y: 30 }]];
function eq(a: unknown, b: unknown) { if (canonical(a) !== canonical(b)) throw new Error('Unexpected due edit result.'); }
function rejects(run: () => unknown) { let failed = false; try { run(); } catch { failed = true; } if (!failed) throw new Error('Expected validation rejection.'); }
function fixture(): TrackerData { return { version: 1, assets: [{ id: 'AST-1', name: 'Radio', serial: 'SER-1', notes: 'Two radios', quantity: 2, createdAt: at, updatedAt: at }, { id: 'AST-2', name: 'Other radio', serial: 'SER-2', notes: 'Other', createdAt: at, updatedAt: at }], withdrawals: [{ id: 'WD-1', assetId: 'AST-1', releaser: 'Storekeeper', receiver: 'Original receiver', signature: ink, withdrawalAt: at, dueAt: oldDue, createdAt: at, quantity: 2, returnedQuantity: 0, notes: 'Purpose', equipmentSnapshot: { name: 'Radio', serial: 'SER-1', description: 'Two radios' } }], activities: [], notices: [{ id: 'NTF-1', withdrawalId: 'WD-1', assetId: 'AST-1', type: 'overdue', title: 'Overdue', message: 'Old reminder', at: editedAt, read: false, acknowledged: false }], alertKeys: ['WD-1:overdue'], settings: { theme: 'dark', role: 'operator', enabled: true, warningHours: 24, notificationVolume: 100, alarmVolume: 100 } }; }
function approval(data: TrackerData, patch: Partial<DueItemChanges>, id = 'approval-1'): DueEditAudit { const before = dueItemSnapshot(data, 'WD-1'); const changes: DueItemChanges = { name: before.name, serial: before.serial, description: before.description, receiver: before.receiver, releaser: before.releaser, notes: before.notes, dueAt: before.dueAt, ...patch }; return { id, before, approved: { ...before, ...validateDueItemChanges(data, before, changes) }, actor: 'Authorized storekeeper', at: editedAt }; }
Deno.test('authorized edit changes same IDs and preserves original signature/details, quantities and relationships', () => {
  const data = fixture(); const raw = canonical(data); const audit = approval(data, { dueAt: newDue, receiver: 'Corrected receiver', name: 'Updated radio', serial: 'SER-NEW', description: 'Corrected information' }); const next = applyDueItemEdit(data, audit);
  eq(canonical(data), raw); eq(next.withdrawals.length, 1); eq(next.assets.length, 2); eq(next.withdrawals[0].id, data.withdrawals[0].id); eq(next.withdrawals[0].assetId, 'AST-1'); eq(next.assets[0].id, 'AST-1'); eq(next.assets[1], data.assets[1]); eq(next.withdrawals[0].signature, ink); eq(next.withdrawals[0].quantity, 2); eq(next.withdrawals[0].returnedQuantity, 0); eq(next.withdrawals[0].createdAt, at); eq(next.withdrawals[0].originalDetails?.receiver, 'Original receiver'); eq(next.withdrawals[0].originalDetails?.dueAt, oldDue);
  eq(next.withdrawals[0].dueAt, newDue); eq(next.withdrawals[0].dueRevision, 1); eq(next.activities[0].person.includes(audit.actor), true); eq(next.activities[0].at, editedAt); eq(next.activities[0].description.includes(oldDue) && next.activities[0].description.includes(newDue), true); eq(next.activities[0].authorizationId, audit.id); eq(next.dueItemEdits?.length, 1); eq(applyDueItemEdit(next, audit), next);
  const restored = validateDatabase(JSON.parse(JSON.stringify(next))); eq(restored.dueItemEdits, next.dueItemEdits); eq(restored.withdrawals[0].originalDetails, next.withdrawals[0].originalDetails); assertProtectedRestore(next, restored); eq(mergeDatabase(restored, restored).dueItemEdits?.length, 1);
});
Deno.test('removing due date keeps item outstanding but disables due monitoring, backups retain explicit empty date', () => {
  const next = applyDueItemEdit(fixture(), approval(fixture(), { dueAt: '' })); eq(next.withdrawals[0].dueAt, ''); eq(next.withdrawals[0].returnedAt, undefined); eq(dashboardActivities(next, next.withdrawals, Date.parse(editedAt)).filter(a => a.kind === 'DUE ITEM').length, 0); eq(dueSoonCount(next.withdrawals, Date.parse(editedAt), 24), 0); eq(pendingOverdueIds(next.withdrawals, next.notices, Date.parse(editedAt)), []); eq(validateDatabase(next).withdrawals[0].dueAt, '');
});
Deno.test('new due revision does not inherit acknowledgement from old overdue notice', () => {
  const data = fixture(); data.notices[0].acknowledged = true; data.withdrawals[0].alarmAcknowledgedAt = editedAt;
  const next = applyDueItemEdit(data, approval(data, { dueAt: '2026-11-23T09:30:00.000Z' })); eq(next.withdrawals[0].alarmAcknowledgedAt, undefined); eq(pendingOverdueIds(next.withdrawals, next.notices, Date.parse(editedAt)), ['WD-1']);
});
Deno.test('equipment-only correction never silences an existing overdue alarm', () => {
  const data = fixture(); const next = applyDueItemEdit(data, approval(data, { name: 'Corrected equipment' })); eq(next.notices, data.notices); eq(pendingOverdueIds(next.withdrawals, next.notices, Date.parse(editedAt)), ['WD-1']);
});
Deno.test('duplicates, stale approvals, immutable fields and invalid dates are denied without mutation', () => {
  const data = fixture(); const audit = approval(data, { dueAt: newDue }); const raw = canonical(data);
  rejects(() => approval(data, { serial: 'SER-2' })); rejects(() => approval(data, { dueAt: at })); rejects(() => approval(data, { dueAt: 'invalid' })); rejects(() => parseDueChanges({ ...audit.approved, quantity: 99 }, at));
  rejects(() => applyDueItemEdit({ ...data, assets: data.assets.map(a => ({ ...a, updatedAt: editedAt })) }, audit)); rejects(() => applyDueItemEdit({ ...data, withdrawals: data.withdrawals.map(w => ({ ...w, returnedQuantity: 1 })) }, audit)); rejects(() => dueItemSnapshot({ ...data, withdrawals: data.withdrawals.map(w => ({ ...w, returnedAt: editedAt })) }, 'WD-1'));
  rejects(() => applyDueItemEdit(data, { ...audit, approved: { ...audit.approved, quantity: 99 } })); eq(canonical(data), raw);
});
Deno.test('restore cannot overwrite/remove existing due dates or erase protected edit history', () => {
  const data = fixture(); const next = applyDueItemEdit(data, approval(data, { dueAt: newDue })); rejects(() => assertProtectedRestore(data, next)); rejects(() => assertProtectedRestore(data, { ...data, withdrawals: [], notices: [] })); rejects(() => assertProtectedRestore(next, data)); rejects(() => assertProtectedRestore(next, { ...next, dueItemEdits: [] })); assertProtectedRestore(next, next);
});
Deno.test('successive corrections retain original withdrawal and all earlier audit snapshots', () => {
  const first = applyDueItemEdit(fixture(), approval(fixture(), { dueAt: newDue })); const second = applyDueItemEdit(first, approval(first, { dueAt: '2026-11-25T08:00:00.000Z' }, 'approval-2')); eq(second.withdrawals[0].originalDetails, first.withdrawals[0].originalDetails); eq(second.dueItemEdits?.[1], first.dueItemEdits?.[0]); eq(second.withdrawals.length, 1); eq(second.dueItemEdits?.length, 2); eq(validateDatabase(second).dueItemEdits?.length, 2);
});
