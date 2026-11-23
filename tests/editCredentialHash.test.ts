import { constantTimeEqual, deriveEditPassword } from '../supabase/functions/_shared/editCredential.ts';
Deno.test('server edit verifier accepts correct password and rejects incorrect password with salted PBKDF2 hashes', async () => {
  // Test credentials only; no configured secret or user password is read or logged.
  const salt = '01'.repeat(32); const password = 'test-only-edit-credential';
  const known = await deriveEditPassword(password, salt);
  if (!/^[a-f0-9]{64}$/.test(known)) throw new Error('Expected a 256-bit hash');
  if (!constantTimeEqual(known, await deriveEditPassword(password, salt))) throw new Error('Correct password rejected');
  if (constantTimeEqual(known, await deriveEditPassword('incorrect-test-password', salt))) throw new Error('Incorrect password accepted');
  if (constantTimeEqual(known, await deriveEditPassword(password, '02'.repeat(32)))) throw new Error('Distinct salts must produce distinct hashes');
  if (constantTimeEqual(known, known.slice(1))) throw new Error('Unequal-length hash accepted');
});
