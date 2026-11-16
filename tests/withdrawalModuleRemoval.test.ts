// Source-contract checks; run together with functional movement tests and installed-device checks.
const source = (path: string) => Deno.readTextFile(new URL(path, import.meta.url));
function check(value: boolean, message: string) { if (!value) throw new Error(message); }
async function absent(path: string) {
  let exists = true;
  try { await Deno.stat(new URL(path, import.meta.url)); }
  catch (error) { if (error instanceof Deno.errors.NotFound) exists = false; else throw error; }
  check(!exists, `Removed module is still present: ${path}`);
}
Deno.test('the separate batch module is removed while all five standard tabs remain', async () => {
  await Promise.all([absent('../components/feature/BatchWithdrawals.tsx'), absent('../hooks/useBatchWithdrawals.ts'), absent('../services/batchReceipts.ts')]);
  const [page, tabs, form, hook] = await Promise.all([source('../app/(tabs)/withdrawals.tsx'), source('../app/(tabs)/_layout.tsx'), source('../components/feature/WithdrawalForms.tsx'), source('../hooks/useWithdrawals.ts')]);
  check(!page.includes('BatchWithdrawals') && !form.includes('New batch'), 'No separate batch UI may remain');
  check((tabs.match(/<Tabs\.Screen /g) || []).length === 5, 'Preserve the existing five tabs');
  check(page.includes('onPress={m.beginWithdrawal}') && page.includes('<WithdrawalForms model={m}'), 'Use the existing standard action and form');
  check((form.match(/<FormModal /g) || []).length === 1, 'One native modal must handle creation, review, return and receipt');
  check(form.includes('accessibilityRole="checkbox"') && form.includes('Quantity to withdraw *'), 'Multi-selection must keep per-item quantities');
  check(hook.includes('selectedItems') && hook.includes('totalUnits') && form.includes('m.items.length'), 'Keep both equipment count and unit totals');
  check(hook.includes('saving.current = true') && hook.includes('validateWithdrawalDraft(tracker.data, input, saved)'), 'Guard and revalidate final submission');
  check(hook.includes('await tracker.returnItems(input)'), 'Use the existing transaction store for partial returns');
});
Deno.test('shared receipt actions generate and print every equipment line and selected return event', async () => {
  const [receipts, transactionReceipts, hook, actions, renderer] = await Promise.all([source('../services/receipts.ts'), source('../services/transactionReceipts.ts'), source('../hooks/useReceipt.ts'), source('../components/feature/ReceiptActions.tsx'), source('../services/singleA4Document.ts')]);
  check(receipts.includes('if (data) return createTransactionReceipt(data, withdrawal, kind, returnReference)'), 'Existing receipt API must use complete transaction data');
  check(transactionReceipts.includes('rows: items.map(w =>') && transactionReceipts.includes('createSingleA4Document(content.title, content.blocks)'), 'PDF and print use the same complete item layout');
  check(transactionReceipts.includes('getTransactionReceiptModel(data, withdrawal, kind, returnReference)'), 'Return receipts must select an actual immutable return event');
  check(renderer.includes('htmlEntities: Record<string, string>') && renderer.includes('escape(safe)'), 'Printable user text must be escaped safely');
  check(transactionReceipts.includes('Print.printAsync({ html: await transactionPrintHtml'), 'Printing must open a real platform/browser print flow');
  check(hook.includes('receiptData, returnReference') && actions.includes('Print complete receipt'), 'Existing actions must expose complete exports and printing');
});
Deno.test('compatibility fields and durable local persistence remain unchanged', async () => {
  const [tracker, provider, validation] = await Promise.all([source('../services/tracker.ts'), source('../contexts/TrackerContext.tsx'), source('../services/backupValidation.ts')]);
  check(tracker.includes("const key = 'og6.tracker.v1'"), 'Do not move or reset existing device records');
  check(tracker.includes('batchId?: string; reference?: string; quantity?: number; returnedQuantity?: number;'), 'Retain old transaction metadata');
  check(provider.includes('await saveData(next); current.current = next; setData(next)'), 'Success must follow durable full-snapshot storage');
  check(provider.includes('withdrawTransaction') && provider.includes('returnItems'), 'Expose unified movement actions');
  check(validation.includes('batches: z.array') && validation.includes('returnRecords: z.array') && validation.includes('nameDirectory: z.object'), 'Old backups and name history must remain compatible');
});
