import type { Withdrawal } from './tracker';
export function isActive(w:Withdrawal){return!w.returnedAt&&!w.deletedAt&&(w.quantity??1)>(w.returnedQuantity??0);}
export function manilaParts(value:string|Date=new Date()){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value));const get=(t:string)=>parts.find(p=>p.type===t)?.value||'00';return{date:`${get('year')}-${get('month')}-${get('day')}`,time:`${get('hour')}:${get('minute')}`};
}
