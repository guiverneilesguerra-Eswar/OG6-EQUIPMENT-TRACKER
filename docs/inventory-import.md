# OG6 Excel inventory import

## Storage and scope
Inventory continues to use the existing device-local `og6.tracker.v1` store, not a new cloud inventory table. Import does not migrate or replace records. The TrackerProvider locks all writes, validates against its latest snapshot, builds the entire batch in memory, and persists the complete snapshot with one awaited AsyncStorage write. Context updates and the configured success tone occur only after persistence succeeds. This is a local single-write batch, not a PostgreSQL transaction or cross-device synchronization.

New assets receive UUID-based internal IDs and the actual confirmation timestamp (`createdAt` and `updatedAt`). No withdrawals are created, so their initial derived status is IN. One activity is added per asset, one success notice per batch, and a batch audit references the imported IDs. Existing equipment, withdrawals, signatures, activities, settings and archive approvals are preserved. Optional import metadata keeps the existing storage version compatible. A batch ID is retained for retries and recorded with the saved batch to prevent duplicate re-application.

## Operator workflow
1. Inventory > Download Template saves/shares `OG6_Inventory_Import_Template.xlsx`.
2. Populate the `Inventory Import` worksheet starting at row 2. Headers must be exactly `Item`, `Serial/Product ID`, `Notes`, in that order. All three fields are mandatory. Instructions are in a separate worksheet.
3. Keep IDs as text; the entire template ID column uses Excel text formatting. Use unique IDs per equipment unit.
4. Inventory > Import Excel opens the system file picker. Select a standard, unencrypted `.xlsx` file.
5. Review counts and every preview row. Green rows are valid; red rows show duplicate or invalid reasons. Desktop/tablet uses a table; narrow screens show the same four fields in stacked rows. The preview is virtualized.
6. Cancel without saving, download a validation-error report, or confirm the valid-record count. Serial IDs are rechecked while holding the write lock, including archived inventory. No existing asset is overwritten.
7. Review completion totals. Rejected rows can be downloaded in an Excel error report, with original worksheet row numbers and reasons. Copy corrected rows into the official template, not the error workbook.
8. Imported equipment becomes visible to inventory, HOME, withdrawal selection and reports through the existing TrackerContext.

## Validation and resource limits
- `.xlsx` only; maximum 5 MB compressed, 32 MB total ZIP-expanded entries, 16 MB per entry, 256 entries, 5,000 data rows, 32 used columns and 2,000,000 total text characters. Suspicious ZIP ratios, encrypted archives, macros and external links are rejected before Excel parsing. Streaming inflation also verifies actual expanded sizes, rather than trusting uploaded ZIP metadata.
- Exact worksheet and column header validation. Wholly blank rows are ignored; partially populated rows are invalid. Data outside the three columns is rejected for that row. Excessive formatting/dimensions must be removed.
- Item and Serial/Product ID: maximum 200 characters each. Notes: maximum 10,000 characters. Unsupported control characters and unsupported cell types are invalid.
- Serial IDs are compared case-insensitively after trimming outer spaces, including archived equipment. Every occurrence of a repeated ID within the file is skipped. Counts partition populated rows into valid, duplicate and invalid; invalid takes precedence when required fields or cell types fail.
- Formula/shared-formula cells and hyperlinks are invalid. ExcelJS reads the workbook as data only and never calculates formulas or follows links. Exported template/report cells are explicit strings, not formula objects; text beginning with `=`, `+`, `-` or `@` remains text.
- String IDs preserve leading zeros. Safe numeric IDs with simple zero-padding formats (e.g. `000000`) retain the displayed zeros. Numeric IDs that are fractional, negative, unsafe, 16+ digits, or use unsupported formats are rejected. Digits or leading zeros already destroyed by Excel cannot be recovered; re-enter the original ID as text.
- Authorization requirements for equipment edit/archive are unchanged. Import adds equipment only and never updates existing records. Local preview roles are still not authentication or protection against direct storage tampering.

## Automated regression suite
`tests/inventoryImport.test.ts` uses Deno and `npm:exceljs` against the same workbook parser and pure batch builder used by the application:

```sh
deno test --no-check --import-map=tests/import-map.json tests/inventoryImport.test.ts
```

The suite covers template round-trip, exact headers/sheet, required fields, duplicates in-file/existing/archived, numeric/string ID handling, formula rejection and export-injection safety, corrupt/oversized ZIPs, extra columns, empty/sparse rows, revalidation at confirmation, new IN status, record preservation, atomic write-failure behavior and batch retry idempotency.

The editor environment provides no runtime test runner; this command has not been executed here. Run it before release and test browser, installed iOS and Android file pickers and share sheets. Verify a 500-record file, cancellation, error-report correction/reimport, storage-failure recovery, repeated confirm taps, portrait/landscape preview and the configured sound (browser/device restrictions still apply).
