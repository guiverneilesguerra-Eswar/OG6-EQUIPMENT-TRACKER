import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { dueText, parseDueChanges, parseDueSnapshot } from '../_shared/dueItemValidation.ts';
import { hashEditToken, verifyEditPassword } from '../_shared/editCredential.ts';
const encoder = new TextEncoder();
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function response(status: number, body: object) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }); }
Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') return response(405, { error: 'Use POST.' });
  try {
    if (Number(request.headers.get('content-length') || 0) > 128000) return response(413, { error: 'Edit request is too large.' });
    const raw = await request.text();
    if (encoder.encode(raw).byteLength > 128000) return response(413, { error: 'Edit request is too large.' });
    let body;
    try { body = JSON.parse(raw); } catch { return response(400, { error: 'Invalid edit request.' }); }
    if (!body || typeof body !== 'object' || !uuid.test(body.id || '') || !uuid.test(body.installationId || '')) return response(400, { error: 'Invalid edit reference.' });
    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false, autoRefreshToken: false } });
    if (body.phase === 'authorize') {
      let before, actor, password;
      try { before = parseDueSnapshot(body.before); actor = dueText(body.actor, 'authorized operator name'); password = dueText(body.password, 'edit password', 1024); } catch (e) { return response(400, { error: e instanceof Error ? e.message : 'Invalid edit details.' }); }
      // Throttle by gateway address, not the caller-supplied installation ID.
      const address = (request.headers.get('x-forwarded-for')?.split(',').at(-1) || request.headers.get('x-real-ip') || 'gateway-unknown').trim().slice(0, 256);
      const bucket = await hashEditToken(`og6-edit:${address}`);
      const reserve = await admin.rpc('og6_reserve_edit_attempt', { p_bucket_key: bucket });
      if (reserve.error) return response(503, { error: 'Edit authorization is temporarily unavailable. No records were changed.' });
      if (!reserve.data) return response(429, { error: 'Too many edit attempts. Wait 15 minutes and try again.' });
      // Preserve password bytes exactly; never trim or log credentials.
      if (!await verifyEditPassword(admin, body.password)) return response(403, { error: 'Incorrect edit password. Original due date and records are unchanged.' });
      const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
      const expiresAt = new Date(Date.now() + 10 * 60000).toISOString();
      const saved = await admin.from('og6_due_edit_sessions').insert({ id: body.id, installation_id: body.installationId, token_digest: await hashEditToken(token), before_snapshot: before, operator_name: actor, expires_at: expiresAt });
      if (saved.error) return response(503, { error: 'Unable to create edit approval. Reopen the edit prompt and try again.' });
      const release = await admin.rpc('og6_release_edit_attempt', { p_bucket_key: bucket });
      if (release.error) console.error('OG6 due edit: attempt release unavailable.');
      return response(200, { id: body.id, before, actor, token, expiresAt });
    }
    if (body.phase !== 'confirm' || !/^[a-f0-9]{64}$/.test(body.token || '')) return response(400, { error: 'Invalid scoped edit approval.' });
    const { data: session, error: sessionError } = await admin.from('og6_due_edit_sessions').select('before_snapshot,expires_at,token_digest,installation_id').eq('id', body.id).single();
    const tokenDigest = await hashEditToken(body.token);
    if (sessionError || !session || session.token_digest !== tokenDigest || session.installation_id !== body.installationId || Date.parse(session.expires_at) <= Date.now()) return response(403, { error: 'Edit approval is invalid or expired. Verify the password again.' });
    let approved;
    try { const before = parseDueSnapshot(session.before_snapshot); approved = { ...before, ...parseDueChanges(body.changes, before.withdrawalAt) }; } catch (e) { return response(400, { error: e instanceof Error ? e.message : 'Invalid changes.' }); }
    const result = await admin.rpc('og6_complete_due_edit', { p_id: body.id, p_installation_id: body.installationId, p_token_digest: tokenDigest, p_approved: approved });
    if (result.error || !result.data) return response(409, { error: 'Unable to record this edit or conflicting retry. No local records were changed. Reopen the edit prompt.' });
    return response(200, result.data);
  } catch {
    // Never include credentials, signatures, tokens, request bodies or raw database errors.
    console.error('OG6 due item authorization failed.');
    return response(503, { error: 'Edit authorization unavailable. Check your connection/configuration. No local records were changed.' });
  }
});
