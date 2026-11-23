import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
const encoder = new TextEncoder();
const iterations = 600000;
const hex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
export async function hashEditToken(value: string) { return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))); }
export async function deriveEditPassword(value: string, saltHex: string, rounds = iterations): Promise<string> {
  const salt = Uint8Array.from(saltHex.match(/.{2}/g) || [], v => parseInt(v, 16));
  const key = await crypto.subtle.importKey('raw', encoder.encode(value), 'PBKDF2', false, ['deriveBits']);
  return hex(new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: rounds, hash: 'SHA-256' }, key, 256)));
}
export function constantTimeEqual(a: string, b: string) { let difference = a.length ^ b.length; for (let i = 0; i < Math.max(a.length, b.length); i++) difference |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0); return difference === 0; }
export async function verifyEditPassword(admin: SupabaseClient, candidate: string): Promise<boolean> {
  // Bootstrap the existing administrator-configured edit password once. Only its
  // salted PBKDF2 hash is inserted. Existing secret may be removed after bootstrap;
  // both due-item and equipment edits then use this server-only hash exclusively.
  let { data, error } = await admin.from('og6_edit_credentials').select('salt,password_hash,iterations').eq('id', true).maybeSingle();
  if (error) throw new Error('Edit credential lookup unavailable.');
  if (!data) {
    const bootstrap = Deno.env.get('OG6_EDIT_PASSWORD');
    if (!bootstrap) throw new Error('Edit authorization is not configured.');
    const salt = hex(crypto.getRandomValues(new Uint8Array(32)));
    const password_hash = await deriveEditPassword(bootstrap, salt);
    const result = await admin.from('og6_edit_credentials').upsert({ id: true, salt, password_hash, iterations }, { onConflict: 'id', ignoreDuplicates: true });
    if (result.error) throw new Error('Edit credential initialization unavailable.');
    const stored = await admin.from('og6_edit_credentials').select('salt,password_hash,iterations').eq('id', true).single();
    if (stored.error || !stored.data) throw new Error('Edit credential lookup unavailable.');
    data = stored.data;
  }
  if (!/^[a-f0-9]{64}$/.test(data.salt) || !/^[a-f0-9]{64}$/.test(data.password_hash) || !Number.isSafeInteger(data.iterations) || data.iterations < iterations || data.iterations > 1000000) throw new Error('Invalid edit credential configuration.');
  return constantTimeEqual(data.password_hash, await deriveEditPassword(candidate, data.salt, data.iterations));
}
