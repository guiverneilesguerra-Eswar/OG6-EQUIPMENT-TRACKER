import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import { unzlibSync } from 'fflate';
import { buildReceiptPdf } from '../services/receiptPdf.ts';
import type { Asset, Withdrawal } from '../services/tracker.ts';
const check = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
const at = '2026-11-15T08:00:00.123Z';
const signature = [[{ x: 10, y: 20 }, { x: 100, y: 40 }, { x: 200, y: 80 }]];
const asset: Asset = { id: 'AST-1', name: 'Handheld radio', serial: '0000123', notes: 'Operational', createdAt: at, updatedAt: at };
const withdrawal: Withdrawal = { id: 'WD-1', assetId: asset.id, receiver: 'Original receiver', releaser: 'Releaser', signature,
  withdrawalAt: at, dueAt: '2026-11-16T08:00:00Z', createdAt: at, notes: 'Exercise', returnedAt: at,
  returning: 'Returning person', receiving: 'Receiving person', receivingSignature: signature, receivingSignatureAt: at, condition: 'Good', remarks: 'Complete' };
const formatDate = (_value: string) => '15 Nov 2026 | 04:00 PM';
async function inspect(a: Asset, w: Withdrawal, kind: 'withdrawal' | 'return') {
  const bytes = await buildReceiptPdf({ asset: a, withdrawal: w, kind, generatedAt: at, formatDate });
  const doc = await PDFDocument.load(bytes); check(doc.getPageCount() === 1, 'Receipt must contain exactly one sheet.');
  const page = doc.getPages()[0];
  check(Math.abs(page.getWidth() - 595.28) < 0.01 && Math.abs(page.getHeight() - 841.89) < 0.01, 'Receipt must be A4 portrait.');
  const streams: string[] = [];
  for (const [, object] of doc.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFRawStream)) continue;
    const bytes = object.getContents();
    const decoded = object.dict.get(PDFName.of('Filter'))?.toString() === '/FlateDecode' ? unzlibSync(bytes) : bytes;
    streams.push(new TextDecoder().decode(decoded));
  }
  const operators = streams.join('\n');
  const sizes = Array.from(operators.matchAll(/\s([0-9.]+)\s+Tf\b/g), match => Number(match[1]));
  check(sizes.length > 0 && sizes.every(size => size === 12), 'Every PDF text element must use 12 points.');
  return operators;
}
Deno.test('withdrawal and signed return receipts use one A4 page and 12-point text', async () => {
  const before = JSON.stringify({ asset, withdrawal });
  await inspect(asset, withdrawal, 'withdrawal'); await inspect(asset, withdrawal, 'return');
  check(JSON.stringify({ asset, withdrawal }) === before, 'PDF generation must not modify existing records.');
});
Deno.test('long fields stay within one sheet without shrinking font or changing source records', async () => {
  const longAsset = { ...asset, name: 'Equipment '.repeat(1000), serial: '0000123'.repeat(1000), id: 'AST-'.repeat(200) };
  const longWithdrawal = { ...withdrawal, assetId: longAsset.id, id: 'WD-'.repeat(200), receiver: 'Receiver '.repeat(1000),
    releaser: 'Releaser '.repeat(1000), returning: 'Returning '.repeat(1000), receiving: 'Receiving '.repeat(1000),
    condition: 'Operational '.repeat(1000), notes: 'Purpose\n'.repeat(1000), remarks: 'Remark\n'.repeat(1000) };
  await inspect(longAsset, longWithdrawal, 'return');
  check(longWithdrawal.notes.length === 8000, 'Full saved notes must remain unchanged.');
});
Deno.test('historical returns without signatures still export without fabricating return evidence', async () => {
  await inspect(asset, { ...withdrawal, receivingSignature: undefined, receivingSignatureAt: undefined }, 'return');
});
Deno.test('unreturned or mismatched transactions cannot produce return receipts', async () => {
  for (const record of [{ ...withdrawal, returnedAt: undefined }, { ...withdrawal, assetId: 'OTHER' }]) {
    let rejected = false;
    try { await buildReceiptPdf({ asset, withdrawal: record, kind: 'return', generatedAt: at, formatDate }); } catch { rejected = true; }
    check(rejected, 'Receipt validation must fail.');
  }
});
