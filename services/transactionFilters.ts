import type { TrackerData,Withdrawal } from './tracker';
import { isActive,manilaParts } from './recordDates';
import { allReturnEvents } from './analytics';
export type TransactionNavigationFilters={from?:string;to?:string;receiver?:string;equipment?:string;returned?:string};
export function transactionListRows(data:TrackerData,status:string,query:string,now:number,hours:number,filters:TransactionNavigationFilters):Withdrawal[]{
 const assets=new Map(data.assets.map(a=>[a.id,a]));const text=query.trim().toLowerCase();const inRange=(at:string)=>{const date=manilaParts(at).date;return(!filters.from||date>=filters.from)&&(!filters.to||date<=filters.to);};
 const returnedIds=filters.returned==='events'?new Set(allReturnEvents(data).filter(r=>inRange(r.at)).map(r=>r.withdrawalId)):null;
 return data.withdrawals.filter(w=>{
  if(w.deletedAt)return false;const a=assets.get(w.assetId);
  if(!`${w.equipmentSnapshot?.name||a?.name||''} ${w.equipmentSnapshot?.serial||a?.serial||''} ${w.assetId} ${w.reference||w.id} ${w.receiver} ${w.releaser} ${w.withdrawalAt} ${w.dueAt}`.toLowerCase().includes(text))return false;
  if(filters.receiver&&w.receiver!==filters.receiver||filters.equipment&&w.assetId!==filters.equipment)return false;
  if(returnedIds?!returnedIds.has(w.id):!inRange(filters.returned==='true'&&w.returnedAt?w.returnedAt:w.withdrawalAt))return false;
  if(status==='ALL')return true;if(status==='RETURNED')return !!w.returnedAt;
  if(status==='OVERDUE')return isActive(w)&&Date.parse(w.dueAt)<=now;
  if(status==='DUE TODAY')return isActive(w)&&Date.parse(w.dueAt)>now&&manilaParts(w.dueAt).date===manilaParts(new Date(now)).date;
  if(status==='DUE SOON')return isActive(w)&&Date.parse(w.dueAt)>now&&Date.parse(w.dueAt)-now<=hours*3600000;
  if(status==='OUT')return isActive(w)&&Date.parse(w.dueAt)>now;
  return isActive(w);
 });
}
