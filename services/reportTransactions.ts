import type { Asset, Signature, Withdrawal } from './tracker';

export type ReportTransactionKind = 'withdrawal' | 'return';
// Optional existing explicit batch/evidence fields are read only. Current forms
// capture one item, the withdrawal receiver, and the receiving person on return.
// Missing evidence is never invented and transactions are never inferred by name/time.
export interface ReportWithdrawal extends Withdrawal {
  transactionId?: string;
  releaserSignature?: Signature; releaserSignatureAt?: string;
  returningSignature?: Signature; returningSignatureAt?: string;
}
export interface ReportSigner { name: string; signature?: Signature; capturedAt?: string }
export interface ReportTransaction {
  id: string; kind: ReportTransactionKind; at: string;
  releaser: ReportSigner; receiver: ReportSigner;
  items: { transactionRecordId: string; assetId: string; name: string; serial: string }[];
}
export function reportTransactions(records: readonly ReportWithdrawal[], assets: readonly Asset[], kind: ReportTransactionKind): ReportTransaction[] {
  const equipment = new Map(assets.map(asset => [asset.id, asset]));
  const groups = new Map<string, ReportTransaction>();
  for (const record of records) {
    if (record.deletedAt || (kind === 'return' && !record.returnedAt)) continue;
    const at = kind === 'return' ? record.returnedAt! : record.withdrawalAt;
    if (!Number.isFinite(Date.parse(at))) throw new Error(`Invalid ${kind} date for transaction ${record.id}. Existing records were not changed.`);
    const releaser: ReportSigner = kind === 'return'
      ? { name: record.receiving || '', signature: record.receivingSignature, capturedAt: record.receivingSignatureAt }
      : { name: record.releaser, signature: record.releaserSignature, capturedAt: record.releaserSignatureAt };
    const receiver: ReportSigner = kind === 'return'
      ? { name: record.returning || '', signature: record.returningSignature, capturedAt: record.returningSignatureAt }
      : { name: record.receiver, signature: record.signature };
    const id = record.transactionId?.trim() || record.id;
    // Split inconsistent batches rather than assigning one person's signature to
    // equipment with different dates, personnel, or captured evidence.
    const key = JSON.stringify([id, at, releaser, receiver]);
    let group = groups.get(key);
    if (!group) { group = { id, kind, at, releaser, receiver, items: [] }; groups.set(key, group); }
    const asset = equipment.get(record.assetId);
    group.items.push({ transactionRecordId: record.id, assetId: record.assetId, name: asset?.name || `Equipment record ${record.assetId}`, serial: asset?.serial || '' });
  }
  return Array.from(groups.values());
}
