import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { parseArchiveRequest, RequestError } from './validation.ts';

const encoder = new TextEncoder();
const secret = Deno.env.get('OG6_ADMIN_PASSWORD');
const salt = crypto.getRandomValues(new Uint8Array(32));
async function derive(value: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(value), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256));
}
const expected = secret ? derive(secret) : null;
async function matches(candidate: string) {
  if (!expected) return false;
  const [known, supplied] = await Promise.all([expected, derive(candidate)]);
  let difference = 0;
  for (let i = 0; i < known.length; i += 1) difference |= known[i] ^ supplied[i];
  return difference === 0;
}
function hex(bytes: Uint8Array) { return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join(''); }
async function digest(value: string) { return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))); }
function response(status: number, body: object, extra: Record<string, string> = {}) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra } }); }
Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') return response(405, { error: 'Use POST for administrator authorization.' });
  try {
    if (Number(request.headers.get('content-length') || 0) > 128000) return response(413, { error: 'The archival request is too large.' });
    const raw = await request.text();
    if (encoder.encode(raw).byteLength > 128000) return response(413, { error: 'The archival request is too large.' });
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return response(400, { error: 'Invalid archival request.' }); }
    const input = parseArchiveRequest(body);
    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false, autoRefreshToken: false } });
    if (input.phase === 'confirm') {
      const { data, error } = await admin.rpc('og6_complete_archive', { p_authorization_id: input.authorizationId, p_installation_id: input.installationId, p_token_digest: await digest(input.token) });
      if (error || !data) { console.error('OG6 archival: confirmation audit unavailable.'); return response(503, { error: 'Unable to confirm archival. No local records were changed. Retry confirmation.' }); }
      if (data.error) return response(403, { error: data.error });
      return response(200, data);
    }
    if (!expected) return response(503, { error: 'Administrator deletion authorization is not configured. Contact the administrator.' });
    // Throttle by gateway address, not a freely changeable installation identifier.
    const address = (request.headers.get('x-forwarded-for')?.split(',').at(-1) || request.headers.get('x-real-ip') || 'gateway-unknown').trim().slice(0, 256);
    const bucket = await digest(`og6-archive:${address}`);
    const { data: admitted, error: rateError } = await admin.rpc('og6_reserve_edit_attempt', { p_bucket_key: bucket });
    if (rateError) { console.error('OG6 archival: rate limiter unavailable.'); return response(503, { error: 'Administrator authorization is temporarily unavailable. No records were changed.' }); }
    if (!admitted) return response(429, { error: 'Too many incorrect or simultaneous administrator attempts. Wait 15 minutes and try again.' }, { 'Retry-After': '900' });
    if (!await matches(input.password)) return response(403, { error: 'Incorrect administrator password. Access denied.' });
    const token = hex(crypto.getRandomValues(new Uint8Array(32)));
    const expiresAt = new Date(Date.now() + 120000).toISOString();
    const { error } = await admin.from('og6_archive_authorizations').insert({ authorization_id: input.authorizationId, installation_id: input.installationId, record_kind: input.snapshot.kind, record_id: input.snapshot.recordId, token_digest: await digest(token), before_snapshot: input.snapshot, expires_at: expiresAt });
    if (error) { console.error('OG6 archival: approval could not be recorded.'); return response(503, { error: 'Unable to record administrator authorization. No records were changed.' }); }
    const { error: releaseError } = await admin.rpc('og6_release_edit_attempt', { p_bucket_key: bucket });
    if (releaseError) console.error('OG6 archival: reservation release unavailable.');
    return response(200, { authorizationId: input.authorizationId, token, expiresAt });
  } catch (error) {
    if (error instanceof RequestError) return response(400, { error: error.message });
    // Never log bodies, passwords, approval tokens or raw database errors.
    console.error('OG6 archival: request failed.');
    return response(500, { error: 'Unable to authorize archival. No records were changed. Try again.' });
  }
});
