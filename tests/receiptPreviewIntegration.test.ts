// Source contracts supplement generated-document tests and physical-device checks.
const source = (path: string) => Deno.readTextFile(new URL(path, import.meta.url));
function check(value: boolean, message: string) { if (!value) throw new Error(message); }
Deno.test('all shared receipt actions display generated preview before save and share', async () => {
  const [actions, transaction, receipt, renderer, hook] = await Promise.all([
    source('../components/feature/ReceiptActions.tsx'), source('../services/transactionReceipts.ts'), source('../services/receipts.ts'), source('../services/singleA4Document.ts'), source('../hooks/useReceipt.ts'),
  ]);
  check(actions.includes('<ReceiptPreview document={m.file.preview} filename={m.file.filename}'), 'Render the preview returned by actual PDF generation');
  const previewPosition = actions.indexOf('<ReceiptPreview');
  check(previewPosition < actions.indexOf('title="Share / send PDF"') && previewPosition < actions.indexOf("'Save PDF on device'"), 'Preview comes before both delivery actions');
  check(transaction.includes('bytes: file.bytes, base64: file.base64, preview: file.preview'), 'Preview and exported PDF must come from the same generation pass');
  check(renderer.includes('body>${previewSvg}</body>') && renderer.includes('bodyScale: scale'), 'Print and preview reuse measured vectors including true auto-fit');
  check(receipt.includes('preview?: ReceiptPreviewDocument') && receipt.includes('await saveNative(receipt, true)'), 'Preserve original file API and actual device save flow');
  check(hook.includes('shareReceipt(file) : downloadReceipt(file)'), 'Exports must still use the original generated file, never a screenshot');
  check(hook.includes('let cancelled = false') && hook.includes('if (!cancelled) setFile(result)'), 'Changing receipts cannot publish a stale generated preview');
});
Deno.test('receipt preview supports reachable zoom, fit and local vector panning without a native PDF dependency', async () => {
  const [preview, hook, modal, theme] = await Promise.all([
    source('../components/feature/ReceiptPreview.tsx'), source('../hooks/useReceiptPreview.ts'), source('../components/ui/FormModal.tsx'), source('../constants/theme.ts'),
  ]);
  check(preview.includes('import { SvgXml }') && preview.includes('xml={document.svg}'), 'Render local text/signature vectors with the existing cross-platform SVG package');
  check(!preview.includes('from \'react-native-webview\'') && !preview.includes('http') && !preview.includes('fetch('), 'Personnel preview must not use a remote PDF viewer or extra request');
  for (const label of ['Zoom out receipt', 'Zoom in receipt', 'Fit receipt to width and return to top']) check(preview.includes(`accessibilityLabel="${label}"`), `Missing accessible control ${label}`);
  check(preview.includes('disabled={!m.canZoomIn}') && preview.includes('disabled={!m.canZoomOut}'), 'Zoom limits must show explicit disabled states');
  check(theme.includes('controlHeight: 48, minZoom: 1, maxZoom: 8'), 'Keep 48-point targets and 100–800 percent zoom range');
  check(preview.includes('height: m.geometry.viewportHeight') && preview.includes('width: m.geometry.pageWidth, height: m.geometry.pageHeight'), 'The viewport is bounded but the entire zoomed page stays scrollable');
  check((preview.match(/nestedScrollEnabled/g) || []).length === 2 && modal.includes('nestedScrollEnabled onContentSizeChange'), 'Support nested two-axis scrolling in the existing receipt dialog');
  check(preview.includes('useReceiptPreview(document)') && hook.includes('useResponsive()') && hook.includes('m.geometry') === false, 'UI must use the logic hook and measured responsive geometry');
  check(hook.includes('scrollTo({ x: 0, y: 0, animated: false })') && hook.includes('setZoom(receiptPreviewLayout.minZoom)'), 'Fit and receipt changes reset the viewport and zoom');
  check(!hook.includes('saveData') && !hook.includes('createReceipt('), 'Preview interactions cannot write records or regenerate PDF bytes');
});
