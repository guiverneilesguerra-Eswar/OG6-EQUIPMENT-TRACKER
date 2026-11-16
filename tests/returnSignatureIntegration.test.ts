// Source contracts supplement, but do not replace, runtime/device checks.
const source = (path: string) => Deno.readTextFile(new URL(path, import.meta.url));
function check(value: boolean, message: string) { if (!value) throw new Error(message); }
Deno.test('existing return form captures, saves and reviews a separate returning signature', async () => {
  const [form, hook, pad] = await Promise.all([source('../components/feature/WithdrawalForms.tsx'), source('../hooks/useWithdrawals.ts'), source('../components/feature/SignaturePad.tsx')]);
  check((form.match(/<FormModal /g) || []).length === 1, 'Keep the existing unified form');
  check(form.includes('value={m.returnSignature} onChange={m.setReturnSignature}') && form.includes('saved={m.returnSignatureSaved}'), 'Capture and explicitly save returning strokes');
  check(form.includes('value={m.returnSignature} onChange={() => {}} onSave={() => {}} saved readOnly'), 'Review must show the return signature read-only');
  check(hook.includes('if (!returnSignatureSaved) throw new Error'), 'Unsaved signature must block return submission');
  check(hook.includes('setReturningValue(value); setReturnSignatureValue([]); setReturnSignatureSaved(false)'), 'Changing the signer invalidates the old signature');
  check(hook.includes('setReturnSignatureValue(value); setReturnSignatureSaved(false)'), 'Editing or clearing invalidates signature save state');
  check(hook.includes('remarks, returnSignature };') && hook.includes('await tracker.returnItems(input)'), 'Persist via the existing return flow');
  check(pad.includes('nameLabel') && pad.includes('&& !disabled'), 'Shared canvas must show correct signer labels and block drawing while saving');
});
Deno.test('PDF, print and history use the selected return event signature rather than withdrawal strokes', async () => {
  const [pdf, fallback, history, hook] = await Promise.all([source('../services/transactionReceipts.ts'), source('../services/receipts.ts'), source('../components/feature/RecordDetails.tsx'), source('../hooks/useWithdrawals.ts')]);
  check(pdf.includes('returnSignatureEntries(returns)') && pdf.includes('event.returning, event.returnSignature'), 'PDF must use the selected event and signer');
  check(pdf.includes('returnSignatureEntries(model.returns)') && pdf.includes('${returnSignatureHtml}'), 'Print must include selected event signature blocks');
  check(pdf.includes('No returning personnel signature recorded for this historical event.'), 'Do not fabricate unsigned historical signatures');
  check(fallback.includes('withdrawal.returnSignature') && fallback.includes('RETURNING PERSONNEL SIGNATURE'), 'Legacy single receipt API must support new signatures');
  check(history.includes('value={r.returnSignature}'), 'Show saved strokes in individual return history');
  check(hook.includes('receiptReturns.filter(r => r.reference === receiptReturnReference)'), 'Receipt UI must respect the selected event');
});
Deno.test('new signatures are validated and copied without changing legacy storage or backup versions', async () => {
  const [builder, backup, tracker] = await Promise.all([source('../services/movements.ts'), source('../services/backupValidation.ts'), source('../services/tracker.ts')]);
  check(builder.includes('validateReturnSignature(input.returnSignature)'), 'Validation cannot exist only in the UI');
  check((builder.match(/returnSignature: copyReturnSignature\(input.returnSignature\)/g) || []).length === 2, 'Copy signatures into latest summary and immutable return events');
  check((backup.match(/returnSignature: signature.optional\(\)/g) || []).length === 2, 'Backup schemas must preserve signatures on both record types without requiring old ones');
  check(tracker.includes("const key = 'og6.tracker.v1'"), 'Preserve the existing local data key');
});
