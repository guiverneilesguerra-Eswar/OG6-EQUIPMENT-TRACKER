import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import * as Print from 'expo-print';
import type { Signature, TrackerData, Withdrawal } from './tracker';
import { formatDate } from './tracker';
import type { ReceiptFile, ReceiptKind } from './receipts';
import { getTransactionReceiptModel } from './withdrawalTransactions';
import { remainingQuantity } from './movements';
import { palettes } from '@/constants/theme';
import { getReturnSignatureDetails, returnSignatureEntries } from './returnSignatures';

export async function createTransactionReceipt(data: TrackerData, withdrawal: Withdrawal, kind: ReceiptKind, returnReference?: string): Promise<ReceiptFile> {
  const model = getTransactionReceiptModel(data, withdrawal, kind, returnReference);
  const { first, items, returns, reference } = model;
  const title = kind === 'return' ? 'EQUIPMENT RETURN RECEIPT' : 'EQUIPMENT WITHDRAWAL RECEIPT';
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica); const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const color = palettes.light.text;
  const ink = rgb(parseInt(color.slice(1, 3), 16) / 255, parseInt(color.slice(3, 5), 16) / 255, parseInt(color.slice(5, 7), 16) / 255);
  const safe = (value: string) => Array.from(value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/\r/g, '').replace(/\t/g, ' ')).map(ch => {
    if (ch === '\n') return ch;
    try { font.encodeText(ch); return ch; } catch { return '?'; }
  }).join('');
  let page = doc.addPage([595, 842]); let y = 794;
  function newPage() { page = doc.addPage([595, 842]); y = 794; }
  function line(value: string, heading = false) {
    const size = heading ? 13 : 11; const face = heading ? bold : font; let row = '';
    const draw = () => { if (y < 64) newPage(); page.drawText(row, { x: 44, y, font: face, size, color: ink }); y -= 18; row = ''; };
    for (const ch of safe(value)) { if (ch === '\n' || face.widthOfTextAtSize(row + ch, size) > 500) { draw(); if (ch === '\n') continue; } row += ch; }
    draw(); if (heading) y -= 6;
  }
  line('OG6 EQUIPMENT TRACKER', true); line(title, true);
  line(`${model.isBatchReturn ? 'Batch return reference' : 'Transaction reference'}: ${reference}`);
  if (model.returnReference) line(`Return reference: ${model.returnReference}`);
  if (model.isBatchReturn) line('Items from multiple withdrawals. Original personnel and dates are listed per item.');
  else {
    line(`Releaser: ${first.releaser}`); line(`Receiver: ${first.receiver}`);
    line(`Withdrawal date & time: ${formatDate(first.withdrawalAt)}`);
    line(`Recorded at: ${formatDate(first.createdAt)}`); line(`Expected return: ${formatDate(first.dueAt)}`);
    line(`Remarks: ${first.notes || '-'}`);
  }
  line(`Equipment selected: ${items.length} | Total units withdrawn: ${items.reduce((sum, w) => sum + (w.quantity ?? 1), 0)}`);
  line('EQUIPMENT / INDIVIDUAL TRANSACTIONS', true);
  for (const w of items) {
    const a = data.assets.find(a => a.id === w.assetId); const snapshot = w.equipmentSnapshot;
    line(`${snapshot?.name || a?.name || 'Equipment'} | ${snapshot?.serial || a?.serial || '-'}`, true);
    line(`Asset ID: ${w.assetId}`); line(`Individual withdrawal ID: ${w.id}`);
    if (model.isBatchReturn) {
      line(`Original transaction: ${w.reference || w.id}`); line(`Releaser: ${w.releaser} | Original receiver: ${w.receiver}`);
      line(`Withdrawn: ${formatDate(w.withdrawalAt)} | Expected return: ${formatDate(w.dueAt)}`); line(`Original remarks: ${w.notes || '-'}`);
    }
    line(`Description: ${snapshot?.description || a?.notes || '-'}`);
    line(`Quantity withdrawn: ${w.quantity ?? 1}`);
    if (kind === 'return') {
      const events = returns.filter(r => r.withdrawalId === w.id);
      line(`Returned in this event: ${events.reduce((sum, r) => sum + r.quantity, 0)} | Currently outstanding: ${remainingQuantity(w)}`);
      for (const r of events) { line(`Returned at: ${formatDate(r.at)}`); line(`Returning: ${r.returning} | Receiving: ${r.receiving}`); line(`Condition: ${r.condition} | Remarks: ${r.remarks || '-'}`); }
    }
    if (w.deletedAt) line('Individual record subsequently archived; original withdrawal retained.');
  }
  function drawSignature(label: string, person: string, signature: Signature) {
    if (y < 240) newPage();
    line(label, true);
    const top = y;
    const point = (p: { x: number; y: number }) => ({ x: 44 + Math.min(500, Math.max(0, p.x)) * 0.6, y: top - Math.min(180, Math.max(0, p.y)) * 0.6 });
    for (const stroke of signature) for (let i = 1; i < stroke.length; i++) {
      const a = stroke[i - 1], b = stroke[i]; if (![a.x, a.y, b.x, b.y].every(Number.isFinite)) continue;
      page.drawLine({ start: point(a), end: point(b), thickness: 1, color: ink });
    }
    y -= 120; line(person);
  }
  const signatureSources = model.isBatchReturn ? Array.from(new Map(items.map(w => [w.reference || w.id, w])).values()) : [first];
  for (const source of signatureSources) {
    if (model.isBatchReturn) line(`Original signature for transaction: ${source.reference || source.id}`);
    drawSignature('RECEIVER SIGNATURE AT WITHDRAWAL', source.receiver, source.signature || []);
  }
  if (kind === 'return') {
    line('Original withdrawal signature; separate from the return signature below.');
    for (const event of returnSignatureEntries(returns)) {
      const details = getReturnSignatureDetails(event);
      if (details.signature.some(stroke => stroke.length > 2)) drawSignature(details.label.toUpperCase(), details.person, details.signature);
      else { line(details.label.toUpperCase(), true); line(details.missing); }
      line(`Return reference: ${event.reference} | Signed return event: ${formatDate(event.at)}`);
    }
  }
  const pages = doc.getPages();
  pages.forEach((p, i) => p.drawText(`Personnel record - authorized recipients only.    ${i + 1} / ${pages.length}`, { x: 44, y: 33, font, size: 8, color: ink }));
  doc.setTitle(`${title} ${reference}`); doc.setAuthor('OG6 EQUIPMENT TRACKER');
  const filename = `OG6_${kind === 'return' ? 'Return' : 'Withdrawal'}_Receipt_${(model.returnReference || reference).replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
  return { filename, bytes: await doc.save(), base64: await doc.saveAsBase64() };
}

export function transactionPrintHtml(data: TrackerData, withdrawal: Withdrawal, kind: ReceiptKind, returnReference?: string): string {
  const model = getTransactionReceiptModel(data, withdrawal, kind, returnReference);
  const htmlEntities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const escape = (value: string | number) => String(value).replace(/[&<>"']/g, ch => htmlEntities[ch] || ch);
  const c = palettes.light;
  const rows = model.items.map(w => {
    const a = data.assets.find(a => a.id === w.assetId);
    const events = model.returns.filter(r => r.withdrawalId === w.id);
    return `<tr><td><strong>${escape(w.equipmentSnapshot?.name || a?.name || 'Equipment')}</strong><br>${escape(w.equipmentSnapshot?.serial || a?.serial || '-')}<br>Asset ID: ${escape(w.assetId)}<br>${escape(w.equipmentSnapshot?.description || a?.notes || '-')}<br>Withdrawal ID: ${escape(w.id)}${model.isBatchReturn ? `<br>Original transaction: ${escape(w.reference || w.id)}<br>Releaser: ${escape(w.releaser)}<br>Original receiver: ${escape(w.receiver)}<br>Withdrawn: ${escape(formatDate(w.withdrawalAt))}<br>Expected return: ${escape(formatDate(w.dueAt))}<br>Original remarks: ${escape(w.notes || '-')}` : ''}</td><td>${w.quantity ?? 1}</td>${kind === 'return' ? `<td>${events.reduce((sum, r) => sum + r.quantity, 0)}<br>${events.map(r => `${escape(formatDate(r.at))}<br>Returning: ${escape(r.returning)}<br>Receiving: ${escape(r.receiving)}<br>${escape(r.condition)}<br>${escape(r.remarks)}`).join('<br>')}<br>Outstanding now: ${remainingQuantity(w)}</td>` : ''}</tr>`;
  }).join('');
  const signatureSources = model.isBatchReturn ? Array.from(new Map(model.items.map(w => [w.reference || w.id, w])).values()) : [model.first];
  const withdrawalSignaturesHtml = signatureSources.map(source => {
    const strokes = (source.signature || []).filter(s => s.length > 1).map(s => `<polyline points="${s.filter(p => Number.isFinite(p.x) && Number.isFinite(p.y)).map(p => `${Math.min(500, Math.max(0, p.x))},${Math.min(180, Math.max(0, p.y))}`).join(' ')}" fill="none" stroke="${c.text}" stroke-width="2" />`).join('');
    return `<section style="break-inside:avoid"><p>RECEIVER SIGNATURE AT WITHDRAWAL<br>Transaction: ${escape(source.reference || source.id)}</p><svg width="500" height="180" viewBox="0 0 500 180">${strokes}</svg><p>${escape(source.receiver)}<br>Original signature captured at withdrawal.</p></section>`;
  }).join('');
  const first = model.first;
  const overviewHtml = model.isBatchReturn ? '<p>Batch return from multiple withdrawal transactions. Original personnel and dates are listed per item.</p>' : `<p>Releaser: ${escape(first.releaser)}<br>Receiver: ${escape(first.receiver)}<br>Withdrawal date &amp; time: ${escape(formatDate(first.withdrawalAt))}<br>Expected return: ${escape(formatDate(first.dueAt))}<br>Remarks: ${escape(first.notes || '-')}</p>`;
  const returnSignatureHtml = kind === 'return' ? returnSignatureEntries(model.returns).map(event => {
    const details = getReturnSignatureDetails(event);
    const signed = details.signature.some(stroke => stroke.length > 2);
    const paths = details.signature.filter(stroke => stroke.length > 1).map(stroke => `<polyline points="${stroke.filter(p => Number.isFinite(p.x) && Number.isFinite(p.y)).map(p => `${Math.min(500, Math.max(0, p.x))},${Math.min(180, Math.max(0, p.y))}`).join(' ')}" fill="none" stroke="${c.text}" stroke-width="2" />`).join('');
    return `<section style="break-inside:avoid"><p><strong>${escape(details.label.toUpperCase())}</strong><br>${escape(details.person || '-')}<br>Return reference: ${escape(event.reference)}<br>Return event: ${escape(formatDate(event.at))}</p>${signed ? `<svg width="500" height="180" viewBox="0 0 500 180">${paths}</svg>` : `<p>${escape(details.missing)}</p>`}</section>`;
  }).join('') : '';
  return `<!doctype html><html><head><meta charset="utf-8"><style>body{font:14px Arial;color:${c.text};background:${c.surface};padding:24px}h1{font-size:22px}h2{font-size:18px;color:${c.primary}}p{line-height:1.6}table{border-collapse:collapse;width:100%;table-layout:fixed}td,th{border:1px solid ${c.border};padding:8px;text-align:left;vertical-align:top;overflow-wrap:anywhere}tr{break-inside:avoid}th{background:${c.surfaceAlt}}svg{border:1px solid ${c.border};max-width:100%}footer{font-size:11px;margin-top:16px}</style></head><body><h1>OG6 EQUIPMENT TRACKER</h1><h2>${kind === 'return' ? 'EQUIPMENT RETURN RECEIPT' : 'EQUIPMENT WITHDRAWAL RECEIPT'}</h2>${overviewHtml}<p>${model.isBatchReturn ? 'Batch return reference' : 'Transaction reference'}: ${escape(model.reference)}${model.returnReference ? `<br>Return reference: ${escape(model.returnReference)}` : ''}<br>Equipment selected: ${model.items.length} · Total units: ${model.items.reduce((sum, w) => sum + (w.quantity ?? 1), 0)}</p><table><thead><tr><th>Equipment / individual record</th><th>Quantity withdrawn</th>${kind === 'return' ? '<th>This return event</th>' : ''}</tr></thead><tbody>${rows}</tbody></table>${withdrawalSignaturesHtml}${returnSignatureHtml}<footer>Personnel record — share with authorized recipients only.</footer></body></html>`;
}
export async function printTransactionReceipt(data: TrackerData, withdrawal: Withdrawal, kind: ReceiptKind, returnReference?: string): Promise<void> {
  await Print.printAsync({ html: transactionPrintHtml(data, withdrawal, kind, returnReference) });
}
