function check(condition: boolean, message: string) { if (!condition) throw new Error(message); }
Deno.test('due date edits require scoped server authorization, not a client unlock flag', async () => {
  const [provider, server, service, editor, hash, controls, rows, dashboard, schema] = await Promise.all(['contexts/TrackerContext.tsx', 'supabase/functions/og6-authorize-due-item/index.ts', 'services/dueItemAuthorization.ts', 'components/feature/DueItemEditor.tsx', 'supabase/functions/_shared/editCredential.ts', 'components/ui/Controls.tsx', 'components/feature/EquipmentRows.tsx', 'components/feature/CommandDashboard.tsx', 'services/backupValidation.ts'].map(path => Deno.readTextFile(new URL(`../${path}`, import.meta.url))));
  check(provider.includes('confirmDueItem(approval, normalized)') && provider.includes('validateDueItemChanges(d, approval.before, changes)'), 'Every save must validate snapshot and invoke scoped server confirmation');
  check(provider.includes('await saveData(next); current.current = next; setData(next)'), 'Persist one complete snapshot before announcing success');
  check(provider.includes('assertProtectedRestore(d, next)'), 'Restore cannot bypass existing due protection');
  check(server.includes("body.phase === 'authorize'") && server.includes('verifyEditPassword') && server.includes('og6_reserve_edit_attempt'), 'Password and throttling required');
  check(server.includes('session.token_digest !== tokenDigest') && server.includes('session.installation_id !== body.installationId') && server.includes('Date.parse(session.expires_at) <= Date.now()'), 'Token scope and expiry required');
  check(server.includes("admin.rpc('og6_complete_due_edit'"), 'Audit must be durably recorded before response');
  check(hash.includes('600000') && hash.includes('PBKDF2') && hash.includes('SHA-256') && hash.includes('constantTimeEqual'), 'Salted PBKDF2 and timing-safe hash comparison required');
  check(!hash.includes('insert({ password') && !service.includes('AsyncStorage.setItem'), 'No password/token persistence on client');
  check(editor.includes('!m.approval ?') && editor.includes('Verify password & unlock edit') && editor.includes('Remove due date'), 'Protected prompt precedes fields and covers removal');
  check(rows.includes('Edit due item') && dashboard.includes('DueItemEditor') && dashboard.includes('Edit'), 'Both withdrawal and dashboard due rows expose Edit');
  check(controls.includes("keyboardType === 'numeric' && !multiline ? styles.quantityInput") && controls.includes("textAlign: 'center', textAlignVertical: 'center', includeFontPadding: false"), 'All shared numeric quantity fields center without resizing');
  check(schema.includes('dueItemEdits: z.array(dueAudit)') && schema.includes("dueAt: z.union([date, z.literal('')])"), 'Backups retain audit and explicitly removed due dates');
});
