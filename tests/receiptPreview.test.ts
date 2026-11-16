import { nextReceiptZoom, normalizeReceiptZoom, receiptPreviewGeometry } from '../services/receiptPreview.ts';
import type { ReceiptPreviewDocument } from '../services/receiptPreview.ts';
import { createSingleA4Document } from '../services/singleA4Document.ts';
import { a4Layout } from '../constants/pdfLayout.ts';
import { receiptPreviewLayout } from '../constants/theme.ts';
import { PDFDocument } from 'pdf-lib';

function check(value: boolean, message: string) { if (!value) throw new Error(message); }
const document: ReceiptPreviewDocument = { svg: '<svg />', width: a4Layout.width, height: a4Layout.height, bodyScale: 1 };
Deno.test('receipt preview preserves A4 ratio on phones, landscape, tablets and desktop at every zoom', () => {
  for (const [width, height] of [[220, 568], [280, 667], [540, 320], [600, 1024], [920, 768]]) {
    for (const zoom of receiptPreviewLayout.zoomSteps) {
      const geometry = receiptPreviewGeometry(document, width, height, zoom);
      check(Math.abs(geometry.pageHeight / geometry.pageWidth - a4Layout.height / a4Layout.width) < 0.000001, 'Preview cannot stretch signatures or change A4 proportions');
      check(geometry.pageWidth === width * zoom, 'Zoom is relative to actual measured fit width');
      check(geometry.viewportWidth === width && geometry.viewportHeight <= receiptPreviewLayout.maxHeight, 'Large zoom cannot enlarge or crowd out the controls');
      check(geometry.pageHeight >= geometry.viewportHeight, 'Page must be reachable by scrolling');
    }
  }
});
Deno.test('zoom controls follow all steps, clamp at limits and support invalid dimensions safely', () => {
  let zoom = 1;
  for (const expected of receiptPreviewLayout.zoomSteps.slice(1)) { zoom = nextReceiptZoom(zoom, 'in'); check(zoom === expected, 'Zoom in skips a supported step'); }
  check(nextReceiptZoom(8, 'in') === 8, 'Upper limit must be stable');
  for (const expected of receiptPreviewLayout.zoomSteps.slice(0, -1).reverse()) { zoom = nextReceiptZoom(zoom, 'out'); check(zoom === expected, 'Zoom out skips a supported step'); }
  check(nextReceiptZoom(1, 'out') === 1, 'Lower limit must remain fit width');
  check(normalizeReceiptZoom(NaN) === 1 && normalizeReceiptZoom(-20) === 1 && normalizeReceiptZoom(100) === 8, 'Invalid zoom must be normalized');
  for (const width of [0, -1, NaN, Infinity]) {
    const geometry = receiptPreviewGeometry({ ...document, width: 0, height: NaN }, width, 0, NaN);
    check(Object.values(geometry).every(value => Number.isFinite(value) && value > 0), 'Invalid layout cannot create zero, negative or infinite dimensions');
  }
});
Deno.test('preview and print contain the exact shared vectors generated with a one-page PDF', async () => {
  const signature = [[{ x: 10, y: 20 }, { x: 120, y: 80 }, { x: 490, y: 170 }]];
  const before = JSON.stringify(signature);
  const file = await createSingleA4Document('EQUIPMENT RETURN RECEIPT', [
    { kind: 'text', text: 'Return event RET-OLD | Receiving: John & Jane <authorized>' },
    { kind: 'table', headers: ['Equipment', 'Quantity'], weights: [9, 1], rows: [['RADIO-ONE | Original TX-ONE', '1']] },
    { kind: 'signatures', entries: [{ label: 'RECEIVING PERSONNEL SIGNATURE', person: 'John Doe', signature, note: 'RET-OLD' }] },
  ]);
  const pdf = await PDFDocument.load(file.bytes);
  check(pdf.getPageCount() === 1, 'Preview must not change PDF page count');
  check(file.html.includes(file.preview.svg), 'Print and preview must reuse the same SVG, not rebuild content');
  check(file.preview.width === a4Layout.width && file.preview.height === a4Layout.height, 'Preview metadata must use true A4 dimensions');
  check(file.preview.bodyScale === file.scale, 'Preview must reflect the PDF auto-fit factor');
  for (const content of ['RADIO-ONE', 'TX-ONE', 'RET-OLD', 'John Doe', 'RECEIVING PERSONNEL SIGNATURE', 'A4 | 1 / 1']) check(file.preview.svg.includes(content), `Missing receipt content: ${content}`);
  check(file.preview.svg.includes('&amp;') && file.preview.svg.includes('&lt;authorized&gt;'), 'Personnel text must stay escaped');
  check(JSON.stringify(signature) === before, 'Preview generation cannot rewrite stored signature strokes');
  const bytesBefore = Array.from(file.bytes).join(',');
  receiptPreviewGeometry(file.preview, 280, 667, 8);
  check(Array.from(file.bytes).join(',') === bytesBefore, 'Display zoom cannot mutate the downloadable PDF');
});
Deno.test('large-batch preview retains small text, source signatures and every row without pagination', async () => {
  const file = await createSingleA4Document('BATCH RETURN', [
    { kind: 'table', headers: ['Equipment / original reference', 'Returned'], weights: [8, 2], rows: Array.from({ length: 205 }, (_, i) => [`ITEM-${i} | TX-${i}\nLong equipment description`, '1 | Serviceable']) },
    { kind: 'signatures', entries: [{ label: 'RECEIVING PERSONNEL SIGNATURE', person: 'Receiving officer', signature: [[{ x: 10, y: 20 }, { x: 80, y: 40 }, { x: 120, y: 30 }]] }] },
  ]);
  check(file.preview.bodyScale < 1, 'Large one-page documents must preserve their reduction factor');
  for (let i = 0; i < 205; i++) check(file.preview.svg.includes(`ITEM-${i} | TX-${i}`), `Preview omitted equipment ${i}`);
  check(file.preview.svg.includes('Receiving officer'), 'Receiving signature block must remain available for zooming');
  check((await PDFDocument.load(file.bytes)).getPageCount() === 1, 'Adding a preview cannot paginate the PDF');
});
