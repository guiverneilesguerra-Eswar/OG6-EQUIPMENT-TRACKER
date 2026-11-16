// Structural safeguards; run alongside functional tests and installed-device checks.
const source = (path: string) => Deno.readTextFile(new URL(path, import.meta.url));
function check(value: boolean, message: string) { if (!value) throw new Error(message); }
Deno.test('batch return keeps selection, review and receipt in the same modal with explicit checkbox quantities', async () => {
  const [page, form, hook] = await Promise.all([source('../app/(tabs)/withdrawals.tsx'), source('../components/feature/WithdrawalForms.tsx'), source('../hooks/useWithdrawals.ts')]);
  check(page.includes('title="Batch return"') && page.includes('onPress={m.beginBatchReturn}'), 'Expose batch action in Withdrawals');
  check((form.match(/<FormModal /g) || []).length === 1, 'Do not create overlapping return modals');
  check(form.includes('data={m.visibleReturnItems}') && form.includes('extraData={m.returnQuantities}'), 'Rows reflect selected quantities');
  check(form.includes('m.toggleReturnItem(item.id)') && form.includes('accessibilityRole="checkbox"'), 'Every item has a selection control');
  check(form.includes('onPress={m.selectAllReturns}') && form.includes('onPress={m.clearReturnSelection}'), 'Provide explicit all/clear actions');
  check(hook.includes('returnReviewing ? returnItems.filter') && hook.includes('filterReturnItems(tracker.data, returnItems, returnQuery)'), 'Review includes selected items even if search hides them');
  check(hook.includes('showReceipt(anchor, \'return\', input.requestId)'), 'Open receipt for actual selected batch event');
});
Deno.test('cross-transaction receipts retain all participants without offering unrelated events', async () => {
  const [model, pdf, hook, provider] = await Promise.all([source('../services/withdrawalTransactions.ts'), source('../services/transactionReceipts.ts'), source('../hooks/useWithdrawals.ts'), source('../contexts/TrackerContext.tsx')]);
  check(model.includes("(data.returnRecords || []).filter(r => r.reference === selected)") && model.includes('isBatchReturn: true'), 'Resolve every participant in selected batch event');
  check(model.includes('events.some(r => r.reference === selected)'), 'Reject events unrelated to source transaction');
  check(hook.includes('getTransactionReturns(tracker.data, getWithdrawalItems(tracker.data, receiptWithdrawal))'), 'Return-event picker stays anchored to source transaction');
  check(pdf.includes('Original transaction:') && pdf.includes('model.isBatchReturn') && pdf.includes('${withdrawalSignaturesHtml}'), 'PDF and print preserve source identities and signatures');
  check(provider.includes('await saveData(next); current.current = next; setData(next)'), 'Persist atomically before success');
});
