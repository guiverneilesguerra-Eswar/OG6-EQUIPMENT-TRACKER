import { assertEquals, assertThrows } from 'jsr:@std/assert';
import { parseArchiveRequest, RequestError } from './validation.ts';

const base = () => ({ phase: 'authorize', authorizationId: '12345678-1234-4234-8234-123456789abc', installationId: 'abcdefab-1234-4234-8234-123456789abc', password: 'test-only-placeholder',
  snapshot: { kind: 'asset', recordId: 'AST-TEST', asset: { id: 'AST-TEST', name: 'Test radio', serial: 'TEST-001', notes: 'Fixture only', createdAt: '2026-11-14T00:00:00.000Z', updatedAt: '2026-11-14T00:00:00.000Z' }, withdrawal: null, activeWithdrawalIds: [] as string[] } });
const withdrawalRequest = () => { const input = base(); return { ...input, snapshot: { ...input.snapshot, kind: 'withdrawal', recordId: 'WD-TEST', activeWithdrawalIds: ['WD-TEST'], withdrawal: { id: 'WD-TEST', assetId: 'AST-TEST', releaser: 'Fixture releaser', receiver: 'Fixture receiver', signature: [[{ x: 1, y: 1 }, { x: 20, y: 20 }, { x: 30, y: 30 }]], withdrawalAt: '2026-11-14T01:00:00.000Z', dueAt: '2026-11-15T01:00:00.000Z', createdAt: '2026-11-14T01:00:00.000Z', notes: '' } } }; };
Deno.test('available equipment accepts a scoped authorization request without leaking password into snapshot', () => {
  const result = parseArchiveRequest(base());
  if (result.phase !== 'authorize') throw new Error('Wrong phase');
  assertEquals(result.snapshot.recordId, 'AST-TEST');
  assertEquals(JSON.stringify(result.snapshot).includes('test-only-placeholder'), false);
});
Deno.test('missing password is rejected', () => { assertThrows(() => parseArchiveRequest({ ...base(), password: '' }), RequestError); });
Deno.test('invalid authorization and installation IDs are rejected', () => { assertThrows(() => parseArchiveRequest({ ...base(), authorizationId: 'invalid' }), RequestError); assertThrows(() => parseArchiveRequest({ ...base(), installationId: 'invalid' }), RequestError); });
Deno.test('asset with active checkout cannot be archived', () => { const input = base(); input.snapshot.activeWithdrawalIds = ['WD-TEST']; assertThrows(() => parseArchiveRequest(input), RequestError, 'currently withdrawn'); });
Deno.test('already archived equipment is rejected', () => { const input = base(); assertThrows(() => parseArchiveRequest({ ...input, snapshot: { ...input.snapshot, asset: { ...input.snapshot.asset, archivedAt: '2026-11-14T01:00:00.000Z' } } }), RequestError); });
Deno.test('target mismatch is rejected', () => { const input = base(); input.snapshot.recordId = 'AST-OTHER'; assertThrows(() => parseArchiveRequest(input), RequestError); });
Deno.test('active withdrawal can be soft archived with its original signature', () => { const result = parseArchiveRequest(withdrawalRequest()); if (result.phase !== 'authorize') throw new Error('Wrong phase'); assertEquals(result.snapshot.kind, 'withdrawal'); assertEquals(result.snapshot.withdrawal?.id, 'WD-TEST'); });
Deno.test('invalid signature and linked asset are rejected', () => { const input = withdrawalRequest(); input.snapshot.withdrawal.signature[0][0].x = -1; assertThrows(() => parseArchiveRequest(input), RequestError); const other = withdrawalRequest(); other.snapshot.withdrawal.assetId = 'AST-OTHER'; assertThrows(() => parseArchiveRequest(other), RequestError); });
Deno.test('already archived withdrawal is rejected', () => { const input = withdrawalRequest(); assertThrows(() => parseArchiveRequest({ ...input, snapshot: { ...input.snapshot, withdrawal: { ...input.snapshot.withdrawal, deletedAt: '2026-11-14T01:00:00.000Z' } } }), RequestError); });
Deno.test('confirm requires a full random-token format', () => {
  assertThrows(() => parseArchiveRequest({ ...base(), phase: 'confirm', token: 'invalid' }), RequestError);
  const result = parseArchiveRequest({ ...base(), phase: 'confirm', token: 'a'.repeat(64) });
  assertEquals(result.phase, 'confirm'); assertEquals('password' in result && result.password !== undefined, false);
});
Deno.test('extra top-level and asset credential fields are excluded from audit snapshot', () => {
  const input = base(); const result = parseArchiveRequest({ ...input, extra: 'not-audited', snapshot: { ...input.snapshot, asset: { ...input.snapshot.asset, password: 'not-audited' } } });
  if (result.phase !== 'authorize') throw new Error('Wrong phase');
  assertEquals(JSON.stringify(result.snapshot).includes('not-audited'), false);
});
Deno.test('invalid dates and excessive fields are rejected', () => { const input = base(); input.snapshot.asset.updatedAt = 'invalid'; assertThrows(() => parseArchiveRequest(input), RequestError); const huge = base(); huge.snapshot.asset.notes = 'x'.repeat(10001); assertThrows(() => parseArchiveRequest(huge), RequestError); });
