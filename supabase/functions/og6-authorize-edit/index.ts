import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { parseEditRequest, RequestError } from './validation.ts';

import { verifyEditPassword } from '../_shared/editCredential.ts';

const encoder = new TextEncoder();
/* Credential derivation and constant-time comparison are shared with due-item edits. */
async function bucketFor(request: Request) {
  // Use gateway forwarding information, never a caller-supplied installation ID, for throttling.
  const address = (request.headers.get('x-forwarded-for')?.split(',').at(-1)
    || request.headers.get('x-real-ip') || 'gateway-unknown').trim().slice(0, 256);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(`og6-edit:${address}`)));
  return Array.from(digest, b => b.toString(16).padStart(2, '0')).join('');
}
function response(status: number, body: object, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra },
  });
}
Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') return response(405, { error: 'Use POST to authorize an equipment edit.' });
  try {
    if (Number(request.headers.get('content-length') || 0) > 128000) return response(413, { error: 'The edit request is too large.' });
    const raw = await request.text();
    if (encoder.encode(raw).byteLength > 128000) return response(413, { error: 'The edit request is too large.' });
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return response(400, { error: 'Invalid edit request.' }); }
    const input = parseEditRequest(body);
    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const bucket = await bucketFor(request);
    const { data: admitted, error: rateError } = await admin.rpc('og6_reserve_edit_attempt', { p_bucket_key: bucket });
    if (rateError) {
      console.error('OG6 edit authorization: rate limiter unavailable.');
      return response(503, { error: 'Authorization is temporarily unavailable. No local records were changed.' });
    }
    if (!admitted) return response(429, { error: 'Too many incorrect or simultaneous edit attempts. Wait 15 minutes and try again.' }, { 'Retry-After': '900' });
    if (!await verifyEditPassword(admin, input.password)) return response(403, { error: 'Edit authorization failed. Check the password and try again.' });
    const approved = { ...input.before, ...input.changes, updatedAt: new Date().toISOString() };
    const { data, error } = await admin.rpc('og6_record_edit_authorization', {
      p_request_id: input.requestId, p_installation_id: input.installationId,
      p_before: input.before, p_approved: approved,
    });
    if (error || !data?.asset || data?.authorizationId !== input.requestId) {
      console.error('OG6 edit authorization: approval audit could not be recorded.');
      return response(503, { error: 'Unable to record edit authorization. No local records were changed. Retry the edit.' });
    }
    const { error: releaseError } = await admin.rpc('og6_release_edit_attempt', { p_bucket_key: bucket });
    if (releaseError) console.error('OG6 edit authorization: successful reservation release failed.');
    return response(200, data);
  } catch (error) {
    if (error instanceof RequestError) return response(400, { error: error.message });
    // Never log request bodies, credentials, tokens or raw database errors.
    console.error('OG6 edit authorization: request failed.');
    return response(500, { error: 'Unable to authorize the edit. No local records were changed. Please try again.' });
  }
});
