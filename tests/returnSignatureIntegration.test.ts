// Source contracts supplement runtime/device testing; they do not claim device success.
const source = (path: string) => Deno.readTextFile(new URL(path, import.meta.url));
function check(value: boolean, message: string) { if (!value) throw new Error(message); }
Deno.test('unified return form captures receiving personnel signature and fixed equipment conditions', async () => {
  const [form, hook, selection] = await Promise.all([source('../components/feature/WithdrawalForms.tsx'), source('../hooks/useWithdrawals.ts'), source('../services/returnSelection.ts')]);
  check((form.match(/<FormModal /g) || []).length === 1, 'Keep one unified modal');
  check(form.includes('receiver={m.receiving}') && form.includes('value={m.receivingSignature} onChange={m.setReceivingSignature}') && form.includes('saved={m.receivingSignatureSaved}'), 'Receiving personnel must sign and save');
  check(form.includes('value={m.receivingSignature} onChange={() => {}} onSave={() => {}} saved readOnly'), 'Review signature is read-only');
  check(hook.includes('if (!receivingSignatureSaved) throw new Error'), 'Unsaved signature blocks submission');
  check(hook.includes('setReceivingValue(value); setReceivingSignatureValue([]); setReceivingSignatureSaved(false)'), 'Changing receiving person invalidates signature');
  check(hook.includes('setReceivingSignatureValue(value); setReceivingSignatureSaved(false)'), 'Editing signature invalidates save');
  check(selection.includes("['Serviceable', 'Unserviceable', 'Damage']") && form.includes('accessibilityRole="radio"'), 'Exact condition choices');
  check(!form.includes('placeholder="e.g. Good'), 'No free-text condition input');
});
Deno.test('PDF and history resolve actual signature role without relabeling legacy strokes', async () => {
  const [pdf, fallback, history, resolver] = await Promise.all([source('../services/transactionReceipts.ts'), source('../services/receipts.ts'), source('../components/feature/RecordDetails.tsx'), source('../services/returnSignatures.ts')]);
  check(pdf.includes('getReturnSignatureDetails(event)') && pdf.includes('person: details.person, signature: details.signature'), 'PDF uses selected event signer');
  check(pdf.includes('label: details.label.toUpperCase()') && pdf.includes('createSingleA4Document(content.title, content.blocks)'), 'PDF and print use actual signer label in shared one-sheet layout');
  check(fallback.includes('return createTransactionReceipt(localSnapshot, withdrawal, kind)'), 'Fallback PDF uses the shared role-aware renderer');
  check(history.includes('<ReturnSignatureView record={r} />'), 'History displays immutable event signature');
  check(resolver.includes('Returning personnel signature (historical)'), 'Historical signatures are never attributed to receiving personnel');
});
Deno.test('batch returns select all transactions and persist under existing provider lock', async () => {
  const [page, hook, builder, backup] = await Promise.all([source('../app/(tabs)/withdrawals.tsx'), source('../hooks/useWithdrawals.ts'), source('../services/movements.ts'), source('../services/backupValidation.ts')]);
  check(page.includes('onPress={m.beginBatchReturn}'), 'Withdrawals exposes batch return');
  check(hook.includes('if (batchReturn) return outstandingItems') && hook.includes('getOutstandingWithdrawals(tracker.data)'), 'Selection is not restricted to a transaction or list filter');
  check(hook.includes('selectedReturnLines(returnQuantities)') && hook.includes('await tracker.returnItems(input)'), 'Selected quantities use existing store');
  check(builder.includes('validateReturnSignature(input.receivingSignature)') && builder.includes('validateEquipmentCondition(input.condition)'), 'Builder revalidates signature and condition');
  check((builder.match(/receivingSignature: copyReturnSignature\(input.receivingSignature\)/g) || []).length === 2, 'Copy signature to latest summary and event');
  check((backup.match(/receivingSignature: signature.optional\(\)/g) || []).length === 2 && (backup.match(/returnSignature: signature.optional\(\)/g) || []).length === 2, 'Backups retain new and historical signature fields');
});
