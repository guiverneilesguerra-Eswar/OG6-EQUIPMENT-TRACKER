import { randomUUID } from 'expo-crypto';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/template';
import { installationId } from './authorizedEdits';
import { Activity, Asset, TrackerData, Withdrawal, isActive, notice, uid } from './tracker';

export type ArchiveKind = 'asset' | 'withdrawal';
export interface ArchiveSnapshot { kind: ArchiveKind; recordId: string; asset: Asset; withdrawal: Withdrawal | null; activeWithdrawalIds: string[] }
export interface ArchiveApproval { authorizationId: string; token: string; expiresAt: string; kind: ArchiveKind; recordId: string; fingerprint: string }
export interface ArchiveConfirmation { authorizationId: string; kind: ArchiveKind; recordId: string; archivedAt: string }

// Fixed property ordering makes stale-record detection independent of object key order.
export function archiveSnapshot(data: TrackerData, kind: ArchiveKind, recordId: string): ArchiveSnapshot {
  const withdrawal = kind === 'withdrawal' ? data.withdrawals.find(item => item.id === recordId) : null;
  if (kind === 'withdrawal' && (!withdrawal || withdrawal.deletedAt)) throw new Error('This withdrawal is no longer available for archival.');
  const asset = data.assets.find(item => item.id === (kind === 'asset' ? recordId : withdrawal?.assetId));
  if (!asset || (kind === 'asset' && asset.archivedAt)) throw new Error('This equipment is no longer available for archival.');
  const activeWithdrawalIds = data.withdrawals.filter(item => item.assetId === asset.id && isActive(item)).map(item => item.id).sort();
  if (kind === 'asset' && activeWithdrawalIds.length) throw new Error('This equipment is currently withdrawn and cannot be deleted until it is returned or the transaction is properly resolved.');
  const snapshot: ArchiveSnapshot = { kind, recordId,
    asset: { id: asset.id, name: asset.name, serial: asset.serial, notes: asset.notes, createdAt: asset.createdAt, updatedAt: asset.updatedAt, ...(asset.archivedAt ? { archivedAt: asset.archivedAt } : {}) },
    withdrawal: withdrawal ? { id: withdrawal.id, assetId: withdrawal.assetId, releaser: withdrawal.releaser, receiver: withdrawal.receiver, signature: withdrawal.signature, withdrawalAt: withdrawal.withdrawalAt, dueAt: withdrawal.dueAt, createdAt: withdrawal.createdAt, notes: withdrawal.notes,
      ...(withdrawal.returnedAt ? { returnedAt: withdrawal.returnedAt } : {}), ...(withdrawal.returning ? { returning: withdrawal.returning } : {}), ...(withdrawal.receiving ? { receiving: withdrawal.receiving } : {}), ...(withdrawal.condition ? { condition: withdrawal.condition } : {}), ...(withdrawal.remarks ? { remarks: withdrawal.remarks } : {}) } : null,
    activeWithdrawalIds };
  if (JSON.stringify(snapshot).length > 100000) throw new Error('This record is too large for secure archival. Contact the administrator; no data was changed.');
  return snapshot;
}
export function archiveFingerprint(snapshot: ArchiveSnapshot) { return JSON.stringify(snapshot); }
async function invokeArchive(body: object) {
  let result;
  try { result = await getSupabaseClient().functions.invoke('og6-authorize-archive', { body }); }
  catch { throw new Error('Unable to reach administrator authorization. Check your connection. No local records were changed.'); }
  const { data, error } = result;
  if (error) {
    let message = 'Unable to authorize archival. Check your connection and try again. No local records were changed.';
    if (error instanceof FunctionsHttpError) {
      try { const status = error.context?.status ?? 500; const raw = await error.context.text(); const parsed = JSON.parse(raw);
        if ([400, 403, 409, 413, 429, 503].includes(status) && typeof parsed.error === 'string') message = parsed.error;
      } catch { /* Never display raw gateway/database responses. */ }
    }
    throw new Error(message);
  }
  if (typeof data?.error === 'string') throw new Error(data.error);
  return data;
}
export async function authorizeArchive(snapshot: ArchiveSnapshot, password: string): Promise<ArchiveApproval> {
  if (!password) throw new Error('Administrator password is required.');
  if (password.length > 1024) throw new Error('Administrator password is too long.');
  const authorizationId = randomUUID();
  const data = await invokeArchive({ phase: 'authorize', authorizationId, installationId: await installationId(), password, snapshot });
  if (data?.authorizationId !== authorizationId || !/^[a-f0-9]{64}$/.test(data?.token ?? '') || !Number.isFinite(Date.parse(data?.expiresAt)) || Date.parse(data.expiresAt) <= Date.now()) throw new Error('Invalid administrator authorization response. No records were changed.');
  return { authorizationId, token: data.token, expiresAt: data.expiresAt, kind: snapshot.kind, recordId: snapshot.recordId, fingerprint: archiveFingerprint(snapshot) };
}
export async function confirmArchive(approval: ArchiveApproval): Promise<ArchiveConfirmation> {
  const data = await invokeArchive({ phase: 'confirm', authorizationId: approval.authorizationId, installationId: await installationId(), token: approval.token });
  if (data?.authorizationId !== approval.authorizationId || data?.kind !== approval.kind || data?.recordId !== approval.recordId || !Number.isFinite(Date.parse(data?.archivedAt))) throw new Error('Invalid archival confirmation. No local records were changed.');
  return { authorizationId: data.authorizationId, kind: data.kind, recordId: data.recordId, archivedAt: data.archivedAt };
}
export function applyArchive(data: TrackerData, confirmation: ArchiveConfirmation): TrackerData {
  const snapshot = archiveSnapshot(data, confirmation.kind, confirmation.recordId);
  const at = confirmation.archivedAt;
  const event: Activity = { id: uid('ACT'), assetId: snapshot.asset.id, ...(snapshot.withdrawal ? { transactionId: snapshot.withdrawal.id } : {}), type: 'archive', person: 'Administrator-password authorized operator', at,
    description: confirmation.kind === 'asset' ? 'Equipment archived with server authorization' : 'Withdrawal archived with server authorization; original history retained', authorizationId: confirmation.authorizationId };
  return { ...data,
    assets: confirmation.kind === 'asset' ? data.assets.map(item => item.id === confirmation.recordId ? { ...item, archivedAt: at, updatedAt: at } : item) : data.assets,
    withdrawals: confirmation.kind === 'withdrawal' ? data.withdrawals.map(item => item.id === confirmation.recordId ? { ...item, deletedAt: at } : item) : data.withdrawals,
    activities: [event, ...data.activities],
    notices: [notice('success', 'Record archived', 'Administrator-authorized archival completed. Original records and history are retained.', snapshot.asset.id, snapshot.withdrawal?.id), ...data.notices.map(item => (confirmation.kind === 'asset' ? item.assetId === snapshot.asset.id : item.withdrawalId === snapshot.withdrawal?.id) && ['due', 'overdue'].includes(item.type) ? { ...item, read: true, acknowledged: true } : item)] };
}
