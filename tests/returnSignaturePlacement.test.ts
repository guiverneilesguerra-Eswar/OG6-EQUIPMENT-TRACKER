const check = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
Deno.test('return form uses receiving personnel and requires an explicitly saved return signature', async () => {
  const form = await Deno.readTextFile(new URL('../components/feature/WithdrawalForms.tsx', import.meta.url));
  const hook = await Deno.readTextFile(new URL('../hooks/useWithdrawals.ts', import.meta.url));
  check(form.includes('receiver={m.receiving} value={m.receivingSignature}'), 'Return pad must belong to receiving personnel, not original receiver.');
  check(form.includes('saved={m.returnSignatureSaved}'), 'Saved state must be separate from the withdrawal signature.');
  check(hook.includes("setReceivingValue(value); setReceivingSignatureValue([]); setReturnSignatureSaved(false);"), 'Changing receiving personnel must clear saved signature evidence.');
  check(hook.includes('if (!returnSignatureSaved) throw new Error'), 'Unsaved signature must block return submission.');
  check(hook.includes('{ returning, receiving, condition, remarks, receivingSignature }'), 'Return operation must receive the signature.');
});
Deno.test('single-sheet PDF generation does not silently add pages or mislabel Helvetica as Arial', async () => {
  const source = await Deno.readTextFile(new URL('../services/receiptPdf.ts', import.meta.url));
  check((source.match(/doc\.addPage\(/g) || []).length === 1, 'Only one A4 page may be created.');
  check(!source.includes('ensureSpace') && !source.includes('addPage ='), 'No automatic pagination.');
  check(source.includes("signatureBox('Receiver signature on return', w.receiving || '', w.receivingSignature"), 'Return receipt must render its independent return signature.');
  check(source.includes('StandardFonts.Helvetica') && source.includes('not an Arial alias'), 'Interim font must not be falsely represented as actual Arial.');
});
