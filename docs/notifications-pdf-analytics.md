# OG6 enhancement and verification

## Security and records

Operational records, signatures, audio and backups remain device-local. New receiving-personnel signatures have a separate `receivingSignature` field. Old `returnSignature` strokes retain their original returning signer and historical label. No migration overwrites personnel or signature attribution. Return condition is Serviceable, Unserviceable or Damage. A fully completed return sets current lot serviceability; individual partial return conditions remain in history.

Background notifications are opt-in. Administrator-password registration creates a scoped random device capability (native SecureStore; web origin storage). All push tables enable RLS with **no direct client policies**. Server private VAPID, service-role and optional Expo access credentials are read only through `Deno.env` in Edge Functions. The VAPID **public** key is necessarily returned for the standard browser `applicationServerKey`; it is not a secret. No private key appears in app code, .env, assets, URLs or logs. Web push endpoints are restricted to known provider hosts to prevent SSRF.

## Required scheduler setup

The backend lists pg_cron but rejects activation because this project database is not the `postgres` database. **No automatic server scheduler has been activated.** Deploy `og6-dispatch-push` and `og6-push-device`, then configure a trusted external scheduler to POST every minute to:

`https://smizfuxyxzcycikssmiz.backend.onspace.ai/functions/v1/og6-dispatch-push`

Use body `{ "schedulerSecret": "<private capability from og6_push_scheduler.secret>" }`. Retrieve this secret only using administrator database tooling; do not place it in a client environment variable, service worker, public URL or source repository. Keep it in the external scheduler's secure secret store. The private row is not accessible to anonymous or authenticated app clients. Settings displays the last successful dispatcher execution.

After scheduler setup: authorize this browser/device in Settings, enable background notifications, sync, then test and confirm receipt. VAPID keys alone do not set up native FCM/APNs. Mobile push also needs a real EAS project ID (`expo.extra.eas.projectId`) and FCM/APNs build credentials, followed by a new installed build. Existing IDs/build credentials were not invented. Browser push must be tested on the published secure origin with the service worker; the preview iframe is not sufficient. iOS browser push usually requires an installed home-screen web app and compatible iOS version.

Reminder evaluation is every dispatcher minute (not exact-to-the-second): due today starts at midnight PHT; upcoming uses 12/24/48 hours where not already due today; overdue starts at deadline; daily reminders occur each additional elapsed 24 hours. One highest-priority stage per equipment per scan avoids simultaneous alerts. Event keys include device, withdrawal, deadline, stage and overdue-day index. Atomic claims prevent concurrent dispatch duplicates. Provider failures/uncertain submissions are recorded and not blindly retried (at-most-once submission trades possible missed events for duplicate prevention). Daily reminders continue; inspect the ledger for failures. Provider acceptance is not delivery confirmation. OS offline/Do Not Disturb restrictions and Android force-stop cannot be bypassed.

Returns persist locally first and immediately synchronize the active-loan snapshot. A completely returned or archived record is removed from that snapshot. Partial returns retain only outstanding quantities. Offline returns show pending synchronization and retry every 30 seconds while the app is open. An already submitted notification cannot be recalled; an offline, not-yet-synced return may still generate a server reminder. This is an explicit limitation of preserving the local-first source of truth, not a centrally synchronized multi-device inventory.

## PDF controls

Receipt exports and analytics PDF exports offer paper A4/Letter, Portrait/Landscape, logo, timestamp, page numbering, signature inclusion, title and filename. Analytics also select summary, inventory, transactions and charts independently. Reports add Prepared By, Checked By and Approved By sections. PDF generation uses wrapped text, pagination, light print colors, embedded OG6 crest and vector charts.

- Supported desktop browsers: File System Access save picker, success only after writable close.
- Other browsers: download requested, not folder-save confirmation.
- Android: Storage Access Framework folder authorization and confirmed write. Downloads is preselected where the picker supports it; silently writing arbitrary shared-storage folders is not allowed.
- iOS: native Files/share interface. Save to Files is controlled by iOS; final completion/location cannot be observed.
- Preview: browser PDF viewer or native PDF/print preview. OS/browser blocked dialogs are reported, not represented as confirmed saving.

## Analytics definitions

Utilization = distinct currently OUT inventory records / current active inventory records × 100; units are reported separately. Availability excludes Unserviceable/Damage lots. No categories are guessed; legacy category is Uncategorized. Inventory and outstanding counters are current snapshots; period filters apply separately to withdrawal time and return event time. Receiver/releaser and equipment/category limit the scope. Withdrawals and returns use distinct references. Compliance = completed equipment withdrawal lines returned by their deadline / equipment withdrawal lines completed in the period × 100. Partial return quantities come from individual return events, with legacy completion fallback only when no events exist. Average durations use equipment lines, not an unweighted sum of partial events. Empty denominators display 0%, not NaN. All calculations recompute from shared tracker state and the clock. Archived records remain in backups/history but are omitted from operational analytics.

Excel/CSV exports contain summary, inventory and detailed events as applicable; formula-like user strings are escaped. Existing accountability workbook and all backup functions remain available.

## Verification status

Added regression specifications for schedule boundaries, deduplication keys, legacy/partial returns, receiving signature ownership, backup preservation and analytics denominators. This editing environment provides no command runner or device simulator, so tests have **not been executed** and real platform delivery/file saving is **not verified**.

Required release checks: installed iOS and Android tests with app foreground/background/terminated, success/cancellation/permissions denied, actual push confirmation, duplicate dispatcher invocations, partial/full return sync, offline return warnings, scheduler failure, midnight PHT and due boundaries; browser service worker/notification click navigation; PDF choose/download/preview on desktop, Android and iOS; chart recalculation after movements and inventory updates; Light and Dark appearance; restore legacy backups without altering strokes/personnel. Never uninstall or clear device storage to test an update containing operational records.
