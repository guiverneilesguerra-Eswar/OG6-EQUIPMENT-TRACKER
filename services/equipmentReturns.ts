import type { Signature, Withdrawal } from './tracker';

export interface ReturnInput {
  returning: string;
  receiving: string;
  condition: string;
  remarks: string;
  receivingSignature: Signature;
}

export function validateReceivingSignature(value: unknown): asserts value is Signature {
  if (!Array.isArray(value) || !value.length || value.length > 300) throw new Error('Receiving personnel signature is required. Please sign and save it.');
  let points = 0;
  let usable = false;
  for (const stroke of value) {
    if (!Array.isArray(stroke) || !stroke.length) throw new Error('Invalid receiving personnel signature. Please sign again.');
    points += stroke.length;
    if (stroke.length > 2) usable = true;
    for (const point of stroke) {
      if (!point || typeof point.x !== 'number' || typeof point.y !== 'number' || !Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < 0 || point.x > 500 || point.y < 0 || point.y > 180 || Object.keys(point).some(key => !['x', 'y'].includes(key))) {
        throw new Error('Invalid receiving personnel signature. Please sign again.');
      }
    }
  }
  if (!usable) throw new Error('Receiving personnel signature is required. Please sign and save it.');
  if (points > 15000) throw new Error('The signature is too large. Clear it and sign again.');
}

// A return creates its own signature evidence; never overwrite withdrawal evidence.
export function buildEquipmentReturn(withdrawal: Withdrawal | undefined, input: ReturnInput, at: string): Withdrawal {
  if (!withdrawal || withdrawal.returnedAt || withdrawal.deletedAt) throw new Error('This withdrawal is no longer active.');
  if (!input.returning.trim()) throw new Error('Returning personnel name is required.');
  if (!input.receiving.trim()) throw new Error('Receiving personnel name is required.');
  if (!input.condition.trim()) throw new Error('Equipment condition is required.');
  validateReceivingSignature(input.receivingSignature);
  if (!Number.isFinite(Date.parse(at))) throw new Error('Invalid return timestamp.');
  return { ...withdrawal, returnedAt: at, alarmAcknowledgedAt: at,
    returning: input.returning.trim(), receiving: input.receiving.trim(), condition: input.condition.trim(), remarks: input.remarks.trim(),
    receivingSignature: input.receivingSignature.map(stroke => stroke.map(point => ({ x: point.x, y: point.y }))), receivingSignatureAt: at };
}
