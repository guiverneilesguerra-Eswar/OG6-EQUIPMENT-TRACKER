# Ultra-compact spacing and administrator archival

## Implemented
- Shared density tokens now use 6px card gaps, 8px padding, 8px section gaps, 4px header/icon gaps and 2px value/field gaps.
- Dashboard metrics, equipment rows, notification cards, forms, reports, settings and dialogs use the same density. Font sizes, rounded borders, shadows and military palettes are preserved. Interactive controls retain 48px touch targets; signature canvas coordinates are unchanged.
- Both inventory and withdrawal trash actions open the same password dialog. The existing managed administrator secret is read only by `og6-authorize-archive`. Its value is not embedded in source, environment files, logs or database records. The separate edit secret is not used for deletion.
- Incorrect credentials return exactly: `Incorrect administrator password. Access denied.` Offline, unavailable-server and failed-audit paths fail closed.
- Correct verification issues a cryptographically random, target-scoped, two-minute approval token, held only in memory. Only its SHA-256 digest is stored on the server. A separate final confirmation is required; cancellation does not archive anything.
- Confirmation verifies the token and installation reference on the server, then atomically appends an audit record for the authorized target. A retry of the same confirmed token returns the same timestamp, rather than inserting a duplicate audit.
- The local provider checks operator mode, record availability and a complete snapshot fingerprint before confirmation, and holds its existing operation lock through server confirmation and local persistence. Changed records require new authorization. Repeated taps cannot create concurrent local archive operations.
- Inventory archival is refused whenever the equipment has an active checkout, including overdue checkouts. The Edge Function also rejects submitted asset snapshots with active checkout references.
- Equipment is marked with `archivedAt`; withdrawals are marked with `deletedAt`. Nothing is physically removed. Original personnel data, signatures, returns, transactions and activities remain intact. A new local archive activity stores the server authorization reference, never a password or token.
- Archiving an active withdrawal cancels that checkout without fabricating a return. Availability is derived from remaining active withdrawals. Related reminders are acknowledged and audio is stopped only after the local save succeeds.
- Successful persistence immediately refreshes all five tabs through the shared provider. The dialog displays success only after the saved record is reflected in state. Equipment details retain archived withdrawal entries with explicit ARCHIVED status.

## Server configuration and audit
The configured administrator secret is already present in OnSpace Cloud. This implementation reuses it; it does not copy or rotate the secret. Confirm its intended value through Cloud > Secrets if a deployed credential fails verification. Both archive tables have RLS enabled and no client-role policies or grants. Only the Edge Function service role can access them. Confirmation RPC execution is denied to anon and authenticated roles.

The password comparison uses salted PBKDF2-SHA256 and a fixed-length comparison in the Edge Function process. The atomic attempt limiter allows at most five failed/outstanding attempts per gateway-address bucket in 15 minutes, independently of edit buckets. Verify that the deployment gateway supplies trustworthy forwarding headers. Shared network addresses can share a limit.

Server audit snapshots deliberately contain the authorized equipment/withdrawal data for accountability. They may contain personnel and signatures and must remain server-only. An audit confirmation proves server authorization, **not** successful device persistence. If a local save fails, the same in-memory confirmation can be retried idempotently. Closing or restarting loses the in-memory token; verifying again creates a new authorization record. There is no claim of distributed atomicity between PostgreSQL and device storage.

## Important security boundary
Equipment and transactions remain in existing device-local AsyncStorage. The server does not have an authoritative current inventory and validates the supplied snapshot, not independently synchronized checkout state. The password gates protect supported app actions and the server audit; they cannot prevent direct device-storage changes, a modified client, or deliberate false snapshots by an already-authorized password holder. Do not treat the preview role switch as authentication. Full tamper resistance requires a separate migration to centralized authenticated records with server-enforced equipment transactions and roles. No such migration or data reset is performed here.

## Verification performed
- Read-only database checks returned RLS enabled and no anon/authenticated SELECT/INSERT privileges for both archive tables.
- Read-only RPC checks returned no anon/authenticated execute permission and service-role execute permission.
- A forged, nonexistent approval ID with an invalid token digest was rejected by the database confirmation function, without inserting an audit record.
- Source search found no configured administrator password literal, and found the administrator-secret reference only in the new Edge Function.
- Additive schema operations did not remove or modify existing inventory, withdrawals, user records or edit authorizations.

## Tests added, not executed here
`supabase/functions/og6-authorize-archive/validation.test.ts` covers required credentials, UUID references, active asset protection, archived records, target matching, signature validation, linked assets, confirmation token format and exclusion of extra credential fields from audit snapshots.

Run `deno test supabase/functions/og6-authorize-archive/validation.test.ts` in a Deno-capable environment.

## Deployment and device tests still required
1. Verify the new Edge Function deploys and has access to managed administrator and built-in backend secrets. JWT verification is intentionally disabled for this password-authorized device-local endpoint only.
2. Incorrect password, empty password, throttling and offline verification must preserve the original record.
3. Correct password must advance to final confirmation without changing a record; cancel must preserve it.
4. Confirm asset archival with no checkout; verify it leaves active inventory, counts refresh, and the original asset stays in local data.
5. Try active/overdue equipment archival; verify it is rejected, even if its state changes after verification.
6. Confirm withdrawal archival; verify signatures and historical return fields remain, active status is recalculated, and no fake return is written.
7. Repeat taps and retry a failed local save; verify one audit per approval and one local archive activity.
8. Try expired, mismatched and forged tokens; verify confirmation is rejected.
9. Check Android, iOS and browser password masking, keyboard avoidance, short-landscape dialog scrolling, 320px portrait cards and desktop layouts.
10. Retest existing inventory/edit/withdrawal/return, receipt and Excel workflows.

No terminal, device runner or end-to-end credential test was available in this session. Compilation, Deno tests, audio behavior and device layouts have not been certified. This is not a production-readiness claim.
