import * as Print from 'expo-print';
import type { TrackerData, Withdrawal } from './tracker';
import { formatDate } from './tracker';
import type { ReceiptFile, ReceiptKind } from './receipts';
import { getTransactionReceiptModel } from './withdrawalTransactions';
import { remainingQuantity } from './movements';
import { getReturnSignatureBlocks, returnSignatureEntries } from './returnSignatures';
import { createSingleA4Document } from './singleA4Document';
import { createReceiptTextDocument } from './receiptText';
import type { A4Block, A4Signature } from './singleA4Document';

export function transactionReceiptContent(data: TrackerData, withdrawal: Withdrawal, kind: ReceiptKind, returnReference?: string) {
  const model = getTransactionReceiptModel(data, withdrawal, kind, returnReference);
  const { first, items, returns, reference } = model;
  const title = kind === 'return' ? 'EQUIPMENT RETURN RECEIPT' : 'EQUIPMENT WITHDRAWAL RECEIPT';
  const blocks: A4Block[] = [{ kind: 'text', text: `${model.isBatchReturn ? 'Batch return reference' : 'Transaction reference'}: ${reference}` }];
  if (model.returnReference) blocks.push({ kind: 'text', text: `Return reference: ${model.returnReference}` });
  if (model.isBatchReturn) blocks.push({ kind: 'text', text: 'Multiple withdrawal transactions; original personnel and dates appear per item.' });
  else {
    blocks.push({ kind: 'text', text: `Releaser: ${first.releaser} | Original receiver: ${first.receiver}` });
    blocks.push({ kind: 'text', text: `Withdrawn: ${formatDate(first.withdrawalAt)} | Due: ${formatDate(first.dueAt)}` });
    blocks.push({ kind: 'text', text: `Recorded: ${formatDate(first.createdAt)} | Remarks: ${first.notes || '-'}` });
  }
  blocks.push({ kind: 'text', text: `${items.length} equipment records | ${items.reduce((sum, w) => sum + (w.quantity ?? 1), 0)} units withdrawn${kind === 'return' ? ` | ${returns.reduce((sum, r) => sum + r.quantity, 0)} units in this return` : ''}`, heading: true });
  const assets = new Map(data.assets.map(a => [a.id, a]));
  const eventsByWithdrawal = new Map<string, typeof returns>();
  for (const event of returns) eventsByWithdrawal.set(event.withdrawalId, [...(eventsByWithdrawal.get(event.withdrawalId) || []), event]);
  blocks.push({
    kind: 'table', headers: kind === 'return' ? ['Equipment / individual record', 'Withdrawn', 'This return event'] : ['Equipment / individual record', 'Quantity'], weights: kind === 'return' ? [6, 1, 4] : [9, 1],
    rows: items.map(w => {
      const a = assets.get(w.assetId); const snapshot = w.equipmentSnapshot;
      const equipment = [snapshot?.name || a?.name || 'Equipment', `Serial: ${snapshot?.serial || a?.serial || '-'}`, `Asset ID: ${w.assetId}`, `Withdrawal ID: ${w.id}`, `Description: ${snapshot?.description || a?.notes || '-'}`];
      if (model.isBatchReturn) equipment.push(`Original transaction: ${w.reference || w.id}`, `Releaser: ${w.releaser} | Original receiver: ${w.receiver}`, `Withdrawn: ${formatDate(w.withdrawalAt)}`, `Due: ${formatDate(w.dueAt)} | Recorded: ${formatDate(w.createdAt)}`, `Original remarks: ${w.notes || '-'}`);
      if (w.deletedAt) equipment.push('Subsequently archived; original withdrawal retained.');
      const row = [equipment.join('\n'), String(w.quantity ?? 1)];
      if (kind === 'return') {
        const events = eventsByWithdrawal.get(w.id) || [];
        row.push([`${events.reduce((sum, r) => sum + r.quantity, 0)} returned in this event`, ...events.map(r => `${formatDate(r.at)}\nReturning: ${r.returning}\nReceiving: ${r.receiving}\nCondition: ${r.condition}\nRemarks: ${r.remarks || '-'}`), `Outstanding now: ${remainingQuantity(w)}`].join('\n'));
      }
      return row;
    }),
  });
  const signatureSources = model.isBatchReturn ? Array.from(new Map(items.map(w => [w.reference || w.id, w])).values()) : [first];
  const withdrawalSignatures: A4Signature[] = signatureSources.map(source => ({ label: 'RECEIVER SIGNATURE AT WITHDRAWAL', person: source.receiver, signature: source.signature || [], note: `Original transaction: ${source.reference || source.id}` }));
  blocks.push({ kind: 'signatures', entries: withdrawalSignatures });
  if (kind === 'return') {
    blocks.push({ kind: 'text', text: 'Original withdrawal signatures above; separate return acknowledgement below.' });
    const returnSignatures: A4Signature[] = returnSignatureEntries(returns).flatMap(event => getReturnSignatureBlocks(event).map(details => {
      return { label: details.label.toUpperCase(), person: details.person, signature: details.signature, note: `${event.reference} | ${formatDate(event.at)}${details.signature.some(stroke => stroke.length > 2) ? '' : `\n${details.missing}`}` };
    }));
    blocks.push({ kind: 'signatures', entries: returnSignatures });
  }
  return { model, title, blocks };
}
export async function createTransactionReceipt(data: TrackerData, withdrawal: Withdrawal, kind: ReceiptKind, returnReference?: string): Promise<ReceiptFile> {
  const content = transactionReceiptContent(data, withdrawal, kind, returnReference);
  const file = await createSingleA4Document(content.title, content.blocks);
  const reference = content.model.returnReference || content.model.reference;
  const filename = `OG6_${kind === 'return' ? 'Return' : 'Withdrawal'}_Receipt_${reference.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
  return { filename, bytes: file.bytes, base64: file.base64, preview: file.preview, readable: createReceiptTextDocument(content.title, content.blocks) };
}
export async function transactionPrintHtml(data: TrackerData, withdrawal: Withdrawal, kind: ReceiptKind, returnReference?: string): Promise<string> {
  const content = transactionReceiptContent(data, withdrawal, kind, returnReference);
  return (await createSingleA4Document(content.title, content.blocks)).html;
}
export async function printTransactionReceipt(data: TrackerData, withdrawal: Withdrawal, kind: ReceiptKind, returnReference?: string): Promise<void> {
  await Print.printAsync({ html: await transactionPrintHtml(data, withdrawal, kind, returnReference), width: 595.28, height: 841.89 });
}
