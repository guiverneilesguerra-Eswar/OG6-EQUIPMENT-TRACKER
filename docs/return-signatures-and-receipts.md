# Return receiver signatures and one-page receipts

## Return workflow

New equipment returns require a signature from **Receiving personnel** (the person accepting the returned item), separate from the original withdrawal receiver signature. Enter Receiving personnel, draw the signature, press SAVE SIGNATURE, then CONFIRM RETURN. Changing that name, changing strokes, or clearing the signature invalidates the saved state. Opening a different return starts with a blank return signature.

The service validates finite, in-bounds signature coordinates, usable strokes and size limits before completing the existing locked local-data commit. Return details, `receivingSignature`, `receivingSignatureAt`, return timestamp, activity history, notification and overdue acknowledgement changes are saved together. Failed validation or persistence does not partially complete the return. The signature capture timestamp is the actual return-recording timestamp.

Original receiver name, original withdrawal signature, existing transactions and receipts remain intact. Historical returns without a receiving signature remain readable and exportable, labelled as not captured; no signature or historical timestamp is fabricated. New return evidence is visible in transaction details and remains included in the server-validated archival audit snapshot. Passwords and credentials are not included in that evidence.

Data remains device-local, using the existing tracker storage. No new database tables, authentication flow, navigation or audio setting changes are introduced.

## PDF format

Withdrawal and return receipts now have exactly **one portrait A4 page (595.28 × 841.89 PDF points)**. All text, including headings, labels, values and footer, is **12 points**. The document uses black ink on white paper, compact label/value rows and reserved signature space. Return PDFs show the original withdrawal signature and separate receiving-personnel signature on return. Downloads and sharing use the same generated file.

Long fields are bounded and visibly shortened with `...`, with a footer advising that full details remain in the app. Source records are never shortened or modified. No second page, silent overflow or smaller font is used. A layout guard fails clearly rather than adding a page if the reserved space cannot be met.

**Arial remains pending:** no licensed Arial font asset exists in this project. The current generator explicitly retains its previous Helvetica/Helvetica Bold fonts at 12 points. Helvetica is not renamed or presented as Arial. The receipt actions and completion message disclose this. The user must upload a licensed Arial `.ttf` font (and Arial Bold if distinct bold styling is needed) for actual cross-platform font embedding in a follow-up; no unlicensed font download, platform-dependent Arial claim or silent substitution is introduced.

## Validation status

Added tests for signature validation, independent evidence, actual timestamp, JSON persistence, preservation of original records, legacy returns, archival whitelisting, single-page A4 dimensions, all PDF text operators at 12 points, long-field fitting, invalid receipt targets and return form wiring.

Tests, TypeScript/build checks and physical Android/desktop interactions were **not run in this editor session**.

```sh
deno test --import-map tests/import-map.json tests/equipmentReturns.test.ts tests/receiptPdf.test.ts tests/returnArchive.test.ts
deno test --allow-read=components,hooks,services tests/returnSignaturePlacement.test.ts
```

Before operational use, verify on Android and desktop: draw/save/clear/change receiver name, submit one return, restart and inspect stored evidence, generate both receipt kinds, compare both signature panels and actual dates, verify a historical unsigned return, print at A4 actual size, test long notes and serials, download/share, and test administrator-authorized archival with a signed return. Confirm existing equipment records and audio behavior remain unchanged.
