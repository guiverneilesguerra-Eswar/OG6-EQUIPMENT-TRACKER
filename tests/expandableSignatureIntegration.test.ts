// Source safeguards, not a claim of successful installed-device interaction.
const source = (path: string) => Deno.readTextFile(new URL(path, import.meta.url));
function check(value: boolean, message: string) { if (!value) throw new Error(message); }
Deno.test('receiving signature views share one controller and parent save state', async () => {
  const [pad, hook, form] = await Promise.all([source('../components/feature/SignaturePad.tsx'), source('../hooks/useSignatureCanvas.ts'), source('../components/feature/WithdrawalForms.tsx')]);
  check((pad.match(/useSignatureCanvas\(/g) || []).length === 1, 'Do not fork drawing state into separate canvases');
  check(pad.includes('canvas(false)') && pad.includes('canvas(true)') && pad.includes('m.shown.map'), 'Both views render the same strokes');
  check(pad.includes('onPress={onSave}') && !hook.includes('setSaved'), 'Both views share the parent saved flag');
  const toggle = hook.split('const toggleExpanded =')[1]?.split('const clear =')[0] || '';
  check(toggle.includes('setExpanded') && !toggle.includes('onChange') && !toggle.includes('strokes.current = []'), 'Switching alone cannot erase or invalidate a signature');
  check(hook.includes('if (!active.current) return') && hook.includes('signaturePoint('), 'Only actual ink edits emit changes; coordinates are canonical');
  check(pad.includes('onRequestClose={m.toggleExpanded}') && pad.includes('SafeAreaView'), 'Device back and safe areas are supported');
  check(form.includes('disabled={busy} expandable') && form.includes('saved={m.receivingSignatureSaved}'), 'Receiving signatures expose expansion and retain explicit save state');
});
Deno.test('one-page receipts and legacy APIs use one complete shared renderer', async () => {
  const [renderer, transactions, receipts] = await Promise.all([source('../services/singleA4Document.ts'), source('../services/transactionReceipts.ts'), source('../services/receipts.ts')]);
  check((renderer.match(/doc\.addPage\(/g) || []).length === 1, 'One physical PDF page only');
  check(!transactions.includes('doc.addPage') && !receipts.includes('doc.addPage'), 'No alternate paginating renderer');
  check(transactions.includes('rows: items.map(w =>') && transactions.includes('entries: withdrawalSignatures'), 'All item rows and original signatures remain');
  check(transactions.includes('person: details.person, signature: details.signature'), 'Correct return signer remains');
  check(renderer.includes('escape(safe)') && renderer.includes('availableHeight / Math.max(1, y)'), 'Print text is escaped and all content is measured before fitting');
});
