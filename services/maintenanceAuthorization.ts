import { FunctionsHttpError } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/template';
import { digestStringAsync, CryptoDigestAlgorithm, randomUUID } from 'expo-crypto';
import { installationId } from './authorizedEdits';
export type MaintenanceAction = 'restore' | 'names';
export async function authorizeMaintenance(action: MaintenanceAction, payload: string, password: string) {
  if (!password || password.length > 1024) throw new Error('Enter the administrator password.');
  const requestId = randomUUID();
  const fingerprint = await digestStringAsync(CryptoDigestAlgorithm.SHA256, payload);
  const { data, error } = await getSupabaseClient().functions.invoke('og6-authorize-maintenance', { body: { action, fingerprint, requestId, installationId: await installationId(), password } });
  if (error) {
    let message = 'Administrator authorization failed. Check your connection; no records were changed.';
    if (error instanceof FunctionsHttpError) { try { const text = await error.context.text(); const parsed = JSON.parse(text); if (typeof parsed.error === 'string') message = parsed.error; } catch {} }
    throw new Error(message);
  }
  if (data?.requestId !== requestId || data?.fingerprint !== fingerprint || data?.action !== action || Date.parse(data?.expiresAt) <= Date.now() || !Number.isFinite(Date.parse(data?.expiresAt))) throw new Error('Invalid administrator approval; no records were changed.');
  return { id: requestId, expiresAt: data.expiresAt as string };
}
