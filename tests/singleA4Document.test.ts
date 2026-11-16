import { PDFDocument } from 'pdf-lib';
import { createSingleA4Document } from '../services/singleA4Document.ts';
import type { A4Block } from '../services/singleA4Document.ts';
import { a4Layout } from '../constants/pdfLayout.ts';
function check(value: boolean, message: string) { if (!value) throw new Error(message); }
async function verify(file: Awaited<ReturnType<typeof createSingleA4Document>>) {
  const doc = await PDFDocument.load(file.bytes);
  check(doc.getPageCount() === 1, 'Every generated PDF must have exactly one page');
  const size = doc.getPages()[0].getSize();
  check(Math.abs(size.width - 595.28) < 0.01 && Math.abs(size.height - 841.89) < 0.01, 'Physical size must be A4 portrait');
  check(file.scale > 0 && file.scale <= 1 && Number.isFinite(file.scale), 'Auto-fit must be finite');
  check(file.html.includes('@page{size:A4 portrait;margin:0}') && file.html.includes('A4 | 1 / 1'), 'Print output uses the same single A4 sheet');
  for (const match of file.html.matchAll(/<text x="([\d.]+)" y="([\d.]+)"/g)) {
    const x = Number(match[1]), y = Number(match[2]);
    check(x >= a4Layout.margin - 0.01 && x <= a4Layout.width - a4Layout.margin + 0.01, 'Text stays within horizontal margins');
    check(y > 0 && y < a4Layout.height, 'Text is never below the page');
  }
  for (const match of file.html.matchAll(/<line x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)"/g)) {
    check(Number(match[2]) <= a4Layout.height - a4Layout.footerHeight + 0.01 && Number(match[4]) <= a4Layout.height - a4Layout.footerHeight + 0.01, 'Body and signatures cannot collide with footer');
  }
}
Deno.test('one-item receipt and signatures fit A4 without changing canonical strokes', async () => {
  const blocks: A4Block[] = [
    { kind: 'text', text: 'Transaction: TX-ONE' },
    { kind: 'table', headers: ['Equipment', 'Quantity'], weights: [9, 1], rows: [['Radio | S-ONE | AST-ONE', '1']] },
    { kind: 'signatures', entries: [{ label: 'RECEIVING PERSONNEL SIGNATURE', person: 'John Doe', signature: [[{ x: 1, y: 1 }, { x: 120, y: 60 }, { x: 500, y: 180 }]], note: 'RET-ONE | 16 Nov 2026' }] },
  ];
  const before = JSON.stringify(blocks); const file = await createSingleA4Document('EQUIPMENT RETURN RECEIPT', blocks);
  await verify(file); check(file.scale === 1, 'Small receipts should not be reduced');
  check(JSON.stringify(blocks) === before, 'Rendering cannot mutate captured signatures');
  check(file.html.includes('RECEIVING PERSONNEL SIGNATURE') && file.html.includes('RET-ONE'), 'Signer and event are retained');
});
Deno.test('large batch PDF retains every item and all original signatures on exactly one sheet', async () => {
  const count = 205;
  const blocks: A4Block[] = [
    { kind: 'table', headers: ['Equipment / source transaction', 'Withdrawn', 'Returned'], weights: [6, 1, 4], rows: Array.from({ length: count }, (_, i) => [`ITEM-${String(i).padStart(4, '0')}\nTX-${i}\nReceiver ${i}\nLong description ${'Equipment description. '.repeat(5)}`, '3', '2 returned\nServiceable\n1 outstanding']) },
    { kind: 'signatures', entries: Array.from({ length: 21 }, (_, i) => ({ label: 'ORIGINAL WITHDRAWAL SIGNATURE', person: `Signer ${i}`, note: `TX-${i}`, signature: [[{ x: 10, y: 10 }, { x: 100, y: 40 }, { x: 200, y: 50 }]] })) },
  ];
  const file = await createSingleA4Document('BATCH RETURN', blocks); await verify(file);
  check(file.scale < 1, 'Large output must auto-fit, not paginate');
  for (let i = 0; i < count; i++) check(file.html.includes(`ITEM-${String(i).padStart(4, '0')}`), `Missing equipment ${i}`);
  for (let i = 0; i < 21; i++) check(file.html.includes(`Signer ${i}`), `Missing source signer ${i}`);
});
Deno.test('long remarks, unsupported glyphs and HTML-like personnel text are safely wrapped', async () => {
  const blocks: A4Block[] = [
    { kind: 'text', text: '<script>alert("personnel")</script> José & Santos' },
    { kind: 'text', text: 'REMARKS\n' + 'Continuous notes '.repeat(1000) },
    { kind: 'text', text: 'END-OF-REMARKS' },
  ];
  const file = await createSingleA4Document('WITHDRAWAL', blocks); await verify(file);
  check(!file.html.includes('<script>') && file.html.includes('&lt;script&gt;'), 'User input cannot become printable HTML markup');
  check(file.html.includes('Jose &amp; Santos') && file.html.includes('END-OF-REMARKS'), 'Long content is not truncated');
});
