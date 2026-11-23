# Signature field corrections and verification

## Scope

Shared signature engine for the New Withdrawal receiver, Return receiving personnel and optional Return releaser (returning personnel). Existing OG6 styling, condition choices, receipts, return grouping, inventory workflows, protected operations and five-tab navigation remain in place. Historical returning-personnel signatures keep their original identity and label. No stored records are converted or deleted.

## Behavior

- Independent completed strokes survive every finger/pen lift, pointer cancellation and leaving the canvas. Only Clear explicitly removes ink from the current draft.
- Web pointer capture supports primary mouse/touch/pen input, including coalesced samples. Android/iOS use native touch/stylus responder events; secondary simultaneous touches do not add another signature stroke.
- The controller renders at most once per animation frame and publishes an independent complete stroke snapshot at the end of each stroke. Delayed parent-state echoes cannot replace final ink.
- Scrolling and form-close/review/confirmation are blocked while signing and while the expanded canvas is open. Device back during an active stroke cannot discard ink.
- Expand uses the same stroke controller. Clear erases; Cancel or contract keeps the current ink and save state; Save marks the complete signature saved and returns to the form, not transaction submission.
- Uniform contain scaling matches the SVG viewBox. Stored 500 by 180 point arrays are transparent, resolution-independent vector image data, not screenshots or lossy PNG resizing. Old signatures remain in their original coordinate system.
- Changing a signer name retains ink but invalidates its saved state. The operator must review/re-save or explicitly Clear and have the new person sign.
- Drafts persist separately on the device, including selected equipment, personnel, reference and signature-save flags. The same incomplete form resumes when reopened. Writes are ordered, and failed recovery does not overwrite existing draft bytes. Finalized records use the original atomic tracker save and retain copied signatures in record details, history, backup/merge and receipts.
- A new return event receives its own signatures. Historical signatures cannot be edited/replaced in the existing view-only record details; this fix does not introduce an unrequested historical-record editing workflow.

## Automated regression cases added (not executed in this editor)

```sh
npx tsc --noEmit
deno test --no-check tests/signatureCanvas.test.ts
deno test --no-check --allow-read tests/signaturePointerIntegration.test.ts tests/expandableSignatureIntegration.test.ts tests/phoneSignatureLayout.test.ts tests/returnSignatureIntegration.test.ts
deno test --no-check --import-map=tests/signature-import-map.json tests/signatureDraftPersistence.test.ts
deno test --no-check --import-map=tests/upgrade-import-map.json tests/returnSignatures.test.ts tests/signatureHistoryRetention.test.ts tests/movements.test.ts tests/withdrawalTransactions.test.ts tests/batchReturns.test.ts
deno test --no-check --import-map=tests/receipt-import-map.json tests/singleA4Document.test.ts tests/receiptText.test.ts
```

Pure regression cases cover multi-stroke lift/resume, primary-pointer exclusion, cancelled strokes, proportional resize mapping, draft round trips/save flags, ordered writes, independently copied withdrawal ink, separately attributed return signatures, later unsigned releasers, historical receipt selection and backup retention. Source contracts cover web event registration/cleanup, native gesture ownership, form interaction locks, expand/save/cancel and provider hydration. These are not a substitute for hardware tests.

## Required manual tests — pending

Use existing test equipment on a device with current app code; do not uninstall, clear storage or alter production historical records to test.

1. On installed Android, draw a receiver signature with a finger, lifting five times. Verify each prior stroke remains, then save and continue drawing; new ink must invalidate the saved flag without removing old ink.
2. Repeat using an actual stylus on a compatible Android touchscreen. Test fast curves, slow lines, brief lifts, leaving/re-entering the surface, palm/secondary touches and screen rotation. A physical stylus cannot be verified in Live Preview.
3. On Web, repeat with mouse, finger and pen where supported. Drag outside and back; release outside; verify no scrolling, context menu or erased ink. Repeat pointer capture/cancellation cases and ensure form actions do not fire.
4. Expand the Withdrawal receiver field before and after saving. Sign in the expanded canvas, choose Save, and compare all strokes/proportions in the compact field. Re-expand and Cancel; ink and save state must remain. Clear must be the only erase action.
5. Test the Return receiving-personnel and optional releaser fields independently for partial, complete and cross-transaction batch returns. Unsaved supplied releaser ink must block review until saved or explicitly cleared. Receiving signature remains required.
6. Edit an unfinished withdrawal draft (quantities/remarks), close it, navigate through another tab, and reopen New Withdrawal. Confirm the same reference, selected equipment, personnel, signature and saved flag resume. Repeat after restarting the app and for the same return target.
7. Confirm/save the equipment transaction. Reopen its record details and receipt, then restart the app and reopen again. Original signatures must remain identical. Reopen an earlier partial return after a later return with different personnel; each event must retain its actual independent signatures. Existing finalized records remain view-only.
8. Test short Android landscape and 320–414px browser widths: Clear/Cancel/Save remain reachable, expansion is correctly contained, and form scrolling/back/submit are blocked only while interacting with the signature. Verify one-page A4 save/share/print and large-text views retain existing details plus any newly captured releaser acknowledgement.

## Current verification status

No executable test runner, installed Android touchscreen, real stylus, or interactive browser automation is available through this editor. Added automated tests and the eight manual cases remain **unexecuted/unverified**. No Android/stylus/browser pass is claimed. Device-local drafts are not a cloud backup; completed records continue using the existing complete backup workflow.
