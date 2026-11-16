import type { TrackerData, Withdrawal } from './tracker';
import type { BatchInput, ReturnMovementInput, ReturnRecord } from './movements';
import { buildBatch, buildReturns } from './movements';

// Retain the existing batches/batchId storage fields for portable-backup compatibility.
// They now describe ordinary withdrawal transactions, not a separate UI module.
export function getWithdrawalItems(data: TrackerData, withdrawal: Withdrawal): Withdrawal[] {
  const transaction = data.batches?.find(t => t.id === withdrawal.batchId || t.withdrawalIds.includes(withdrawal.id));
  if (transaction) {
    const byId = new Map(data.withdrawals.map(w => [w.id, w]));
    return transaction.withdrawalIds.map(id => {
      const item = byId.get(id);
      if (!item) throw new Error('This transaction has a missing equipment record. Restore a validated backup before generating its receipt.');
      return item;
    });
  }
  // Legacy single withdrawals do not require a fabricated transaction or migration.
  return withdrawal.reference ? data.withdrawals.filter(w => w.reference === withdrawal.reference) : [withdrawal];
}
export function getTransactionReturns(data: TrackerData, items: Withdrawal[]): ReturnRecord[] {
  const ids = new Set(items.map(w => w.id));
  return (data.returnRecords || []).filter(r => ids.has(r.withdrawalId)).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}
export function validateWithdrawalDraft(data: TrackerData, input: BatchInput, signatureSaved: boolean, at = new Date().toISOString()): void {
  if (!signatureSaved) throw new Error('Receiver signature is required. Please save the signature.');
  let counter = 0;
  // Validation constructs an isolated preview; it never registers equipment or names.
  buildBatch(data, input, at, prefix => `PREVIEW-${input.requestId}-${prefix}-${++counter}`);
}
export function validateReturnDraft(data: TrackerData, input: ReturnMovementInput, at = new Date().toISOString()): void {
  let counter = 0;
  buildReturns(data, input, at, prefix => `PREVIEW-${input.requestId}-${prefix}-${++counter}`);
}
export interface TransactionReceiptModel {
  reference: string; items: Withdrawal[]; first: Withdrawal; returns: ReturnRecord[]; returnReference?: string;
}
export function getTransactionReceiptModel(data: TrackerData, withdrawal: Withdrawal, kind: 'withdrawal' | 'return', returnReference?: string): TransactionReceiptModel {
  const items = getWithdrawalItems(data, withdrawal);
  const first = items[0];
  if (!first) throw new Error('No equipment records were found for this transaction.');
  const reference = first.reference || first.id;
  if (kind === 'withdrawal') return { reference, items, first, returns: [] };
  const events = getTransactionReturns(data, items);
  const selected = returnReference || events.find(r => r.withdrawalId === withdrawal.id)?.reference || events[0]?.reference;
  const returns = selected ? events.filter(r => r.reference === selected) : [];
  if (returns.length) return { reference, items, first, returns, returnReference: selected };
  if (!returnReference && withdrawal.returnedAt) {
    // Legacy returns retain their actual original timestamp and personnel.
    return { reference, items, first, returnReference: withdrawal.id, returns: [{ id: `legacy-${withdrawal.id}`, reference: withdrawal.id, withdrawalId: withdrawal.id, assetId: withdrawal.assetId, quantity: withdrawal.returnedQuantity ?? withdrawal.quantity ?? 1, at: withdrawal.returnedAt, returning: withdrawal.returning || '', receiving: withdrawal.receiving || '', condition: withdrawal.condition || '', remarks: withdrawal.remarks || '' }] };
  }
  throw new Error('The selected return event could not be found. No return receipt was generated.');
}
