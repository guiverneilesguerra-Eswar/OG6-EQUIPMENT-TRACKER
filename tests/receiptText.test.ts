import { createReceiptTextDocument, receiptTextViewportHeight } from '../services/receiptText.ts';
import type { A4Block } from '../services/singleA4Document.ts';
import { createSingleA4Document } from '../services/singleA4Document.ts';
import { PDFDocument } from 'pdf-lib';

function check(value: boolean, message: string) { if (!value) throw new Error(message); }
function equal(actual: unknown, expected: unknown) { check(JSON.stringify(actual) === JSON.stringify(expected), `Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`); }

Deno.test('readable receipt preserves original Unicode, multiline details and every personnel field', () => {
  const blocks: A4Block[] = [
    { kind: 'text', text: 'Transaction reference: TX-OLD\nReleaser: José | Original receiver: María\nWithdrawn: 16 Nov 2026 | Due: 17 Nov 2026' },
    { kind: 'text', text: '2 equipment records | 5 units withdrawn | 2 units in this return', heading: true },
    { kind: 'table', headers: ['Equipment / individual record', 'Withdrawn', 'This return event'], weights: [6, 1, 4], rows: [
      ['Radio Ñ\nSerial: R-1\nAsset ID: A-1\nWithdrawal ID: W-1\nDescription: John & Jane <authorized>\nOriginal transaction: TX-OLD', '1', '0 returned in this event\nOutstanding now: 1'],
      ['Battery lot\nSerial: B-1\nDescription: ' + 'Long original description. '.repeat(500), '4', '2 returned in this event\nReturning: María\nReceiving: José\nCondition: Damage\nRemarks: Damaged connector\nOutstanding now: 2'],
    ] },
    { kind: 'signatures', entries: [{ label: 'RECEIVING PERSONNEL SIGNATURE', person: 'José', signature: [[{ x: 1, y: 2 }, { x: 3, y: 4 }, { x: 5, y: 6 }]], note: 'RET-OLD | 16 Nov 2026' }] },
  ];
  const before = JSON.stringify(blocks); const readable = createReceiptTextDocument('EQUIPMENT RETURN RECEIPT', blocks);
  equal(readable.title, 'EQUIPMENT RETURN RECEIPT'); equal(readable.entries.length, 5);
  const paragraphs = readable.entries.filter(entry => entry.kind === 'text');
  equal(paragraphs[0].text, blocks[0].kind === 'text' ? blocks[0].text : ''); check(paragraphs[1].heading, 'Summary must retain heading semantics');
  const equipment = readable.entries.filter(entry => entry.kind === 'equipment'); const table = blocks[2];
  check(table.kind === 'table', 'Fixture table missing');
  if (table.kind === 'table') equipment.forEach((entry, index) => { equal(entry.fields.map(field => field.label), table.headers); equal(entry.fields.map(field => field.value), table.rows[index]); });
  equal(equipment[0].title, 'Radio Ñ');
  const signer = readable.entries.find(entry => entry.kind === 'signature'); check(signer?.kind === 'signature', 'Signature missing');
  if (signer?.kind === 'signature') { equal(signer.person, 'José'); equal(signer.label, 'RECEIVING PERSONNEL SIGNATURE'); signer.signature[0][0].x = 400; }
  equal(JSON.stringify(blocks), before);
});

Deno.test('readable large batches retain all source IDs, original signatures and historical signer labels', () => {
  const blocks: A4Block[] = [
    { kind: 'table', headers: ['Equipment / individual record', 'Quantity'], weights: [9, 1], rows: Array.from({ length: 250 }, (_, i) => [`ITEM-${i}\nOriginal transaction: TX-${i}\nOriginal receiver: PERSON-${i}`, String(i + 1)]) },
    { kind: 'signatures', entries: [
      { label: 'RECEIVER SIGNATURE AT WITHDRAWAL', person: 'Original receiver', signature: [[{ x: 10, y: 20 }, { x: 30, y: 40 }, { x: 50, y: 60 }]], note: 'TX-0' },
      { label: 'RETURNING PERSONNEL SIGNATURE (HISTORICAL)', person: 'Historical returning person', signature: [[{ x: 15, y: 25 }, { x: 35, y: 45 }, { x: 55, y: 65 }]], note: 'RET-OLD' },
      { label: 'RECEIVING PERSONNEL SIGNATURE', person: 'Historical recipient', signature: [], note: 'No receiving personnel signature recorded.' },
    ] },
  ];
  const readable = createReceiptTextDocument('BATCH RETURN', blocks);
  equal(readable.entries.length, 253); equal(new Set(readable.entries.map(entry => entry.id)).size, readable.entries.length);
  for (let i = 0; i < 250; i++) { const entry = readable.entries[i]; check(entry.kind === 'equipment' && entry.fields[0].value.includes(`TX-${i}`) && entry.fields[0].value.includes(`PERSON-${i}`), `Missing source details for ${i}`); }
  const historical = readable.entries[251]; check(historical.kind === 'signature' && historical.person === 'Historical returning person' && historical.label.includes('(HISTORICAL)'), 'Historical signer cannot be reassigned');
  const missing = readable.entries[252]; check(missing.kind === 'signature' && missing.signature.length === 0 && missing.note.includes('No receiving'), 'Do not fabricate unsigned historical events');
});

Deno.test('building a large-text view never alters generated PDF, print vectors or A4 dimensions', async () => {
  const blocks: A4Block[] = [{ kind: 'table', headers: ['Equipment', 'Quantity'], weights: [9, 1], rows: Array.from({ length: 205 }, (_, i) => [`ITEM-${i}\nDescription ${i}`, '1']) }];
  const file = await createSingleA4Document('EQUIPMENT WITHDRAWAL RECEIPT', blocks);
  const bytes = Array.from(file.bytes); const base64 = file.base64; const html = file.html; const svg = file.preview.svg; const scale = file.scale;
  const readable = createReceiptTextDocument('EQUIPMENT WITHDRAWAL RECEIPT', blocks);
  check(readable.entries.length === 205, 'All records must remain readable');
  equal(Array.from(file.bytes), bytes); equal(file.base64, base64); equal(file.html, html); equal(file.preview.svg, svg); equal(file.scale, scale);
  const pdf = await PDFDocument.load(file.bytes); equal(pdf.getPageCount(), 1); equal(pdf.getPage(0).getSize(), { width: 595.28, height: 841.89 });
});

Deno.test('large-text reading viewport stays bounded and usable in phone portrait and landscape', () => {
  for (const height of [320, 568, 667, 768, 1024, 0, -1, NaN, Infinity]) {
    const viewport = receiptTextViewportHeight(height); check(Number.isFinite(viewport) && viewport >= 160 && viewport <= 420, 'Reading surface must have a finite, positive bounded height');
  }
});
