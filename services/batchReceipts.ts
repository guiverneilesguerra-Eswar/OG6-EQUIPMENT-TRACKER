import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { TrackerData } from './tracker';
import { formatDate } from './tracker';
import { remainingQuantity } from './movements';
import { deliverFile } from './portableFiles';
export async function exportBatchReceipt(data: TrackerData, batchId: string, returnReference?: string) {
  const batch = data.batches?.find(b => b.id === batchId); if (!batch) throw new Error('Batch record was not found.');
  const items = data.withdrawals.filter(w => batch.withdrawalIds.includes(w.id)); if (items.length !== batch.withdrawalIds.length) throw new Error('Batch receipt has missing equipment records.');
  const first = items[0]; const returns = returnReference ? (data.returnRecords || []).filter(r => r.reference === returnReference && batch.withdrawalIds.includes(r.withdrawalId)) : [];
  const doc = await PDFDocument.create(); const font = await doc.embedFont(StandardFonts.Helvetica); const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const safe = (text: string) => Array.from(text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')).map(ch => { try { font.encodeText(ch); return ch; } catch { return '?'; } }).join('');
  let page = doc.addPage([595, 842]); let y = 794;
  const title = returns.length ? 'BATCH RETURN RECEIPT' : 'BATCH WITHDRAWAL RECEIPT';
  function newPage() { page = doc.addPage([595, 842]); y = 794; }
  function line(value: string, heading = false) {
    const size = heading ? 14 : 11; let row = '';
    for (const ch of safe(value)) {
      if (ch === '\n' || font.widthOfTextAtSize(row + ch, size) > 500) { if (y < 60) newPage(); page.drawText(row, { x: 44, y, font: heading ? bold : font, size, color: rgb(0.1, 0.1, 0.08) }); y -= 18; row = ''; if (ch === '\n') continue; } row += ch;
    }
    if (y < 60) newPage(); page.drawText(row, { x: 44, y, font: heading ? bold : font, size, color: rgb(0.1, 0.1, 0.08) }); y -= heading ? 25 : 18;
  }
  line('OG6 EQUIPMENT TRACKER', true); line(title, true); line(`Transaction reference: ${batch.reference}`);
  if (returnReference) line(`Return reference: ${returnReference}`);
  line(`Releaser: ${first.releaser}`); line(`Receiver: ${first.receiver}`); line(`Withdrawal: ${formatDate(first.withdrawalAt)}`); line(`Expected return: ${formatDate(first.dueAt)}`); line(`Remarks: ${first.notes || '-'}`); line('EQUIPMENT / INDIVIDUAL TRANSACTIONS', true);
  for (const w of items) {
    const a = data.assets.find(a => a.id === w.assetId); const snapshot = w.equipmentSnapshot;
    line(`${snapshot?.name || a?.name || 'Equipment'} | ${snapshot?.serial || a?.serial || '-'}`, true);
    line(`Asset ID: ${w.assetId}`); line(`Withdrawal ID: ${w.id}`); line(`Description: ${snapshot?.description || a?.notes || '-'}`);
    line(`Withdrawn: ${w.quantity ?? 1} | Returned: ${w.returnedAt && w.returnedQuantity === undefined ? w.quantity ?? 1 : w.returnedQuantity ?? 0} | Outstanding: ${remainingQuantity(w)}`);
    for (const r of returns.filter(r => r.withdrawalId === w.id)) { line(`This return: ${r.quantity} | ${formatDate(r.at)}`); line(`Returning: ${r.returning} | Receiving: ${r.receiving}`); line(`Condition: ${r.condition} | Remarks: ${r.remarks || '-'}`); }
  }
  line('RECEIVER SIGNATURE AT WITHDRAWAL', true);
  if (y < 170) newPage();
  for (const stroke of first.signature) for (let i = 1; i < stroke.length; i++) { const a = stroke[i - 1], b = stroke[i]; page.drawLine({ start: { x: 44 + Math.min(500, Math.max(0, a.x)) * 0.6, y: y - Math.min(180, Math.max(0, a.y)) * 0.6 }, end: { x: 44 + Math.min(500, Math.max(0, b.x)) * 0.6, y: y - Math.min(180, Math.max(0, b.y)) * 0.6 }, thickness: 1, color: rgb(0.1, 0.1, 0.08) }); }
  doc.setTitle(`${title} ${batch.reference}`); doc.setAuthor('OG6 EQUIPMENT TRACKER');
  return deliverFile(await doc.save(), `OG6_${returnReference ? 'Return' : 'Batch'}_${(returnReference || batch.reference).replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`, 'application/pdf');
}
