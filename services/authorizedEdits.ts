import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/template';
import { Asset } from './tracker';

export interface AssetChanges { name: string; serial: string; notes: string }
const installationKey = 'og6.edit.installation.v1';
let installationPromise: Promise<string> | null = null;
export async function installationId() {
  if (!installationPromise) {
    installationPromise = (async () => {
      const existing = await AsyncStorage.getItem(installationKey);
      if (existing) return existing;
      const id = randomUUID();
      await AsyncStorage.setItem(installationKey, id);
      return id;
    })().catch(error => { installationPromise = null; throw error; });
  }
  return installationPromise;
}
export function editRequestId() { return randomUUID(); }
export function validateEditChanges(changes: AssetChanges) {
  if (!changes.name.trim()) throw new Error('Equipment name is required.');
  if (!changes.serial.trim()) throw new Error('Serial/Product ID is required.');
  if (!changes.notes.trim()) throw new Error('Notes are required.');
  if (changes.name.trim().length > 200) throw new Error('Equipment name must be 200 characters or fewer.');
  if (changes.serial.trim().length > 200) throw new Error('Serial/Product ID must be 200 characters or fewer.');
  if (changes.notes.trim().length > 10000) throw new Error('Notes must be 10,000 characters or fewer.');
}
export async function authorizeAssetEdit(before: Asset, changes: AssetChanges, password: string, requestId: string): Promise<Asset> {
  validateEditChanges(changes);
  if (!password) throw new Error('Edit password is required.');
  if (password.length > 1024) throw new Error('The edit password is too long.');
  let result;
  try {
    result = await getSupabaseClient().functions.invoke('og6-authorize-edit', {
      body: { before, changes, password, requestId, installationId: await installationId() },
    });
  } catch {
    throw new Error('Unable to reach edit authorization. Check your connection. No local records were changed.');
  }
  const { data, error } = result;
  if (error) {
    let message = 'Unable to authorize the edit. Check your connection and try again. No local records were changed.';
    if (error instanceof FunctionsHttpError) {
      try {
        const status = error.context?.status ?? 500;
        const text = await error.context.text();
        const body = JSON.parse(text);
        if ([400, 403, 429, 503].includes(status) && typeof body.error === 'string') message = body.error;
      } catch { /* Do not expose arbitrary gateway responses or credentials. */ }
    }
    throw new Error(message);
  }
  const asset = data?.asset;
  if (typeof data?.error === 'string') throw new Error(data.error);
  if (!asset || data?.authorizationId !== requestId || asset.id !== before.id
    || asset.name !== changes.name.trim() || asset.serial !== changes.serial.trim()
    || asset.notes !== changes.notes.trim() || asset.createdAt !== before.createdAt
    || asset.archivedAt || typeof asset.updatedAt !== 'string' || !Number.isFinite(Date.parse(asset.updatedAt))) {
    throw new Error('Invalid edit authorization response. No local records were changed.');
  }
  return { id: asset.id, name: asset.name, serial: asset.serial, notes: asset.notes,
    createdAt: asset.createdAt, updatedAt: asset.updatedAt };
}
