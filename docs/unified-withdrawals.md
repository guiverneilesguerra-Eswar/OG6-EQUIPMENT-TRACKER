# Standard single/multiple equipment withdrawal

## User workflow

Withdrawals → New equipment withdrawal is the sole creation entry point. The separate Batch Transactions card, create button, form and hook have been removed. The five existing tabs are unchanged.

1. Open the searchable equipment multi-select. Search by Asset ID, name, serial or description. Select one or more items; OUT/overdue items cannot be selected.
2. Review the selected list, remove items or enter individual whole-number quantities. Serialized legacy items have capacity one. Inventory lot quantities cannot exceed capacity. The form displays both equipment count and total units.
3. Manual Entry remains supported. Add each manual item to this same list before review. A new item receives its permanent Asset ID only during final save. Existing matching inventory serials reuse the inventory record after availability/quantity checks.
4. Enter releaser, receiver, save the receiver signature, set withdrawal and expected-return dates and enter remarks. Persistent separate personnel suggestions remain available.
5. Review all items and the one transaction reference, then Confirm & save withdrawal. Current inventory availability and quantities are revalidated under the existing provider write lock. The complete snapshot is persisted before success is shown.
6. The confirmation displays all equipment and their individual IDs. Share/send, save/download and Print complete receipt include every equipment line under this reference. The print command opens the device/browser print dialog; an available printer or system print-to-file service is required. Downloaded PDFs can also be printed from a PDF viewer.

## Returns and past transactions

Each ordinary equipment row retains its individual return action and history. Return equipment opens the same standard dialog, listing outstanding items from that transaction. Only the clicked item's outstanding quantity is preselected. Other quantities default to zero/blank and are not changed unless explicitly entered. Return all outstanding quantities is an optional shortcut. Review and confirm before recording the return.

Each return event has its own immutable reference, personnel, condition, remarks, quantity, actual timestamp and returning personnel signature. Enter the returning name, sign with a finger/pen/mouse and choose Save signature before reviewing. The confirmation shows the signature read-only. Changing the returning name or editing/clearing the signature requires a fresh signature save. Signature controls are disabled during final persistence.

The signature is required for new partial and complete returns and is validated again by the movement builder under the provider lock. It is captured separately from the original receiver signature and copied into each selected item’s return event. Returning other equipment later requires another signature; exporting an earlier event uses that event’s own signature, never the latest signer. Complete receipts show the signature once per signer/event, along with the return reference and timestamp. Individual return history retains the captured strokes.

Optional `returnSignature` fields retain compatibility with older records and backups. Full backup validation and merge preserve new signature data. Older unsigned events display an explicit “No returning personnel signature recorded” message rather than using the original withdrawal signature or fabricating a signature. This is handwritten acknowledgement capture, not cryptographic identity verification. Data continues to stay in the existing device-local tracker; no records are migrated or cleared. Partial quantities do not complete the withdrawal or silence its overdue monitoring. A lot stays OUT until its outstanding balance is zero. Returning one item never updates other transaction items implicitly.

Complete receipt opens the entire original transaction, including older grouped withdrawals previously created using the removed batch form. Choose Withdrawal Receipt or Return Receipt, then select a past return event to export/print that event. A return receipt includes the original equipment list and identifies exactly which quantities returned in the selected event; current outstanding balances are labeled as current, not historical balances. Individual record details also support complete PDFs and the latest individual return receipt, including partial returns. Legacy completed returns use their real existing timestamp; no synthetic historical timestamp is written.

## Data integrity and compatibility

No migration runs and no existing equipment, withdrawal, activity, name, preference or return record is deleted. The pre-existing `batches`, `batchId`, `reference`, `withdrawalIds` and return-event storage fields remain as transaction-grouping metadata so that existing backups, restores, merges and histories stay compatible. They no longer expose a separate withdrawal module.

The standard hook uses a dedicated `getEquipmentStatus` callback with a distinct UI contract; string feedback cannot replace the callback. Requests use UUID-based references and in-flight guards. The existing idempotent transaction builder and single-snapshot persistence preserve individual histories and protect against partial writes. Original equipment detail snapshots remain visible even when inventory names later change.

## Verification status

Source paths were reviewed and regression cases added; no executable test runner or installed Android/iOS device is available through this editor. Automated, print/share and physical-device results are not claimed as passed.

Run in the exported development environment:

```sh
npx tsc --noEmit
deno test --no-check --import-map=tests/upgrade-import-map.json tests/movements.test.ts tests/withdrawalTransactions.test.ts tests/returnSignatures.test.ts
deno test --no-check --allow-read tests/androidCrashRegression.test.ts tests/withdrawalModuleRemoval.test.ts tests/returnSignatureIntegration.test.ts
```

Check on Web, Android and iOS: one-item withdrawal, multiple-item withdrawal, keyboard-open dropdown selections, remove/re-add, manual entry, serial duplication, unavailable equipment, excess/blank/fractional quantities, signature requirements, final review, duplicate taps, partial and complete returns, old grouped and legacy receipts, past-return receipt selection, print/save/share, restart/name persistence, and complete backup/merge compatibility. Test 320px phone, tablet, desktop and both device orientations. Also test returning signatures with a mouse on Web and finger/pen on Android/iOS, changing names after saving, clearing/re-signing, review/back navigation, duplicate confirm taps, different signatures on successive partial returns, selecting old return events, PDF/print output, reload and backup/restore retention. Automated and physical-device testing remain unverified in this editor. Do not clear storage or uninstall to test this change.
