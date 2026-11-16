# OG6 functional upgrade

## Storage and compatibility

This is an additive upgrade to the existing five-tab Expo application. Existing `og6.tracker.v1` records remain in place. No operational records are deleted or migrated to a different backend. The operational source of truth is the complete device-local TrackerContext/AsyncStorage snapshot, not a filtered screen list. Drive integration and Google sign-in were not completed by this upgrade and are not represented as working synchronization.

Optional fields now include equipment-lot quantity, per-withdrawal quantities/snapshots/reference, batches, return events and a separate name directory. Original equipment IDs, transaction IDs, dates, signatures, archival records and alarm acknowledgement history are retained. Legacy serialized equipment has an effective capacity of one; legacy completed returns remain valid without fabricating new timestamps or return events.

## Withdrawals and returns

- Existing single withdrawal, signature and single return forms remain available.
- Withdrawals also includes Batch Transactions, with inventory multi-selection and manual equipment entry.
- Manual items are only registered during the final atomic save. Their quantity defines one inventory lot; serialized equipment remains quantity one.
- New single and batch withdrawals share the same validation engine. A batch has one UUID-based reference and individual UUID-based withdrawal records, quantities, equipment snapshots and activity entries.
- An item already OUT/overdue or archived cannot be released again. Quantity cannot exceed its inventory capacity. A partially returned lot stays OUT until all units from that withdrawal have returned; its availability is not split into concurrent withdrawals.
- Review screens precede batch withdrawal and batch/partial return confirmation. Availability and return balances are rechecked under the provider's write lock.
- A return can select individual items and quantities; zero or blank skips an item. Every successful return creates an immutable return event with its own ID and a shared return reference. Previous partial return personnel, remarks and timestamps remain in that event history.
- A complete return sets the final returned timestamp, completes alarm handling and allows another withdrawal. Partial returns do not invent a complete-return timestamp.
- Batch and individual PDF receipts remain exportable/shareable. Batch return PDFs can be selected by return reference. Print exported PDFs with the platform's PDF viewer; direct printer integration is not configured.
- Excel withdrawal history adds batch reference and quantity columns while retaining the four existing worksheets.
- Duplicate batch requests and duplicate return requests are no-ops. In-flight submission guards and a provider write lock prevent overlapping database mutations. No successful operation is reported until the full snapshot saves.

## Name history

Releasers and receivers have independent persistent directories. Initial suggestions are derived from existing transaction history without editing historical personnel names. New names are appended only as part of a successfully saved transaction. Whitespace is collapsed and case differences are ignored when checking duplicates. Returning personnel populate the releaser directory and receiving personnel populate the receiver directory.

Searchable suggestions appear in single and batch movement forms. Settings includes searchable name management. Edit/removal requires the existing server-held administrator password and an online verification for each action. Directory changes never rewrite old transactions; removed suggestions are not silently reseeded on restart. Reusing a removed name in a later successful transaction can add it again.

## Complete backups

Settings → Complete Backup & Restore offers:

1. **Export complete backup:** creates a versioned JSON envelope containing all inventory, withdrawals, batches, individual return events, activities, archived records, notices, alarm acknowledgement decisions, name directories, import audits and settings. Selected audio files are embedded as binary-to-base64 backup media, not stored in database columns. Missing selected media stops a complete export instead of producing an incomplete backup. The supported JSON size is 64 MB.
2. **Import backup:** reads a user-selected JSON file, verifies format/version and a SHA-256 checksum, validates record shapes, dates, unique IDs, serials, foreign references, batch membership, active withdrawals and return quantity reconciliation, and displays counts before any restoration.
3. **Merge:** retains current settings/audio and current record IDs. Identical records are skipped, new records/names are added, and conflicting same-ID records, serials or unavailable equipment stop the whole merge. There is no silent conflict overwrite.
4. **Full restore:** explicitly replaces the complete operational snapshot with the reviewed backup, including its settings. Audio is decoded/staged to fresh device-local file IDs, preventing overwrite of existing clips. Original operational IDs and timestamps are preserved.
5. **Final confirmation:** restore requires administrator password verification and explicit confirmation. A stale preview fails if device records changed after review. An independent pre-restore snapshot is saved before the main-store write. A storage, validation or authorization failure leaves current records intact; staged uncommitted audio is cleaned up.
6. **Recovery:** Export Pre-Restore Recovery Snapshot downloads/shares the most recent pre-restore dataset. Import that file and review a full restore to recover it. Existing committed audio files remain available for recovery. Only the latest pre-restore recovery slot is retained; export it before performing another restore.

Web exports request a browser download; Android/iOS exports open the native share/save sheet. These UI actions are not a guarantee that a user completed saving/sharing a file. Files can be transferred through an authorized file-sharing method to another compatible upgraded installation and imported there. Clearing device/browser storage removes local records, audio and the recovery slot. Portable backup files provide storage independent of local browser storage.

Backups contain sensitive personnel/equipment data and are **not encrypted**. The checksum detects corruption, not authorship or confidentiality. Keep them in protected storage and share only with authorized recipients. The app excludes credentials, installation secrets, passwords and access tokens from its whitelisted backup schema.

## Themes

Settings provides Light Mode, Dark Mode and System Default. Both actual surface palettes use the restored navy-and-blue command identity with theme-specific contrast tokens. System Default reacts to the device color scheme. The preference remains in the existing settings snapshot.

Headers, navigation, dashboard metrics, inputs, dialogs, receipt controls, status badges and new name/backup/batch sections consume the resolved theme. Light mode does not display tactical dark wallpaper. Blue buttons use contrasting white labels. The reference tactical header and sidebar are visible in dark mode; the supplied Philippine Army 4ID G6 crest replaces the previous drawn emblem. Exported PDFs use the readable light document palette.

## Administrator verification

`og6-authorize-maintenance` uses the existing `OG6_ADMIN_PASSWORD` server secret, an existing database rate limiter, bounded requests and constant-time derived-password comparison. Each approved restore/name operation records installation ID, action, request ID and fingerprint in the additive RLS-enabled `og6_maintenance_authorizations` table. Clients have no table policies; access is service-role-only. Passwords and full operational snapshots are not logged or uploaded to that audit table.

Existing edit and archive security remains in place. Quantity is preserved during edits and included in archival stale-record detection/audits. The local operator/viewer preference is still not authentication or a boundary against direct device-storage tampering; trusted-device use remains necessary.

## Validation status and release checklist

Code paths and dependencies were reviewed, and the additive database migration/rate-limiter signatures were inspected. Regression test files were added. **No automated runner, installed-device session, printer, native sharing or cross-device file-transfer test was available in this editing session. The tests below have not been executed and must not be described as passed.**

Suggested commands in an exported development environment:

```sh
npx tsc --noEmit
# Runtime-only Deno tests avoid resolving platform-only imports used solely for TypeScript types.
deno test --no-check --import-map=tests/upgrade-import-map.json tests/movements.test.ts tests/nameHistory.test.ts tests/backupEnvelope.test.ts tests/theme.test.ts
# Run the existing import/audio/compact-layout regression suites with their existing import maps as well.
```

Before release, use disposable test records/backup copies and verify:

| Scenario | Expected result | Execution status |
| --- | --- | --- |
| Single withdrawal | One item OUT, signature/reference and receipt retained | Pending runtime/device verification |
| Multiple batch withdrawal | One reference, distinct IDs and quantities, no partial save | Pending runtime/device verification |
| Partial return | Event appended, remainder OUT and monitored | Pending runtime/device verification |
| Complete return | Zero outstanding, final timestamp, equipment IN | Pending runtime/device verification |
| Releaser suggestions | Search/select/new name and normalized duplicates | Pending runtime/device verification |
| Receiver suggestions | Independent searchable history | Pending runtime/device verification |
| Name persistence/management | Restart retains history; admin errors do not alter records | Pending runtime/device verification |
| Complete export | Archived/hidden records, batches, returns, settings and actual audio included | Pending runtime/device verification |
| Cross-device import | Android/iOS/browser transfer retains operational IDs/timestamps | Pending physical-device verification |
| Full restore | Preview, password, confirmation, recovery copy and restored audio | Pending runtime/device verification |
| Merge | Identical IDs skipped; conflicting records stop safely | Pending runtime/device verification |
| Duplicate submission | No repeated transaction/return history or audio | Pending runtime/device verification |
| Light/dark across five tabs | No opposite-theme backgrounds; readable forms/popups | Pending visual/device verification |
| System mode/persistence | Device appearance and restart preference retained | Pending physical-device verification |
| Existing features | Inventory edit/archive, scanner/import, reports, receipts and alarms remain functional | Pending regression verification |

Also verify corrupted/truncated backups, missing audio, wrong password, rate limiting, insufficient storage, network failure, changing records after preview, cancellation, long names and 320px/768px/desktop portrait/landscape layouts before deployment.
