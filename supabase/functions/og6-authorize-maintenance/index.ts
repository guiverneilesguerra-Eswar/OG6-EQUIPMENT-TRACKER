import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
const encoder = new TextEncoder();
const secret = Deno.env.get('OG6_ADMIN_PASSWORD');
const salt = crypto.getRandomValues(new Uint8Array(32));
async function derive(value: string) { const key = await crypto.subtle.importKey('raw', encoder.encode(value), 'PBKDF2', false, ['deriveBits']); return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256)); }
const expected = secret ? derive(secret) : null;
function response(status: number, body: object) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }); }
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return response(405, { error: 'Use POST.' });
  try {
    if (Number(req.headers.get('content-length') || 0) > 4096) return response(413, { error: 'Authorization request too large.' });
    const raw = await req.text(); if (encoder.encode(raw).length > 4096) return response(413, { error: 'Authorization request too large.' });
    const b = JSON.parse(raw);
    if (!['restore', 'names'].includes(b.action) || !/^[a-f0-9]{64}$/.test(b.fingerprint || '') || !/^[a-f0-9-]{36}$/i.test(b.requestId || '') || !/^[a-f0-9-]{36}$/i.test(b.installationId || '') || typeof b.password !== 'string' || b.password.length > 1024) return response(400, { error: 'Invalid authorization request.' });
    if (!expected) return response(503, { error: 'Administrator authorization is not configured.' });
    const admin = createClient(Deno.env.get('SUPABASE_URL') || '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '', { auth: { persistSession: false, autoRefreshToken: false } });
    const address = (req.headers.get('x-forwarded-for')?.split(',').at(-1) || req.headers.get('x-real-ip') || 'unknown').trim().slice(0, 256);
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(`og6-maintenance:${address}`)));
    const bucket = Array.from(hash, n => n.toString(16).padStart(2, '0')).join('');
    const { data: allowed, error } = await admin.rpc('og6_reserve_edit_attempt', { p_bucket_key: bucket });
    if (error) return response(503, { error: 'Authorization security service unavailable.' });
    if (!allowed) return response(429, { error: 'Too many attempts. Wait 15 minutes before retrying.' });
    const [known, supplied] = await Promise.all([expected, derive(b.password)]); let difference = 0;
    for (let i = 0; i < known.length; i++) difference |= known[i] ^ supplied[i];
    if (difference) return response(403, { error: 'Incorrect administrator password. No records were changed.' });
    const { error: auditError } = await admin.from('og6_maintenance_authorizations').insert({ id: b.requestId, installation_id: b.installationId, action: b.action, fingerprint: b.fingerprint });
    if (auditError) return response(503, { error: 'Unable to record administrator approval. No records were changed.' });
    await admin.rpc('og6_release_edit_attempt', { p_bucket_key: bucket });
    return response(200, { requestId: b.requestId, action: b.action, fingerprint: b.fingerprint, expiresAt: new Date(Date.now() + 120000).toISOString() });
  } catch { console.error('OG6 maintenance authorization failed.'); return response(500, { error: 'Administrator authorization failed; no records were changed.' }); }
});
