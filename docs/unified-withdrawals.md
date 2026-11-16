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

Each new return event has its own immutable reference, personnel, condition, remarks, quantity, actual timestamp and **receiving personnel signature**. Enter both returning and receiving names, then have the receiving person sign with a finger/pen/mouse and choose Save signature before reviewing. The confirmation shows the receiving signature read-only. Changing the receiving name or editing/clearing the signature invalidates its saved state. Changing the returning name does not substitute or reassign the signer. Signature controls are disabled during final persistence.

Equipment condition is a required single-choice control with exactly **Serviceable**, **Unserviceable**, and **Damage**. The selected condition applies to all selected quantities in this return event. Use separate returns if their conditions differ. The movement builder revalidates this choice before persistence; existing historical free-text conditions remain unchanged.

### Batch return across all withdrawals

Withdrawals → **Batch return** opens the same unified return dialog with every currently outstanding withdrawal, independently of the main list filter/search. Includes overdue, partially returned, manual-entry and legacy equipment. Returned or archived withdrawals are excluded. No separate tab or batch-withdrawal module is added.

Search by equipment, serial, reference, record ID or original receiver. Check individual equipment to select its full outstanding quantity, uncheck to skip, or enter a smaller whole-number quantity. **Return all outstanding quantities** selects every outstanding item in this form, including those hidden by search; **Clear selection** removes all selections. Selection counts and unit totals remain visible. Review displays only selected items and their source transactions before final confirmation. Batch return is not capped at 200 items even though new withdrawals retain their existing per-transaction limit.

One return reference groups all selected items across their original withdrawal transactions. The existing provider lock revalidates and saves the full snapshot atomically, preventing over-returns, partial writes and duplicate-tap records. Only selected equipment changes. A complete batch-return receipt, available from participating source transactions, includes all selected items, their individual source references, original personnel/dates, returned quantities, condition and receiving signature; original withdrawal signatures remain labeled by source transaction. Other return events and unselected items are never fabricated into the batch event. Original withdrawal receipts still use their original transaction grouping.

The receiving signature is required for new partial, complete and batch returns and is validated again by the movement builder under the provider lock. It is captured separately from the original withdrawal receiver signature and copied into each selected item’s return event using `receivingSignature`. Another return event requires a fresh receiving signature; exporting an earlier event uses that event’s own signer and strokes, never the latest summary. Complete receipts show the receiving signature once per signer/event, with the return reference and timestamp. Individual return history retains the captured strokes.

Optional `receivingSignature` and legacy `returnSignature` fields retain compatibility with older records and backups. Full backup validation and merge preserve both fields. Existing returning-personnel signatures remain labeled **Returning personnel signature (historical)** and attributed to their original returning person; they are never relabeled as receiving-personnel signatures. Older unsigned events explicitly state that no receiving personnel signature was recorded rather than using withdrawal strokes or fabricating one. This is handwritten acknowledgement capture, not cryptographic identity verification. Data continues to stay in the existing device-local tracker; no records are migrated or cleared. Partial quantities do not complete the withdrawal or silence its overdue monitoring. A lot stays OUT until its outstanding balance is zero. Returning one item never updates other transaction items implicitly.

Complete receipt opens the entire original transaction, including older grouped withdrawals previously created using the removed batch form. Choose Withdrawal Receipt or Return Receipt, then select a past return event to export/print that event. A return receipt includes the original equipment list and identifies exactly which quantities returned in the selected event; current outstanding balances are labeled as current, not historical balances. Individual record details also support complete PDFs and the latest individual return receipt, including partial returns. Legacy completed returns use their real existing timestamp; no synthetic historical timestamp is written.

## Data integrity and compatibility

No migration runs and no existing equipment, withdrawal, activity, name, preference or return record is deleted. The pre-existing `batches`, `batchId`, `reference`, `withdrawalIds` and return-event storage fields remain as transaction-grouping metadata so that existing backups, restores, merges and histories stay compatible. They no longer expose a separate withdrawal module.

The standard hook uses a dedicated `getEquipmentStatus` callback with a distinct UI contract; string feedback cannot replace the callback. Requests use UUID-based references and in-flight guards. The existing idempotent transaction builder and single-snapshot persistence preserve individual histories and protect against partial writes. Original equipment detail snapshots remain visible even when inventory names later change.

## Verification status

Source paths were reviewed and regression cases added; no executable test runner or installed Android/iOS device is available through this editor. Automated, print/share and physical-device results are not claimed as passed.

Run in the exported development environment:

```sh
npx tsc --noEmit
deno test --no-check --import-map=tests/upgrade-import-map.json tests/movements.test.ts tests/withdrawalTransactions.test.ts tests/returnSignatures.test.ts tests/batchReturns.test.ts
deno test --no-check --allow-read tests/androidCrashRegression.test.ts tests/withdrawalModuleRemoval.test.ts tests/returnSignatureIntegration.test.ts tests/batchReturnIntegration.test.ts
```

Check on Web, Android and iOS: one-item withdrawal, multiple-item withdrawal, keyboard-open dropdown selections, remove/re-add, manual entry, serial duplication, unavailable equipment, excess/blank/fractional quantities, signature requirements, final review, duplicate taps, partial and complete returns, old grouped and legacy receipts, past-return receipt selection, print/save/share, restart/name persistence, and complete backup/merge compatibility. Test 320px phone, tablet, desktop and both device orientations. Also test receiving signatures with a mouse on Web and finger/pen on Android/iOS, changing the receiving name after saving, clearing/re-signing, review/back navigation, duplicate confirm taps, different receiving signers on successive partial returns, and preserving historical returning-signature labels. Check each condition choice, batch-return selection across different original receivers/transactions, search-hidden select-all, clear selection, more than 200 outstanding items, partial quantities, unaffected items, choosing earlier return events, complete cross-transaction PDF/print output, reload and backup/restore retention. Automated and physical-device testing remain unverified in this editor. Do not clear storage or uninstall to test this change.
