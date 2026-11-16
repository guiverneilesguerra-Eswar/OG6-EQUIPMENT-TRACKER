import type { Signature } from './tracker';
import type { ReturnRecord } from './movements';

// New return events require a bounded handwritten signature. Historical records
// may omit this field; never fabricate one or reuse the withdrawal signature.
export function validateReturnSignature(value: unknown): asserts value is Signature {
  if (!Array.isArray(value) || value.length > 500) throw new Error('Returning personnel signature is invalid or too large. Clear it and sign again.');
  let points = 0; let signed = false;
  for (const stroke of value) {
    if (!Array.isArray(stroke)) throw new Error('Returning personnel signature is invalid.');
    points += stroke.length;
    if (points > 20000) throw new Error('Returning personnel signature is too large. Clear it and sign again.');
    for (const point of stroke) {
      if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < 0 || point.x > 500 || point.y < 0 || point.y > 180) throw new Error('Returning personnel signature contains invalid coordinates.');
    }
    if (stroke.length > 2 && stroke.some(point => point.x !== stroke[0].x || point.y !== stroke[0].y)) signed = true;
  }
  if (!signed) throw new Error('Returning personnel signature is required. Please sign and save the signature.');
}
export function copyReturnSignature(value: Signature): Signature {
  return value.map(stroke => stroke.map(point => ({ x: point.x, y: point.y })));
}
// One signature per signer/event on complete receipts, not once per equipment.
export function returnSignatureEntries(records: ReturnRecord[]): ReturnRecord[] {
  const seen = new Set<string>();
  return records.filter(record => {
    const key = JSON.stringify([record.reference, record.at, record.returning, record.returnSignature || null]);
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}
