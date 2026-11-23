# Due item editing and quantity alignment

## Operator workflow

1. Select **Edit** on a dashboard Due Item, or **Edit due item** on an outstanding withdrawal (Active, Overdue, Due Soon or All).
2. Enter the authorizing operator name and the **existing equipment edit password**. No new password is introduced.
3. The server verifies the password before unlocking any editable details. Incorrect passwords leave the original date and all records unchanged. Network failure denies edits rather than falling back to a client password check.
4. Update equipment name/serial/information, receiver/releaser, remarks, or the due date. **Remove due date** explicitly stages an empty date; it does not mark equipment returned.
5. Save the scoped approval within 10 minutes. Cancellation never commits staged changes. Expired, mismatched, changed-record or conflicting replay approvals are rejected.
6. The complete local database snapshot is saved before the shared TrackerProvider updates dashboard, inventory and withdrawal views. Item, asset, withdrawal and batch IDs are reused; no duplicate transaction is created.

## Retention and accountability

- Original transaction fields are saved on the first correction. Original withdrawal signatures are not reassigned to corrected receiver names. Return records, quantities, references and timestamps are unchanged.
- Each successful edit has an immutable server approval record and a local history record with before/approved details, previous/new due date, server modification timestamp, operator attribution and authorization ID.
- View details includes **Original withdrawal details** and **Authorized due item edit history**. Dashboard Recent Activities includes successful edits. PDF receipts retain original details, signatures and correction references and continue using the existing one-A4 renderer.
- Operator names are entered by the password holder, **not authenticated account identities**. The existing Operator/Viewer setting remains a workspace preference, not authentication. Individual verified identities would require an explicitly requested account-login feature.
- Records remain device-local. Password gates prevent changes through normal app workflows; they do not encrypt local storage or prevent deliberate external storage tampering. Server audit is an authorization log, not proof that a device successfully committed an approval after a storage failure.
- Full restore cannot change or remove an existing due date or erase protected correction history. This is an intentional bypass-prevention check at both restore preview and commit. Use Merge or a matching current backup; corrections to existing dates must go through Edit. A fresh installation with no existing records can restore a complete backup normally.
- Existing legacy backups remain compatible. New backups preserve original fields, edit audits and explicit removed dates. Conflicting merges are still rejected.

## Password handling

- Equipment edits and due-item edits share the existing equipment edit password, not the deletion/maintenance password.
- The first successful credential initialization derives the existing server-configured `OG6_EDIT_PASSWORD` into a random 32-byte salt and PBKDF2-SHA256 hash (600,000 iterations). Only the salt/hash are inserted into private `og6_edit_credentials`; new tables, local records and audit logs never contain plaintext passwords.
- The legacy `OG6_EDIT_PASSWORD` bootstrap secret is already present in this project. **After the first edit/password verification initializes the hash and both equipment and due-item editing have been verified, remove that legacy bootstrap secret through Cloud > Secrets if eliminating its retained plaintext source is required.** Both edit functions then rely on the persisted hash. Do not remove it before initialization. The existing deletion and maintenance secrets are unrelated and unchanged.
- Changing the bootstrap secret after initialization does not rotate the stored hash. Credential rotation needs an administrator-controlled migration; never put a password or hash in client code.
- Passwords are transient in masked fields and cleared after each verification attempt/close. Scoped tokens are memory-only, random, installation/record-bound, expire after 10 minutes and are stored server-side only as SHA-256 digests. Server rate limiting is shared with equipment edits. Responses have CORS and no-store headers; no request credentials are logged.
- Sessions, credentials and approvals have RLS enabled and no anon/authenticated access policies. The finalization RPC has no anon/authenticated execution privileges. New SQL is additive and does not modify any existing user records.

## Due monitoring

Changing/removing a due date starts a new due revision and archives previous notices as acknowledged history. Old alarm acknowledgements cannot silence a new due revision. Equipment/receiver-only corrections do not acknowledge existing alarms. An explicit removed date remains visible as **No due date**, stays outstanding, and is excluded from due/overdue reminders and counts.

## Quantity styling

All existing single-line shared numeric `Field` controls use horizontal `textAlign: center`, Android `textAlignVertical: center` and `includeFontPadding: false`. Existing font size, padding, minimum height and box width are unchanged. This covers manual withdrawal quantities, selected withdrawal quantities and return quantities, and any Add/Edit equipment field using the same numeric control. No unrelated quantity editing or inventory capacity rules were added.

## Verification status

Additive database setup and client RPC privilege checks were performed using the SQL tool. The following automated regressions were added but **not executed in this session**; no command runner/device automation was available:

```sh
deno test --no-check --allow-read --import-map=tests/due-edit-import-map.json tests/dueItemEdits.test.ts tests/dueItemProtectionIntegration.test.ts tests/editCredentialHash.test.ts supabase/functions/og6-authorize-due-item/validation.test.ts
```

Coverage includes correct/incorrect derived password comparisons, allowed fields, removal/extension dates, immutable IDs/quantities, duplicate serials, stale/changed-record approvals, audit and backup round trips, idempotence, original signature attribution, new due revisions, restore bypass rejection and shared quantity styling.

**Android and web interactive testing remains unverified.** Run this checklist with existing records backed up; do not uninstall or clear storage:

- Wrong password: verify editor stays locked; due date, counts and histories are unchanged.
- Correct password: extend/change/remove a due date; Save updates the same withdrawal and dashboard immediately, including a fresh reminder when due again.
- Edit equipment/receiver without changing due date: other withdrawal/return records remain unchanged and active alarms are not silenced.
- Attempt duplicate serial, due date before withdrawal, save twice, offline authorization, expired approval and a simultaneous return/edit; verify no duplicate or partial local commit.
- Navigate/restart; open details and receipts; check old/new dates, exact timestamp, operator name, authorization ID, original receiver/signature and all earlier return events.
- Restore a current complete backup and merge an identical backup; ensure edit history survives. Attempt an older backup that changes an existing due date; verify it is denied during review.
- Android installed build and web browser at phone/tablet/desktop widths: focus each quantity input, type 1/12/100, blur and reopen; number stays horizontally and vertically centered without changing box dimensions.
