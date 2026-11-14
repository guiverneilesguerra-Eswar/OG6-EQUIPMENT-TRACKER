# Equipment edit authorization

## Scope
This change implements the requested equipment edit password using the configured server secret. It does not complete the earlier full-application repair, introduce centralized equipment storage, or configure background push. Server-authorized soft archival was added separately; see `archival-security.md`. Existing inventory, withdrawal/return records, signatures, reports and device preferences remain in their original device-local storage.

## Changes
- The configured credential is read only inside `supabase/functions/og6-authorize-edit/index.ts`. No configured password, credential hash or service-role key is included in client code.
- Every edit submission requires the user to enter a password. It is sent over the existing HTTPS backend connection for server verification, held transiently in form/request memory, and cleared after each attempt or dialog close. It is not included in AsyncStorage, equipment records, activities or audit entries.
- The create-equipment API no longer doubles as an unprotected edit path. The edit path holds the existing provider operation lock while awaiting server approval and local persistence.
- Server verification uses salted PBKDF2-SHA256 and a fixed-length comparison. The salt/hash remain within the Edge Function process; the configured plaintext credential remains only in managed server secrets.
- A durable atomic limiter reserves at most five failed/outstanding attempts per gateway-address bucket in a fifteen-minute window. Successfully verified and audited attempts release their reservation. Shared network addresses may share a limit. The deployment gateway must overwrite or append trustworthy forwarding headers; verify this in the deployed environment.
- Server approval is recorded before any local write. Audit requests are idempotent for the same installation, original asset and proposed changes. An audit row means **authorized**, not necessarily that device persistence succeeded.
- Authorization tables use RLS and no anon/authenticated access. Only the service role can execute their RPCs. Audit rows contain original and approved equipment data, not passwords or request headers.
- Missing credentials, failed authorization, validation errors, rate limiting and backend failures fail closed, with no approved local edit. Recoverable errors preserve equipment input. Controls are disabled during submission.
- Existing local edit history receives an activity only after local persistence succeeds. Existing transaction/signature references and asset IDs remain unchanged.

## Verification actually completed
- Read-only database inspection confirmed RLS on both new tables and denied SELECT/INSERT privileges for anon and authenticated roles.
- Read-only privilege checks confirmed all three RPCs deny execution to anon/authenticated and permit the service role.
- Cross-project source search located the configured edit-secret reference only in the Edge Function.
- Source review confirmed the only inventory create call is create-only; editing calls the dedicated server-authorized path.

## Added tests (not executed in this session)
`supabase/functions/og6-authorize-edit/validation.test.ts` covers normalization, absent credentials, invalid request references, required fields, archived records, invalid timestamps, excessive input and null characters. Run with:

```sh
deno test supabase/functions/og6-authorize-edit/validation.test.ts
```

## Deployment and device checks still required
1. Confirm `og6-authorize-edit` deploys successfully and has access to the configured server edit secret and built-in backend secrets. This endpoint uses password authorization; JWT verification is disabled for this function only.
2. Check an incorrect password rejects an edit, preserves the original record and clears the password field.
3. Check the correct password saves only the approved asset, retains its ID/creation timestamp, and records one local edit activity and one server approval.
4. Check repeated taps do not duplicate edits; retrying an unchanged failed local save uses the same server approval reference.
5. Check duplicate serials are rejected against existing local records.
6. Check offline/unavailable-server edits fail without local changes, and typed equipment details remain available for retry.
7. Check five incorrect attempts trigger throttling, and confirm gateway forwarding-header trust and expiry behavior.
8. Test Android/iOS/browser keyboard handling, password masking, rotation and all existing transaction/report flows.

No terminal, device runner or completed live-preview requests were available to perform compilation, Deno execution or end-to-end credential testing in this session. Do not treat this change as a production-readiness certification.

## Remaining security boundaries
Equipment is still device-local and may be altered by someone with direct access to local storage or modified client code. The password gates supported application edits and server approval records; it cannot make local storage tamper-proof. Shared passwords do not identify individual operators. Centralized authenticated records, user roles, encrypted/protected signatures and closed-app push remain separate work. Administrator-password archival is now implemented separately, with the same device-local tampering limitation. The edit secret is not used to authorize deletion.
