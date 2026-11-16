import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { validDestination, sendPush } from '../_shared/pushDelivery.ts';
import type { ReminderLoan, ReminderPreferences } from '../_shared/reminderPolicy.ts';
const encoder = new TextEncoder();
const hash = async (v: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(v))), b => b.toString(16).padStart(2, '0')).join('');
const response = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
function validateSnapshot(value: unknown): ReminderLoan[] {
 if (!Array.isArray(value) || value.length > 1000) throw new Error('At most 1,000 active equipment records can be synchronized.');
 const seen = new Set<string>();
 return value.map(w => {
  for (const field of ['id','assetId','name','receiver','releaser','reference']) if (typeof w?.[field] !== 'string' || !w[field].trim() || w[field].length > 500) throw new Error('Invalid reminder record.');
  if (seen.has(w.id)) throw new Error('Duplicate reminder equipment.'); seen.add(w.id);
  if (!Number.isFinite(Date.parse(w.withdrawalAt)) || !Number.isFinite(Date.parse(w.dueAt)) || Date.parse(w.dueAt) <= Date.parse(w.withdrawalAt) || !Number.isSafeInteger(w.quantity) || w.quantity < 1 || w.quantity > 1000000) throw new Error('Invalid reminder dates or quantity.');
  return { id:w.id,assetId:w.assetId,name:w.name,receiver:w.receiver,releaser:w.releaser,reference:w.reference,withdrawalAt:w.withdrawalAt,dueAt:w.dueAt,quantity:w.quantity };
 });
}
function preferences(v: ReminderPreferences): ReminderPreferences {
 if (!v || typeof v.enabled !== 'boolean' || typeof v.advance !== 'boolean' || typeof v.daily !== 'boolean' || ![12,24,48].includes(v.warningHours) || !['default','silent'].includes(v.sound)) throw new Error('Invalid notification preferences.');
 return { enabled:v.enabled,advance:v.advance,daily:v.daily,warningHours:v.warningHours,sound:v.sound };
}
Deno.serve(async req => {
 if (req.method === 'OPTIONS') return new Response(null,{status:204,headers:corsHeaders});
 if (req.method !== 'POST') return response(405,{error:'Use POST.'});
 try {
  const raw = await req.text(); if (encoder.encode(raw).length > 800000) return response(413,{error:'Reminder snapshot too large. No records were changed.'});
  const b = JSON.parse(raw);
  const admin = createClient(Deno.env.get('SUPABASE_URL') || '',Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',{auth:{persistSession:false,autoRefreshToken:false}});
  if (b.action === 'public-config') return response(200,{ publicKey:Deno.env.get('WEB_PUSH_VAPID_PUBLIC_KEY') || null, scheduler:'external-required' });
  if (!/^[a-f0-9-]{36}$/i.test(b.deviceId || '') || !/^[a-f0-9]{64}$/.test(b.deviceToken || '')) return response(400,{error:'Invalid device authorization.'});
  const digest = await hash(b.deviceToken);
  if (b.action === 'register') {
   if (!validDestination(b.destination) || typeof b.password !== 'string' || !b.password || b.password.length > 1024) return response(400,{error:'Valid destination and administrator password required.'});
   const address=(req.headers.get('x-forwarded-for')?.split(',').at(-1) || 'unknown').trim().slice(0,256);
   const bucket=await hash(`og6-push-register:${address}`);
   const reserved=await admin.rpc('og6_reserve_edit_attempt',{p_bucket_key:bucket});
   if (reserved.error || !reserved.data) return response(429,{error:'Authorization unavailable or too many attempts. Retry in 15 minutes.'});
   const expected=Deno.env.get('OG6_ADMIN_PASSWORD');
   if (!expected) return response(503,{error:'Administrator authorization is not configured.'});
   const [a,c]=await Promise.all([hash(expected),hash(b.password)]);let diff=0;for(let i=0;i<a.length;i++) diff|=a.charCodeAt(i)^c.charCodeAt(i);
   if(diff) return response(403,{error:'Incorrect administrator password.'});
   const snapshot=validateSnapshot(b.snapshot);const prefs=preferences(b.preferences);
   if (!Number.isSafeInteger(b.revision) || b.revision < 0) return response(400,{error:'Invalid registration revision.'});
   const {error}=await admin.from('og6_push_devices').upsert({id:b.deviceId,token_digest:digest,destination:b.destination,preferences:prefs,snapshot,revision:b.revision,enabled:prefs.enabled,synced_at:new Date().toISOString()});
   if(error) throw new Error('Unable to register notification delivery.');
   await admin.rpc('og6_release_edit_attempt',{p_bucket_key:bucket});
   return response(200,{registered:true,scheduler:'external-required'});
  }
  const {data:device,error}=await admin.from('og6_push_devices').select('*').eq('id',b.deviceId).eq('token_digest',digest).maybeSingle();
  if(error || !device) return response(403,{error:'Device notification authorization expired. Reauthorize in Settings.'});
  if(b.action==='sync') {
   const snapshot=validateSnapshot(b.snapshot);const prefs=preferences(b.preferences);
   if(!Number.isSafeInteger(b.revision) || b.revision<0) return response(400,{error:'Invalid snapshot revision.'});
   const result=await admin.rpc('og6_sync_push_device',{p_device:b.deviceId,p_digest:digest,p_snapshot:snapshot,p_preferences:prefs,p_revision:b.revision});
   if(result.error || !result.data) return response(409,{error:'Reminder sync was superseded. Retry the latest device snapshot.'});
   return response(200,{synced:true});
  }
  if(b.action==='test') {
   const key=`test:${Math.floor(Date.now()/60000)}`;
   const claim=await admin.from('og6_push_events').insert({device_id:b.deviceId,event_key:key});
   if(claim.error) return response(429,{error:'Wait one minute before testing again.'});
   try {
    const result=await sendPush(device.destination,{title:'OG6 EQUIPMENT TRACKER – DELIVERY TEST',body:'Server push test. Confirm this notification appears on your device. Provider acceptance does not confirm device delivery.',data:{status:'ACTIVE',eventKey:key}},device.preferences.sound);
    await admin.from('og6_push_events').update(result).eq('device_id',b.deviceId).eq('event_key',key);
    return response(200,{accepted:true});
   } catch { return response(502,{error:'Push provider rejected the test. Check credentials, permissions and build configuration.'}); }
  }
  if(b.action==='status') {
   const {data:events}=await admin.from('og6_push_events').select('event_key,state,created_at').eq('device_id',b.deviceId).order('created_at',{ascending:false}).limit(5);
   const {data:scheduler}=await admin.from('og6_push_scheduler').select('last_run,last_status').eq('id',true).maybeSingle();
   return response(200,{syncedAt:device.synced_at,events:events || [],schedulerLastRun:scheduler?.last_run || null,schedulerLastStatus:scheduler?.last_status || null});
  }
  return response(400,{error:'Unsupported action.'});
 } catch(e) { console.error('OG6 push device operation failed.');return response(400,{error:e instanceof Error && !e.message.includes('JSON') ? e.message : 'Notification operation failed.'}); }
});
