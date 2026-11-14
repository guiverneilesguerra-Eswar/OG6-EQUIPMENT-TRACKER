import { parseEditRequest, RequestError } from './validation.ts';

function validRequest() {
  return {
    requestId: '315d41df-3e14-4e7c-a3b8-d9703e4c067c',
    installationId: '0c885df2-ea27-4ab4-99bd-2a1af10de1b4',
    password: 'test-only-input-not-a-configured-secret',
    before: { id: 'AST-TEST', name: 'Radio', serial: 'RAD-TEST', notes: 'Operational',
      createdAt: '2026-11-14T08:00:00.000Z', updatedAt: '2026-11-14T08:00:00.000Z' },
    changes: { name: ' Radio updated ', serial: ' RAD-TEST ', notes: ' Inspected ' },
  };
}
function mustReject(value: unknown) {
  let rejected = false;
  try { parseEditRequest(value); } catch (error) { rejected = error instanceof RequestError; }
  if (!rejected) throw new Error('Expected a validation rejection.');
}
Deno.test('normalizes changes while preserving the original record', () => {
  const result = parseEditRequest(validRequest());
  if (result.changes.name !== 'Radio updated' || result.changes.serial !== 'RAD-TEST'
    || result.changes.notes !== 'Inspected' || result.before.id !== 'AST-TEST') throw new Error('Normalization failed.');
});
Deno.test('rejects absent passwords', () => mustReject({ ...validRequest(), password: '' }));
Deno.test('rejects malformed request references', () => mustReject({ ...validRequest(), requestId: 'invalid' }));
Deno.test('rejects blank required fields', () => {
  for (const key of ['name', 'serial', 'notes']) {
    const value = validRequest();
    mustReject({ ...value, changes: { ...value.changes, [key]: '   ' } });
  }
});
Deno.test('rejects editing archived assets', () => {
  const value = validRequest();
  mustReject({ ...value, before: { ...value.before, archivedAt: '2026-11-14T09:00:00.000Z' } });
});
Deno.test('rejects invalid original timestamps', () => {
  const value = validRequest();
  mustReject({ ...value, before: { ...value.before, updatedAt: 'not-a-date' } });
});
Deno.test('rejects excessive input and embedded null characters', () => {
  const value = validRequest();
  mustReject({ ...value, changes: { ...value.changes, name: 'x'.repeat(201) } });
  mustReject({ ...value, changes: { ...value.changes, notes: 'bad\u0000text' } });
});
