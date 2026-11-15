import { parseArchiveRequest } from '../supabase/functions/og6-authorize-archive/validation.ts';
const at = '2026-11-15T08:00:00.123Z';
const signature = [[{ x: 10, y: 20 }, { x: 80, y: 60 }, { x: 150, y: 90 }]];
const request = {
  phase: 'authorize', authorizationId: '55555555-5555-4555-8555-555555555555', installationId: '66666666-6666-4666-8666-666666666666', password: 'test-only-secret',
  snapshot: { kind: 'withdrawal', recordId: 'WD-1', activeWithdrawalIds: [],
    asset: { id: 'AST-1', name: 'Radio', serial: '00123', notes: 'Good', createdAt: at, updatedAt: at },
    withdrawal: { id: 'WD-1', assetId: 'AST-1', receiver: 'Original receiver', releaser: 'Releaser', signature,
      withdrawalAt: '2026-11-14T08:00:00Z', dueAt: '2026-11-16T08:00:00Z', createdAt: '2026-11-14T08:00:00Z', notes: 'Exercise',
      returnedAt: at, returning: 'Returning person', receiving: 'Receiving person', condition: 'Good', remarks: 'Complete', receivingSignature: signature, receivingSignatureAt: at } },
};
const check = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
Deno.test('archive whitelist preserves both signature events but not credentials', () => {
  const parsed = parseArchiveRequest(request);
  check(parsed.phase === 'authorize', 'Expected authorization phase.');
  if (parsed.phase !== 'authorize') return;
  check(JSON.stringify(parsed.snapshot.withdrawal?.receivingSignature) === JSON.stringify(signature), 'Return signature must remain in audit snapshot.');
  check(parsed.snapshot.withdrawal?.receivingSignatureAt === at, 'Return signature timestamp must remain in audit snapshot.');
  check(JSON.stringify(parsed.snapshot.withdrawal?.signature) === JSON.stringify(signature), 'Original signature must remain in audit snapshot.');
  check(!JSON.stringify(parsed.snapshot).includes(request.password), 'No credentials in audit snapshot.');
});
Deno.test('historical returns without receiver evidence remain archivable', () => {
  const legacy = { ...request, snapshot: { ...request.snapshot, withdrawal: { ...request.snapshot.withdrawal, receivingSignature: undefined, receivingSignatureAt: undefined } } };
  const parsed = parseArchiveRequest(legacy);
  check(parsed.phase === 'authorize', 'Legacy archival remains available.');
});
Deno.test('invalid or inconsistent return signatures cannot enter archival audit', () => {
  for (const fields of [{ receivingSignature: [] }, { receivingSignatureAt: '2026-11-15T08:30:00Z' }, { receivingSignature: undefined }, { receivingSignature: [[{ x: 501, y: 4 }]] }]) {
    let failed = false;
    try { parseArchiveRequest({ ...request, snapshot: { ...request.snapshot, withdrawal: { ...request.snapshot.withdrawal, ...fields } } }); } catch { failed = true; }
    check(failed, 'Invalid return evidence must be rejected.');
  }
});
