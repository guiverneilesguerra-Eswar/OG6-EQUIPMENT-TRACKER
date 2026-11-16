import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { reminderEvents, reminderContent } from '../_shared/reminderPolicy.ts';
import { sendPush } from '../_shared/pushDelivery.ts';
const reply=(status:number,body:object)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json','Cache-Control':'no-store'}});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:corsHeaders});
 if(req.method!=='POST')return reply(405,{error:'Use POST.'});
 try {
  const text=await req.text();if(text.length>2048)return reply(413,{error:'Request too large.'});
  const b=JSON.parse(text);
  const admin=createClient(Deno.env.get('SUPABASE_URL') || '',Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',{auth:{persistSession:false,autoRefreshToken:false}});
  const check=await admin.rpc('og6_verify_push_scheduler',{p_secret:typeof b.schedulerSecret==='string'?b.schedulerSecret:''});
  if(check.error || !check.data)return reply(403,{error:'Scheduler authorization required.'});
  let accepted=0;let failed=0;let offset=0;
  while(true) {
   const {data:devices,error}=await admin.from('og6_push_devices').select('id,destination,preferences,snapshot').eq('enabled',true).order('id').range(offset,offset+49);
   if(error)throw new Error('Unable to load registered reminder devices.');
   if(!devices?.length)break;
   for(const device of devices) {
    const handled = new Set<string>();
    for(const event of reminderEvents(device.snapshot,device.preferences,Date.now())) {
     if (handled.has(event.loan.id)) continue;
     const claim=await admin.rpc('og6_claim_push_event',{p_device:device.id,p_key:event.key,p_withdrawal:event.loan.id,p_due:event.loan.dueAt});
     if(claim.error || !claim.data)continue;
     // Recheck after claiming so returned equipment is not intentionally dispatched from a stale scan.
     const latest=await admin.from('og6_push_devices').select('snapshot,enabled').eq('id',device.id).single();
     const active=latest.data?.enabled && latest.data.snapshot.some((w:{id:string;dueAt:string})=>w.id===event.loan.id && w.dueAt===event.loan.dueAt);
     if(!active) { await admin.from('og6_push_events').update({state:'cancelled'}).eq('device_id',device.id).eq('event_key',event.key);continue; }
     handled.add(event.loan.id);
     let result;
     try { result=await sendPush(device.destination,reminderContent(event),device.preferences.sound);accepted++; }
     catch { result={state:'failed-or-uncertain',detail:'Provider submission failed; not automatically retried to prevent duplicates.'};failed++; }
     await admin.from('og6_push_events').update(result).eq('device_id',device.id).eq('event_key',event.key);
    }
   }
   if(devices.length<50)break;offset+=50;
  }
  await admin.from('og6_push_scheduler').update({last_run:new Date().toISOString(),last_status:200}).eq('id',true);
  return reply(200,{accepted,failed});
 }catch{console.error('OG6 reminder dispatch failed.');return reply(500,{error:'Reminder dispatch failed.'});}
});
