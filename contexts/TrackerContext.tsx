import { createContext, useEffect, useRef, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { Activity, Asset, Settings, Signature, TrackerData, Withdrawal, alerts, emptyData, isActive, loadData, notice, saveData, uid, validateAsset } from '@/services/tracker';
import { playAlert } from '@/services/audio';
import { AlertSoundKind, clampVolume, soundChannel } from '@/services/soundClips';
import { pendingOverdueIds } from '@/services/alarmPolicy';
import { recordAlarmAcknowledgement } from '@/services/alarmAcknowledgements';
import { authorizeAssetEdit } from '@/services/authorizedEdits';
import { buildInventoryImport, InventoryImportPreview, InventoryImportResult } from '@/services/inventoryImportValidation';
import { ArchiveApproval, ArchiveKind, applyArchive, archiveFingerprint, archiveSnapshot, authorizeArchive, confirmArchive } from '@/services/archival';
import { BatchInput, BatchRecord, ReturnMovementInput, NameRole, buildBatch, buildReturns, getNameDirectory, manageName, remainingQuantity } from '@/services/movements';
import { validateDatabase, mergeDatabase, backupSummary } from '@/services/backupValidation';
import { authorizeMaintenance } from '@/services/maintenanceAuthorization';
import { applyDueItemEdit, assertProtectedRestore, dueItemSnapshot, validateDueItemChanges } from '@/services/dueItemEdits';
import type { DueItemChanges } from '@/services/dueItemEdits';
import { authorizeDueItem, confirmDueItem } from '@/services/dueItemAuthorization';
import type { DueEditApproval } from '@/services/dueItemAuthorization';
import { dueSnapshotKey } from '@/supabase/functions/_shared/dueItemValidation';
export interface WithdrawalInput { requestId?: string; assetId: string; manual: boolean; name: string; serial: string; manualNotes: string; releaser: string; receiver: string; signature: Signature; withdrawalAt: string; dueAt: string; notes: string }
export interface ReturnInput { returning: string; receiving: string; condition: string; remarks: string; receivingSignature: Signature; releasingSignature?: Signature }
interface TrackerValue {
  data: TrackerData; now: number; loaded: boolean; error: string; busy: boolean;
  retry: () => Promise<void>;
  addAsset: (name: string, serial: string, notes: string) => Promise<void>;
  importInventory: (preview: InventoryImportPreview, batchId: string) => Promise<InventoryImportResult>;
  editAsset: (id: string, name: string, serial: string, notes: string, password: string, requestId: string) => Promise<void>;
  prepareDueItemEdit: (id: string, actor: string, password: string) => Promise<DueEditApproval>;
  editDueItem: (approval: DueEditApproval, changes: DueItemChanges) => Promise<void>;
  withdraw: (input: WithdrawalInput) => Promise<Withdrawal>;
  withdrawTransaction: (input: BatchInput) => Promise<BatchRecord>;
  returnEquipment: (id: string, input: ReturnInput) => Promise<Withdrawal>;
  returnItems: (input: ReturnMovementInput) => Promise<void>;
  prepareArchive: (kind: ArchiveKind, id: string, password: string) => Promise<ArchiveApproval>;
  archiveRecord: (approval: ArchiveApproval) => Promise<void>;
  restoreBackup: (incoming: TrackerData, mode: 'full' | 'merge', password: string, expectedBefore: string) => Promise<string>;
  manageSavedName: (role: NameRole, id: string, value: string | null, password: string) => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  acknowledgeOverdue: () => Promise<void>;
  updateNotices: (action: 'read' | 'dismiss' | 'acknowledge' | 'clear', id?: string) => Promise<void>;
}
export const TrackerContext = createContext<TrackerValue | undefined>(undefined);
const makeId = (prefix: string) => `${prefix}-${randomUUID()}`;
export function TrackerProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<TrackerData>(emptyData);
  const [now, setNow] = useState(Date.now()); const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const current = useRef(data); const lock = useRef(false); const ready = useRef(false);
  async function retry() {
    if (lock.current) return;
    setError('');
    try { const original = await loadData(); const result = { ...original, nameDirectory: getNameDirectory(original) }; current.current = result; setData(result); ready.current = true; setLoaded(true); }
    catch (e) { ready.current = false; setError(e instanceof Error ? e.message : 'Unable to load device records.'); }
  }
  useEffect(() => { void retry(); const timer = setInterval(() => setNow(Date.now()), 10000); return () => clearInterval(timer); }, []);
  async function commit(transform: (d: TrackerData) => TrackerData | Promise<TrackerData>, sound?: AlertSoundKind) {
    if (!ready.current) throw new Error('Device records are not ready. Please retry loading.');
    if (lock.current) throw new Error('Another operation is in progress. Please try again.');
    lock.current = true; setBusy(true);
    try {
      const transformed = await transform(current.current);
      if (transformed === current.current) return current.current;
      const next = { ...transformed, alertKeys: Array.from(new Set([...(transformed.alertKeys || []), ...transformed.notices.filter(n => n.withdrawalId && (n.type === 'due' || n.type === 'overdue')).map(n => `${n.withdrawalId}:${n.type}${n.dueRevision ? `:revision-${n.dueRevision}` : ''}`)])) };
      // One complete persisted snapshot: no partial batch or in-memory success before durable save.
      await saveData(next); current.current = next; setData(next); setNow(Date.now());
      if (sound && next.settings.enabled) { const channel = soundChannel(sound); if (channel === 'notification' || next.settings.alarmEnabled !== false) void playAlert(sound, channel === 'alarm' ? next.settings.alarmVolume : next.settings.notificationVolume); }
      return next;
    } finally { lock.current = false; setBusy(false); }
  }
  useEffect(() => { if (!loaded || lock.current) return; const next = alerts(current.current, now); if (next.length) void commit(d => ({ ...d, notices: [...next, ...d.notices] }), next.some(n => n.type === 'due') ? 'due' : undefined).catch(() => {}); }, [now, loaded, data.withdrawals, data.settings.enabled, data.settings.warningHours]);
  function operator(d: TrackerData) { if (d.settings.role !== 'operator') throw new Error('Switch to the local operator workspace to record equipment movements.'); }
  async function addAsset(name: string, serial: string, notes: string) {
    await commit(d => {
      operator(d); validateAsset(d, name, serial, notes);
      const at = new Date().toISOString();
      const asset: Asset = { id: makeId('AST'), name: name.trim(), serial: serial.trim(), notes: notes.trim(), createdAt: at, updatedAt: at };
      const event: Activity = { id: makeId('ACT'), assetId: asset.id, type: 'added', person: 'Local operator', at, description: 'Equipment registered' };
      return { ...d, assets: [asset, ...d.assets], activities: [event, ...d.activities], notices: [notice('success', 'Equipment added', 'Equipment added to inventory successfully.', asset.id), ...d.notices] };
    }, 'notification');
  }
  async function importInventory(preview: InventoryImportPreview, batchId: string): Promise<InventoryImportResult> {
    const completed: { result?: InventoryImportResult } = {};
    const next = await commit(d => {
      operator(d); const batch = buildInventoryImport(d, preview, batchId, new Date().toISOString(), makeId); completed.result = batch.result;
      if (batch.result.alreadyCompleted) return d;
      return { ...batch.next, notices: [notice('success', 'Inventory Import Completed Successfully.', `${batch.result.imported} imported · ${batch.result.duplicatesSkipped} duplicates skipped · ${batch.result.invalidRows} invalid rows · ${batch.result.totalProcessed} processed.`), ...d.notices] };
    });
    const result = completed.result; if (!result) throw new Error('Unable to confirm the saved import result.');
    if (!result.alreadyCompleted && next.settings.enabled) void playAlert('notification', next.settings.notificationVolume);
    return result;
  }
  async function editAsset(id: string, name: string, serial: string, notes: string, password: string, requestId: string) {
    await commit(async d => {
      operator(d); validateAsset(d, name, serial, notes, id);
      const original = d.assets.find(asset => asset.id === id); if (!original || original.archivedAt) throw new Error('This equipment is unavailable for editing.');
      const approved = await authorizeAssetEdit(original, { name, serial, notes }, password, requestId);
      const at = new Date().toISOString(); const event: Activity = { id: makeId('ACT'), assetId: id, type: 'edit', person: 'Password-authorized local operator', at, description: 'Equipment details updated with server authorization' };
      return { ...d, assets: d.assets.map(asset => asset.id === id ? approved : asset), activities: [event, ...d.activities], notices: [notice('success', 'Equipment updated', 'Equipment details updated successfully.', id), ...d.notices] };
    }, 'notification');
  }
  async function prepareDueItemEdit(id: string, actor: string, password: string): Promise<DueEditApproval> {
    if (!ready.current || lock.current) throw new Error('Wait for records to load or the current operation to finish.');
    operator(current.current); const before = dueItemSnapshot(current.current, id);
    const approval = await authorizeDueItem(before, actor, password);
    operator(current.current);
    if (dueSnapshotKey(dueItemSnapshot(current.current, id)) !== dueSnapshotKey(before)) throw new Error('The item changed during authorization. Reopen Edit and verify the password again.');
    return approval;
  }
  async function editDueItem(approval: DueEditApproval, changes: DueItemChanges) {
    await commit(async d => {
      operator(d);
      // A completed retry is a no-op, never a second withdrawal or audit event.
      if (d.dueItemEdits?.some(e => e.id === approval.id)) return d;
      const normalized = validateDueItemChanges(d, approval.before, changes);
      const audit = await confirmDueItem(approval, normalized);
      const next = applyDueItemEdit(d, audit);
      return { ...next, notices: [notice('success', 'Due item updated', 'Authorized changes saved; original transaction and edit history retained.', approval.before.assetId, approval.before.withdrawalId), ...next.notices] };
    }, 'notification');
  }
  async function prepareArchive(kind: ArchiveKind, id: string, password: string): Promise<ArchiveApproval> {
    if (!ready.current) throw new Error('Device records are not ready. Please retry loading.');
    if (lock.current) throw new Error('Another operation is in progress. Please try again.');
    operator(current.current); const snapshot = archiveSnapshot(current.current, kind, id); const approval = await authorizeArchive(snapshot, password); operator(current.current);
    if (archiveFingerprint(archiveSnapshot(current.current, kind, id)) !== approval.fingerprint) throw new Error('This record changed during authorization. Review it and enter the password again.');
    return approval;
  }
  async function archiveRecord(approval: ArchiveApproval) {
    await commit(async d => {
      operator(d); const snapshot = archiveSnapshot(d, approval.kind, approval.recordId);
      if (archiveFingerprint(snapshot) !== approval.fingerprint) throw new Error('This record changed after authorization. Review it and enter the password again.');
      return applyArchive(d, await confirmArchive(approval));
    });
  }
  async function withdraw(input: WithdrawalInput) {
    const requestId = input.requestId || makeId('TX'); let withdrawalId = '';
    const next = await commit(d => {
      operator(d);
      const result = buildBatch(d, { requestId, items: [{ assetId: input.assetId, manual: input.manual, name: input.name, serial: input.serial, description: input.manualNotes, quantity: 1 }], releaser: input.releaser, receiver: input.receiver, signature: input.signature, withdrawalAt: input.withdrawalAt, dueAt: input.dueAt, remarks: input.notes }, new Date().toISOString(), makeId);
      withdrawalId = result.batch.withdrawalIds[0];
      return result.next === d ? d : { ...result.next, notices: [notice('success', 'Withdrawal confirmed', 'Equipment withdrawal recorded successfully.', result.next.withdrawals.find(w => w.id === withdrawalId)?.assetId, withdrawalId), ...d.notices] };
    }, 'withdrawal');
    const recorded = next.withdrawals.find(w => w.id === withdrawalId); if (!recorded) throw new Error('The saved withdrawal record could not be found.'); return recorded;
  }
  async function returnEquipment(id: string, input: ReturnInput) {
    const next = await commit(d => {
      operator(d); const w = d.withdrawals.find(x => x.id === id); if (!w || !isActive(w)) throw new Error('This withdrawal is no longer active.');
      const result = buildReturns(d, { ...input, requestId: makeId('RET'), items: [{ withdrawalId: id, quantity: remainingQuantity(w) }] }, new Date().toISOString(), makeId);
      return { ...result, notices: [notice('success', 'Return confirmed', 'Equipment returned successfully.', w.assetId, id), ...result.notices] };
    }, 'return');
    const returned = next.withdrawals.find(w => w.id === id); if (!returned) throw new Error('The saved return record could not be found.'); return returned;
  }
  async function withdrawTransaction(input: BatchInput) {
    const completed: { batch?: BatchRecord } = {};
    await commit(d => {
      operator(d); const result = buildBatch(d, input, new Date().toISOString(), makeId); completed.batch = result.batch;
      return result.next === d ? d : { ...result.next, notices: [notice('success', 'Withdrawal recorded', `${result.batch.reference} · ${input.items.length} equipment records.`), ...d.notices] };
    }, 'withdrawal');
    if (!completed.batch) throw new Error('The saved withdrawal transaction was not found.'); return completed.batch;
  }
  async function returnItems(input: ReturnMovementInput) {
    await commit(d => {
      operator(d); const result = buildReturns(d, input, new Date().toISOString(), makeId);
      return result === d ? d : { ...result, notices: [notice('success', 'Return recorded', `${input.requestId} · ${input.items.length} items processed.`), ...result.notices] };
    }, 'return');
  }
  async function manageSavedName(role: NameRole, id: string, value: string | null, password: string) {
    await commit(async d => {
      operator(d); const next = manageName(d, role, id, value); const approval = await authorizeMaintenance('names', JSON.stringify({ directory: d.nameDirectory, role, id, value }), password);
      const at = new Date().toISOString(); const event: Activity = { id: makeId('ACT'), assetId: '', type: 'maintenance', person: 'Administrator-authorized operator', at, description: 'Saved name directory updated; historical transaction names unchanged', authorizationId: approval.id };
      return { ...next, activities: [event, ...d.activities] };
    });
  }
  async function restoreBackup(incoming: TrackerData, mode: 'full' | 'merge', password: string, expectedBefore: string) {
    let summary = '';
    await commit(async d => {
      operator(d);
      if (!expectedBefore || JSON.stringify(d) !== expectedBefore) throw new Error('Device records changed after preview. Validate the restoration plan again; no records were changed.');
      const validated = validateDatabase(incoming); const next = mode === 'merge' ? mergeDatabase(d, validated) : validated;
      assertProtectedRestore(d, next);
      const approval = await authorizeMaintenance('restore', JSON.stringify({ mode, before: d, after: next }), password);
      // This recovery slot is separate from the operational store. Existing audio files are retained.
      await AsyncStorage.setItem('og6.recovery.beforeRestore.v1', JSON.stringify(d));
      const at = new Date().toISOString(); const event: Activity = { id: makeId('ACT'), assetId: '', type: 'maintenance', person: 'Administrator-authorized operator', at, description: `${mode === 'full' ? 'Full restore' : 'Merge'} completed; pre-restore local snapshot retained`, authorizationId: approval.id };
      summary = backupSummary(next); return { ...next, activities: [event, ...next.activities] };
    });
    return `${mode === 'full' ? 'Full restore' : 'Merge'} completed · ${summary}`;
  }
  async function updateSettings(patch: Partial<Settings>) {
    await commit(d => ({ ...d, settings: { ...d.settings, ...patch, notificationVolume: clampVolume(patch.notificationVolume ?? d.settings.notificationVolume), alarmVolume: clampVolume(patch.alarmVolume ?? d.settings.alarmVolume), audioPreferencesVersion: 2 } }));
  }
  async function acknowledgeOverdue() {
    await commit(d => {
      const at = new Date().toISOString(); const ids = pendingOverdueIds(d.withdrawals, d.notices, Date.parse(at)); const result = recordAlarmAcknowledgement(d, ids, at, uid('ACT'), 'alarm-control');
      return { ...d, withdrawals: result.withdrawals, notices: result.notices, activities: result.activities };
    });
  }
  async function updateNotices(action: 'read' | 'dismiss' | 'acknowledge' | 'clear', id?: string) {
    await commit(d => {
      const selected = d.notices.filter(n => !id || n.id === id);
      const silenced = selected.filter(n => n.type === 'overdue' && (action === 'acknowledge' || action === 'dismiss') && n.withdrawalId).map(n => n.withdrawalId as string);
      const at = new Date().toISOString(); const result = recordAlarmAcknowledgement(d, silenced, at, uid('ACT'), action === 'dismiss' ? 'notification-dismiss' : 'notification-acknowledge');
      return { ...d, withdrawals: result.withdrawals, activities: result.activities,
        notices: action === 'clear' ? result.notices.filter(n => !n.read || ((n.type === 'overdue' || n.type === 'due') && !n.acknowledged && d.withdrawals.some(w => w.id === n.withdrawalId && isActive(w))))
          : result.notices.map(n => !id || n.id === id ? { ...n, read: true, acknowledged: action === 'acknowledge' || action === 'dismiss' ? true : n.acknowledged } : n) };
    });
  }
  return <TrackerContext.Provider value={{ data, now, loaded, error, busy, retry, addAsset, importInventory, editAsset, prepareDueItemEdit, editDueItem, withdraw, withdrawTransaction, returnEquipment, returnItems, prepareArchive, archiveRecord, restoreBackup, manageSavedName, updateSettings, acknowledgeOverdue, updateNotices }}>{children}</TrackerContext.Provider>;
}
