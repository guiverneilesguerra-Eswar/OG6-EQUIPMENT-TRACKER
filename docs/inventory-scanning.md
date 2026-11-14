# Inventory barcode and QR search

## Read-only workflow

- INVENTORY has a SCAN BARCODE / QR control next to its existing search field; both viewer and operator workspaces can use it.
- Opening the scanner checks camera permission and requests it only when necessary. Denial offers retry, or device settings when the OS prevents another prompt. Manual search remains available.
- The back camera reads QR, Code 128/39/93, EAN-13/8, UPC-A/E, ITF-14, Codabar, PDF417, Data Matrix and Aztec labels supported by the device. Flashlight is optional.
- The first accepted detection closes the camera and applies the decoded text to the inventory search. Repeated camera callbacks are latched synchronously.
- Matching is whole-field Serial/Product ID equality, case-insensitive with surrounding whitespace trimmed, consistent with inventory duplicate checks. Leading zeros, punctuation and long numeric identifiers are preserved as text. No number coercion or UPC/EAN rewriting is performed.
- QR payloads must contain the literal Serial/Product ID. URLs, JSON and command-like payloads are never opened, parsed, evaluated or executed; they can only match an identical stored serial. Empty, oversized or embedded-control-character payloads are rejected with a retry action.
- Scan feedback shows the scanned serial and current matching equipment count. Unknown or archived-only serials show no matching active equipment and never create records. Typing in the search field or using CLEAR SCAN restores ordinary search.
- The camera unmounts when closed, the tab loses focus, or the app becomes inactive. Permission is rechecked without prompting after returning from device settings.
- There is no tracker write, backend request, notification creation, export, registration, withdrawal, edit, delete, or audit event for searching. Signatures, transaction history, imports and administrator security remain unchanged. No photos, videos or audio are captured or uploaded.

## Build and platform notes

`expo-camera` is configured in app.json with a camera-purpose message, barcode scanning enabled, and Android audio recording permission disabled. New native app binaries must be built for plugin/permission changes to take effect. Native scanning is intended for physical iOS and Android devices. Live Preview displays an explicit device-only notice and retains manual search; it does not simulate a camera or scan result.

Some platforms report UPC-A as EAN-13 with an additional leading zero. This feature intentionally does not rewrite decoded data: the stored Serial/Product ID must match the device's decoded label text. Verify actual equipment labels on both platforms before operational use.

## Validation

Unit tests are provided in `tests/inventorySearch.test.ts`, covering leading zeros, exact matching, archived records, ordinary search, input rejection, literal QR handling and non-mutation. Run:

```sh
deno test tests/inventorySearch.test.ts
```

Automated tests and native device tests were not executed in the editor session. Native QA checklist:

1. Build/install updated iOS and Android apps, then grant camera permission on first scan.
2. Scan a real QR and Code 128 label containing `000123`; ensure only that exact serial appears, not serial `123` or names/notes containing `000123`.
3. Verify an unknown code and an archived-only code show no matches without creating equipment.
4. Deny camera permission, retry it, and test permanent denial/settings recovery.
5. Test repeated frames, invalid payload retry, flashlight, manual cancellation, Android back, tab blur, background/resume and portrait/landscape.
6. Use a viewer workspace and verify scanning is still available without enabling registration actions.
7. Compare equipment, withdrawals, signatures, import audits and admin settings before and after scans; they must remain unchanged by scanning.
8. Verify browser Live Preview shows device-only guidance rather than requesting unusable camera access.
