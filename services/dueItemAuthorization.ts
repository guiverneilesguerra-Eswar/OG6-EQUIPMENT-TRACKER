import { randomUUID } from 'expo-crypto';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/template';
import { installationId } from './authorizedEdits';
import { dueSnapshotKey, parseDueSnapshot } from '../supabase/functions/_shared/dueItemValidation';
import type { DueItemChanges, DueItemSnapshot, DueEditAudit } from './dueItemEdits';
export interface DueEditApproval { id: string; token: string; expiresAt: string; before: DueItemSnapshot; actor: string }
async function invoke(body: object) {
  let result;
  try { result = await getSupabaseClient().functions.invoke('og6-authorize-due-item', { body: { ...body, installationId: await installationId() } }); }
  catch { throw new Error('Unable to reach edit authorization. Check your internet connection. No records were changed.'); }
  if (result.error) {
    let message = 'Edit authorization failed. No records were changed.';
    if (result.error instanceof FunctionsHttpError) {
      try { const raw = await result.error.context.text(); const parsed = JSON.parse(raw); if (typeof parsed.error === 'string') message = parsed.error; } catch { /* Never expose raw gateway responses. */ }
    }
    throw new Error(message);
  }
  if (typeof result.data?.error === 'string') throw new Error(result.data.error);
  return result.data;
}
export async function authorizeDueItem(before: DueItemSnapshot, actor: string, password: string): Promise<DueEditApproval> {
  if (!password || password.length > 1024) throw new Error('Enter the existing equipment edit password.');
  if (!actor.trim() || actor.trim().length > 200) throw new Error('Enter the authorizing operator name (1–200 characters).');
  const id = randomUUID(); const data = await invoke({ phase: 'authorize', id, before, actor: actor.trim(), password });
  if (data?.id !== id || !/^[a-f0-9]{64}$/.test(data?.token || '') || data.actor !== actor.trim() || !Number.isFinite(Date.parse(data.expiresAt)) || Date.parse(data.expiresAt) <= Date.now() || dueSnapshotKey(parseDueSnapshot(data.before)) !== dueSnapshotKey(before)) throw new Error('Invalid scoped edit authorization. No records were changed.');
  return { id, token: data.token, expiresAt: data.expiresAt, before, actor: data.actor };
}
export async function confirmDueItem(approval: DueEditApproval, changes: DueItemChanges): Promise<DueEditAudit> {
  if (Date.parse(approval.expiresAt) <= Date.now()) throw new Error('Edit approval expired. Reopen Edit and verify the password again.');
  const data = await invoke({ phase: 'confirm', id: approval.id, token: approval.token, changes });
  const before = parseDueSnapshot(data?.before); const approved = parseDueSnapshot(data?.approved);
  if (data?.id !== approval.id || data.actor !== approval.actor || !Number.isFinite(Date.parse(data?.at)) || dueSnapshotKey(before) !== dueSnapshotKey(approval.before) || dueSnapshotKey(approved) !== dueSnapshotKey({ ...approval.before, ...changes })) throw new Error('Invalid edit completion. No records were changed.');
  return { id: data.id, before, approved, actor: data.actor, at: data.at };
}
