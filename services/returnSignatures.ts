import type { Signature } from './tracker';
import type { ReturnRecord } from './movements';
export function validateReturnSignature(value: unknown): asserts value is Signature {
 if (!Array.isArray(value) || value.length > 500) throw new Error('Receiving personnel signature is invalid or too large. Clear it and sign again.');
 let points=0;let signed=false;
 for(const stroke of value) {
  if(!Array.isArray(stroke))throw new Error('Receiving personnel signature is invalid.');
  points+=stroke.length;if(points>20000)throw new Error('Receiving personnel signature is too large.');
  for(const point of stroke)if(!point || !Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x<0 || point.x>500 || point.y<0 || point.y>180)throw new Error('Receiving personnel signature contains invalid coordinates.');
  if(stroke.length>2 && stroke.some(p=>p.x!==stroke[0].x || p.y!==stroke[0].y))signed=true;
 }
 if(!signed)throw new Error('Receiving personnel signature is required. Please sign and save the signature.');
}
export function copyReturnSignature(value:Signature):Signature{return value.map(s=>s.map(p=>({x:p.x,y:p.y})));}
export function returnSigner(record: Pick<ReturnRecord,'receivingSignature'|'returnSignature'|'receiving'|'returning'>) {
 return { signature:record.receivingSignature || record.returnSignature, person:record.receivingSignature?record.receiving:record.returning, label:record.receivingSignature?'Receiving personnel signature':'Returning personnel signature (historical)' };
}
export function returnSignatureEntries(records:ReturnRecord[]):ReturnRecord[] {
 const seen=new Set<string>();return records.filter(record=>{const signer=returnSigner(record);const key=JSON.stringify([record.reference,record.at,signer.person,signer.signature || null]);if(seen.has(key))return false;seen.add(key);return true;});
}
