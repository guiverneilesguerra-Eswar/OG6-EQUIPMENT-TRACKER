// Source contracts complement content/PDF tests and installed-device selection checks.
const source = (path: string) => Deno.readTextFile(new URL(path, import.meta.url));
function check(value: boolean, message: string) { if (!value) throw new Error(message); }

Deno.test('shared receipt actions offer selectable large text alongside the original A4 preview before export', async () => {
  const [actions, selector, view, mode, hook, theme] = await Promise.all([
    source('../components/feature/ReceiptActions.tsx'), source('../components/feature/ReceiptViewSelector.tsx'), source('../components/feature/ReceiptTextView.tsx'),
    source('../hooks/useReceiptViewMode.ts'), source('../hooks/useReceiptTextView.ts'), source('../constants/theme.ts'),
  ]);
  check(actions.includes('<ReceiptViewSelector mode={view.mode} onChange={view.selectMode}'), 'Provide a selected-state reading mode control');
  check(actions.includes('<ReceiptPreview document={m.file.preview} filename={m.file.filename}') && actions.includes('<ReceiptTextView document={m.file.readable} filename={m.file.filename}'), 'Both views must use the same generated receipt');
  check(actions.indexOf('<ReceiptTextView') < actions.indexOf('title="Share / send PDF"') && actions.indexOf('<ReceiptTextView') < actions.indexOf("'Save PDF on device'"), 'Reading is available before saving and sharing');
  check(actions.includes('accessibilityElementsHidden={view.mode') && actions.includes("hidden: { display: 'none' }"), 'Keep A4 mounted but hidden from accessibility when large text is selected');
  check(selector.includes('accessibilityState={{ selected }}') && selector.includes('receiptPreviewLayout.controlHeight') && selector.includes('pressed ? 0.65'), 'Mode controls need equal accessible targets, selected state and pressed feedback');
  check(view.includes('<FlatList data={m.entries}') && view.includes('height: m.viewportHeight') && view.includes('nestedScrollEnabled'), 'Use a bounded, virtualized vertical reading surface');
  for (const value of ['entry.text', 'entry.title', 'field.label', 'field.value', 'entry.label', 'entry.person', 'entry.note', 'document.title']) check(view.includes(`>{${value}}</Text>`), `Missing readable content ${value}`);
  check((view.match(/<Text selectable/g) || []).length === 8 && !view.includes('numberOfLines'), 'All receipt content should be selectable and untruncated');
  check(view.includes('value={entry.signature}') && view.includes('saved readOnly'), 'Show original strokes read-only');
  check(theme.includes('receiptTextLayout = { fontSize: 20, lineHeight: 32, headingSize: 22'), 'Keep readable fonts independent of reduced PDF scale');
  check(hook.includes('useResponsive()') && hook.includes('receiptTextViewportHeight'), 'Reading viewport must adapt to orientation');
  check(mode.includes("setMode('a4'); }, [file]") && !mode.includes('createReceipt(') && !mode.includes('saveData'), 'Mode is display-only and resets on another generated receipt');
});

Deno.test('readable documents reuse selected-event content without changing PDF generation or delivery', async () => {
  const [transaction, receipt, renderer, processor, hook] = await Promise.all([
    source('../services/transactionReceipts.ts'), source('../services/receipts.ts'), source('../services/singleA4Document.ts'), source('../services/receiptText.ts'), source('../hooks/useReceipt.ts'),
  ]);
  check(transaction.includes('getTransactionReceiptModel(data, withdrawal, kind, returnReference)'), 'Use the existing receipt event selector, including legacy and cross-transaction returns');
  check(transaction.includes('readable: createReceiptTextDocument(content.title, content.blocks)'), 'Reading and PDF must share the same structured source, not parse SVG or latest history');
  check(transaction.includes('bytes: file.bytes, base64: file.base64, preview: file.preview'), 'Deliver the exact original generated PDF bytes and vectors');
  check(receipt.includes('readable?: ReceiptTextDocument') && receipt.includes('preview?: ReceiptPreviewDocument'), 'Preserve compatibility with existing file callers');
  check(!renderer.includes('receiptText') && renderer.includes('const page = doc.addPage([a4.width, a4.height])'), 'Text mode cannot change the one-A4-page PDF renderer');
  check(processor.includes('block.headers.map') && processor.includes('block.rows.forEach') && processor.includes('block.entries.forEach'), 'Retain every field, equipment row and signature entry');
  check(processor.includes('entry.signature.map(stroke => stroke.map(point =>') && !processor.includes('.slice(0,'), 'Do not mutate historical strokes or truncate content');
  check(hook.includes('shareReceipt(file) : downloadReceipt(file)') && !hook.includes('ReceiptViewMode'), 'Selected mode cannot alter file delivery or PDF-generation dependencies');
  check(transaction.includes('Print.printAsync({ html: await transactionPrintHtml'), 'Printing remains the existing A4 print flow');
});
