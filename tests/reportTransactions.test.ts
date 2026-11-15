import { reportTransactions } from '../services/reportTransactions.ts';
import type { ReportWithdrawal } from '../services/reportTransactions.ts';
import type { Asset } from '../services/tracker.ts';
const check = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
const withdrawnAt = '2026-11-14T08:00:00Z', returnedAt = '2026-11-15T07:00:00.123Z';
const original = [[{ x: 10, y: 20 }, { x: 70, y: 40 }, { x: 200, y: 80 }]];
const accepting = [[{ x: 40, y: 10 }, { x: 90, y: 90 }, { x: 210, y: 70 }]];
const assets: Asset[] = [1, 2].map(number => ({ id: `AST-${number}`, name: `Radio ${number}`, serial: `000${number}`, notes: '', createdAt: withdrawnAt, updatedAt: withdrawnAt }));
const record: ReportWithdrawal = { id: 'WD-1', assetId: 'AST-1', releaser: 'Issuer', receiver: 'Borrower', signature: original, withdrawalAt: withdrawnAt, dueAt: returnedAt, createdAt: withdrawnAt, notes: '', returnedAt, receiving: 'Storekeeper', returning: 'Returning operator', receivingSignature: accepting, receivingSignatureAt: returnedAt };
Deno.test('withdrawal and return have separate personnel, event times and actual signature ownership', () => {
  const before = JSON.stringify({ record, assets });
  const withdrawal = reportTransactions([record], assets, 'withdrawal')[0];
  const returned = reportTransactions([record], assets, 'return')[0];
  check(withdrawal.at === withdrawnAt && withdrawal.releaser.name === 'Issuer' && withdrawal.receiver.name === 'Borrower', 'Withdrawal names and date.');
  check(withdrawal.releaser.signature === undefined && withdrawal.receiver.signature === original, 'Withdrawal evidence stays with its signer.');
  check(returned.at === returnedAt && returned.releaser.name === 'Storekeeper' && returned.receiver.name === 'Returning operator', 'Return roles must follow requested labels.');
  check(returned.releaser.signature === accepting && returned.receiver.signature === undefined, 'Return receiving signature belongs to RELEASER, not the person returning.');
  check(returned.releaser.capturedAt === returnedAt, 'Actual captured timestamp.');
  check(JSON.stringify({ record, assets }) === before, 'Preserve source records.');
});
Deno.test('multi-item sections require an explicit shared reference and matching event/evidence', () => {
  const first = { ...record, transactionId: 'BATCH-1' };
  const second = { ...first, id: 'WD-2', assetId: 'AST-2' };
  const group = reportTransactions([first, second], assets, 'return');
  check(group.length === 1 && group[0].items.length === 2 && group[0].id === 'BATCH-1', 'Both items in one explicit transaction.');
  check(group[0].items[1].serial === '0002', 'Serial is retained as text.');
  const unrelated = reportTransactions([record, { ...record, id: 'OTHER', assetId: 'AST-2' }], assets, 'withdrawal');
  check(unrelated.length === 2, 'Matching people/time alone must not combine unrelated transactions.');
  check(reportTransactions([first, { ...second, receiving: 'Different person' }], assets, 'return').length === 2, 'Different signers split a batch.');
  check(reportTransactions([first, { ...second, returnedAt: withdrawnAt }], assets, 'return').length === 2, 'Separate return events split a batch.');
  check(reportTransactions([first, { ...second, receivingSignature: original }], assets, 'return').length === 2, 'Never discard distinct signature evidence.');
});
Deno.test('additional explicitly captured releaser/returning evidence is exported only under its actual personnel role', () => {
  const withEvidence = { ...record, releaserSignature: accepting, releaserSignatureAt: withdrawnAt, returningSignature: original, returningSignatureAt: returnedAt };
  const withdrawal = reportTransactions([withEvidence], assets, 'withdrawal')[0];
  const returned = reportTransactions([withEvidence], assets, 'return')[0];
  check(withdrawal.releaser.signature === accepting && withdrawal.releaser.capturedAt === withdrawnAt, 'Read actual releaser evidence when present.');
  check(returned.receiver.signature === original && returned.receiver.capturedAt === returnedAt, 'Read actual returning-person evidence when present.');
  check(returned.releaser.signature === accepting, 'Do not replace the receiving-person signature.');
});
Deno.test('archived withdrawals and unfinished returns are omitted; legacy missing names/evidence are not invented', () => {
  check(reportTransactions([{ ...record, deletedAt: returnedAt }], assets, 'withdrawal').length === 0, 'Archived transaction excluded.');
  check(reportTransactions([{ ...record, returnedAt: undefined }], assets, 'return').length === 0, 'No return before the actual return event.');
  const legacy = reportTransactions([{ ...record, receiving: undefined, returning: undefined, receivingSignature: undefined, receivingSignatureAt: undefined }], assets, 'return')[0];
  check(legacy.releaser.name === '' && legacy.receiver.name === '' && legacy.releaser.signature === undefined, 'Do not reuse original withdrawal personnel/evidence for missing return data.');
});
