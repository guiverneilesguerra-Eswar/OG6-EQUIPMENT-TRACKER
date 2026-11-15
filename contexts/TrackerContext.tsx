import { createContext, useEffect, useRef, useState, ReactNode } from 'react';
import { Activity, Asset, Notice, Settings, Signature, TrackerData, Withdrawal, alerts, emptyData, isActive, loadData, notice, saveData, uid, validateAsset } from '@/services/tracker';
import { playAlert } from '@/services/audio';
import { AlertSoundKind, clampVolume, soundChannel } from '@/services/soundClips';
import { pendingOverdueIds } from '@/services/alarmPolicy';
import { recordAlarmAcknowledgement } from '@/services/alarmAcknowledgements';
import { authorizeAssetEdit } from '@/services/authorizedEdits';
import { randomUUID } from 'expo-crypto';
import { buildInventoryImport, InventoryImportPreview, InventoryImportResult } from '@/services/inventoryImportValidation';
import { ArchiveApproval, ArchiveKind, applyArchive, archiveFingerprint, archiveSnapshot, authorizeArchive, confirmArchive } from '@/services/archival';
export interface WithdrawalInput { assetId: string; manual: boolean; name: string; serial: string; manualNotes: string; releaser: string; receiver: string; signature: Signature; withdrawalAt: string; dueAt: string; notes: string }
import { buildEquipmentReturn } from '@/services/equipmentReturns';
import type { ReturnInput } from '@/services/equipmentReturns';
export type { ReturnInput } from '@/services/equipmentReturns';
interface TrackerValue { data: TrackerData; now: number; loaded: boolean; error: string; busy: boolean; retry: () => Promise<void>; addAsset: (name: string, serial: string, notes: string) => Promise<void>; importInventory: (preview: InventoryImportPreview, batchId: string) => Promise<InventoryImportResult>; editAsset: (id: string, name: string, serial: string, notes: string, password: string, requestId: string) => Promise<void>; withdraw: (input: WithdrawalInput) => Promise<Withdrawal>; returnEquipment: (id: string, input: ReturnInput) => Promise<Withdrawal>; prepareArchive: (kind: ArchiveKind, id: string, password: string) => Promise<ArchiveApproval>; archiveRecord: (approval: ArchiveApproval) => Promise<void>; updateSettings: (patch: Partial<Settings>) => Promise<void>; acknowledgeOverdue: () => Promise<void>; updateNotices: (action: 'read' | 'dismiss' | 'acknowledge' | 'clear', id?: string) => Promise<void> }
export const TrackerContext = createContext<TrackerValue | undefined>(undefined);
export function TrackerProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<TrackerData>(emptyData); const [now, setNow] = useState(Date.now()); const [loaded, setLoaded] = useState(false); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const current = useRef(data); const lock = useRef(false); const ready = useRef(false);
  async function retry() { setError(''); try { const result = await loadData(); current.current = result; setData(result); ready.current = true; setLoaded(true); } catch (e) { ready.current = false; setError(e instanceof Error ? e.message : 'Unable to load device records.'); } }
  useEffect(() => { void retry(); const timer = setInterval(() => setNow(Date.now()), 10000); return () => { clearInterval(timer); }; }, []);
  async function commit(transform: (d: TrackerData) => TrackerData | Promise<TrackerData>, sound?: AlertSoundKind) { if (!ready.current) throw new Error('Device records are not ready. Please retry loading.'); if (lock.current) throw new Error('Another operation is in progress. Please try again.'); lock.current = true; setBusy(true); try { const transformed = await transform(current.current); const next = { ...transformed, alertKeys: Array.from(new Set([...(transformed.alertKeys || []), ...transformed.notices.filter(n => n.withdrawalId && (n.type === 'due' || n.type === 'overdue')).map(n => `${n.withdrawalId}:${n.type}`)])) }; await saveData(next); current.current = next; setData(next); if (sound && next.settings.enabled) { const channel = soundChannel(sound); if (channel === 'notification' || next.settings.alarmEnabled !== false) void playAlert(sound, channel === 'alarm' ? next.settings.alarmVolume : next.settings.notificationVolume); } return next; } finally { lock.current = false; setBusy(false); } }
  useEffect(() => { if (!loaded || lock.current) return; const next = alerts(current.current, now); if (next.length) void commit(d => ({ ...d, notices: [...next, ...d.notices] }), next.some(n => n.type === 'due') ? 'due' : undefined).catch(() => {}); }, [now, loaded, data.withdrawals, data.settings.enabled, data.settings.warningHours]);
  function operator(d: TrackerData) { if (d.settings.role !== 'operator') throw new Error('Switch to the local operator workspace to record equipment movements.'); }
  async function addAsset(name: string, serial: string, notes: string) {
    await commit(d => {
      operator(d); validateAsset(d, name, serial, notes);
      const at = new Date().toISOString();
      const asset: Asset = { id: uid('AST'), name: name.trim(), serial: serial.trim(), notes: notes.trim(), createdAt: at, updatedAt: at };
      const event: Activity = { id: uid('ACT'), assetId: asset.id, type: 'added', person: 'Local operator', at, description: 'Equipment registered' };
      return { ...d, assets: [asset, ...d.assets], activities: [event, ...d.activities], notices: [notice('success', 'Equipment added', 'Equipment added to inventory successfully.', asset.id), ...d.notices] };
    }, 'notification');
  }
  async function importInventory(preview: InventoryImportPreview, batchId: string): Promise<InventoryImportResult> {
    const completed: { result?: InventoryImportResult } = {};
    const next = await commit(d => {
      operator(d);
      const batch = buildInventoryImport(d, preview, batchId, new Date().toISOString(), prefix => `${prefix}-${randomUUID()}`);
      completed.result = batch.result;
      if (batch.result.alreadyCompleted) return d;
      return { ...batch.next, notices: [notice('success', 'Inventory Import Completed Successfully.', `${batch.result.imported} imported · ${batch.result.duplicatesSkipped} duplicates skipped · ${batch.result.invalidRows} invalid rows · ${batch.result.totalProcessed} processed.`), ...d.notices] };
    });
    const result = completed.result;
    if (!result) throw new Error('Unable to confirm the saved import result.');
    if (!result.alreadyCompleted && next.settings.enabled) void playAlert('notification', next.settings.notificationVolume);
    return result;
  }
  async function editAsset(id: string, name: string, serial: string, notes: string, password: string, requestId: string) {
    await commit(async d => {
      operator(d); validateAsset(d, name, serial, notes, id);
      const original = d.assets.find(asset => asset.id === id);
      if (!original || original.archivedAt) throw new Error('This equipment is unavailable for editing.');
      const approved = await authorizeAssetEdit(original, { name, serial, notes }, password, requestId);
      const at = new Date().toISOString();
      const event: Activity = { id: uid('ACT'), assetId: id, type: 'edit', person: 'Password-authorized local operator', at, description: 'Equipment details updated with server authorization' };
      return { ...d, assets: d.assets.map(asset => asset.id === id ? approved : asset), activities: [event, ...d.activities], notices: [notice('success', 'Equipment updated', 'Equipment details updated successfully.', id), ...d.notices] };
    }, 'notification');
  }
  async function prepareArchive(kind: ArchiveKind, id: string, password: string): Promise<ArchiveApproval> {
    if (!ready.current) throw new Error('Device records are not ready. Please retry loading.');
    if (lock.current) throw new Error('Another operation is in progress. Please try again.');
    operator(current.current);
    const snapshot = archiveSnapshot(current.current, kind, id);
    const approval = await authorizeArchive(snapshot, password);
    operator(current.current);
    if (archiveFingerprint(archiveSnapshot(current.current, kind, id)) !== approval.fingerprint) throw new Error('This record changed during authorization. Review it and enter the password again.');
    return approval;
  }
  async function archiveRecord(approval: ArchiveApproval) {
    await commit(async d => {
      operator(d);
      const snapshot = archiveSnapshot(d, approval.kind, approval.recordId);
      if (archiveFingerprint(snapshot) !== approval.fingerprint) throw new Error('This record changed after authorization. Review it and enter the password again.');
      const confirmed = await confirmArchive(approval);
      return applyArchive(d, confirmed);
    });
    // Playback policy observes persisted archival; archival never fabricates a return.
  }
  async function withdraw(input: WithdrawalInput) { const next = await commit(d => { operator(d); if (!input.releaser.trim()) throw new Error('Releaser name is required.'); if (!input.receiver.trim()) throw new Error('Receiver name is required.'); if (!input.signature.some(stroke => stroke.length > 2)) throw new Error('Receiver signature is required.'); if (!Number.isFinite(Date.parse(input.withdrawalAt))) throw new Error('Please select a valid withdrawal date.'); if (!Number.isFinite(Date.parse(input.dueAt)) || Date.parse(input.dueAt) <= Date.parse(input.withdrawalAt)) throw new Error('Due date must be later than the withdrawal date and time.'); if (Date.parse(input.withdrawalAt) > Date.now() + 60000) throw new Error('Withdrawal date cannot be in the future.'); let assets = d.assets, assetId = input.assetId; const at = new Date().toISOString(); if (input.manual) { if (!input.name.trim()) throw new Error('Equipment name is required.'); if (!input.serial.trim()) throw new Error('Serial/Product ID is required.'); if (!input.manualNotes.trim()) throw new Error('Notes are required.'); const existing = d.assets.find(a => a.serial.trim().toLowerCase() === input.serial.trim().toLowerCase()); if (existing) { if (existing.archivedAt) throw new Error('This asset is archived.'); if (existing.name.toLowerCase() !== input.name.trim().toLowerCase()) throw new Error('Serial/Product ID belongs to another equipment name.'); assetId = existing.id; } else { assetId = uid('AST'); assets = [{ id: assetId, name: input.name.trim(), serial: input.serial.trim(), notes: input.manualNotes.trim(), createdAt: at, updatedAt: at }, ...assets]; } }
    if (!assets.some(a => a.id === assetId && !a.archivedAt)) throw new Error('Please select equipment from inventory.'); if (d.withdrawals.some(w => w.assetId === assetId && isActive(w))) throw new Error('This equipment is already withdrawn.'); const w: Withdrawal = { id: uid('WD'), assetId, releaser: input.releaser.trim(), receiver: input.receiver.trim(), signature: input.signature, withdrawalAt: input.withdrawalAt, dueAt: input.dueAt, notes: input.notes.trim(), createdAt: at }; const event: Activity = { id: uid('ACT'), assetId, transactionId: w.id, type: 'withdrawal', person: w.receiver, at, description: 'Equipment released' }; return { ...d, assets, withdrawals: [w, ...d.withdrawals], activities: [event, ...d.activities], notices: [notice('success', 'Withdrawal confirmed', 'Equipment withdrawal recorded successfully.', assetId, w.id), ...d.notices] }; }, 'withdrawal'); return next.withdrawals[0]; }
  async function returnEquipment(id: string, input: ReturnInput) {
    const next = await commit(d => {
      operator(d);
      const at = new Date().toISOString();
      const returned = buildEquipmentReturn(d.withdrawals.find(x => x.id === id), input, at);
      const event: Activity = { id: uid('ACT'), assetId: returned.assetId, transactionId: id, type: 'return', person: returned.returning!, at, description: 'Equipment returned; receiving personnel signature captured' };
      return { ...d, withdrawals: d.withdrawals.map(x => x.id === id ? returned : x), activities: [event, ...d.activities],
        notices: [notice('success', 'Return confirmed', 'Equipment returned successfully with receiving personnel signature.', returned.assetId, id),
          ...d.notices.map(n => n.withdrawalId === id && (n.type === 'due' || n.type === 'overdue') ? { ...n, acknowledged: true } : n)] };
    }, 'return');
    const returned = next.withdrawals.find(w => w.id === id);
    if (!returned) throw new Error('The saved return record could not be found.');
    return returned;
  }
  async function updateSettings(patch: Partial<Settings>) {
    await commit(d => ({ ...d, settings: { ...d.settings, ...patch,
      notificationVolume: clampVolume(patch.notificationVolume ?? d.settings.notificationVolume),
      alarmVolume: clampVolume(patch.alarmVolume ?? d.settings.alarmVolume), audioPreferencesVersion: 2 } }));
  }
  async function acknowledgeOverdue() {
    await commit(d => {
      const at = new Date().toISOString();
      const ids = pendingOverdueIds(d.withdrawals, d.notices, Date.parse(at));
      const result = recordAlarmAcknowledgement(d, ids, at, uid('ACT'), 'alarm-control');
      return { ...d, withdrawals: result.withdrawals, notices: result.notices, activities: result.activities };
    });
  }
  async function updateNotices(action: 'read' | 'dismiss' | 'acknowledge' | 'clear', id?: string) {
    await commit(d => {
      const selected = d.notices.filter(n => !id || n.id === id);
      const silenced = selected.filter(n => n.type === 'overdue' && (action === 'acknowledge' || action === 'dismiss') && n.withdrawalId).map(n => n.withdrawalId as string);
      const at = new Date().toISOString();
      const result = recordAlarmAcknowledgement(d, silenced, at, uid('ACT'), action === 'dismiss' ? 'notification-dismiss' : 'notification-acknowledge');
      return { ...d, withdrawals: result.withdrawals, activities: result.activities,
        notices: action === 'clear' ? result.notices.filter(n => !n.read || ((n.type === 'overdue' || n.type === 'due') && !n.acknowledged && d.withdrawals.some(w => w.id === n.withdrawalId && isActive(w))))
          : result.notices.map(n => !id || n.id === id ? { ...n, read: true, acknowledged: action === 'acknowledge' || action === 'dismiss' ? true : n.acknowledged } : n) };
    });
  }
  return <TrackerContext.Provider value={{ data, now, loaded, error, busy, retry, addAsset, importInventory, editAsset, withdraw, returnEquipment, prepareArchive, archiveRecord, updateSettings, acknowledgeOverdue, updateNotices }}>{children}</TrackerContext.Provider>;
}
