# OG6 reference command-center presentation

## Visual system

The November 16 reference image guides the actual interface rather than being displayed as a flattened screenshot. Live inventory counts, activities, dates, reminders and the existing device-local role are retained; no sample counts, transactions or fake administrator identity are inserted.

The reference frame is 1024 × 576. Shared sizing targets a 140px illustrated sidebar, 108px tactical header, 18px page insets, a 188px overview with four 88px status cards, and an approximately 244px lower activity/monitoring block. The reference activity table now fits its own approximately 543px panel. Equipment names retain roughly 150px alongside event, date and status columns. Typography, small signal badges, thin blue borders, rounded corners and restrained shadows follow the reference proportions instead of oversized dashboard defaults.

Existing bundled tactical assets provide the network/communications header, illustrated sidebar and subtle navy workspace. The latest supplied Philippine Army 4ID G6 seal remains bundled as `assets/philippine-army-4id-command-seal.png`, rendered unmodified with expo-image and contain sizing. It also replaces the missing placeholder icon paths and the white splash/adaptive-icon backgrounds. Startup asset changes require a new native build.

## All five tabs and dialogs

Shared semantic tokens apply to Home, Withdrawals, Inventory, Reports and Settings, including form fields, multi-select controls, signature canvases, tables, cards, confirmations and popups. Both application appearance variants are deliberately dark. The previous `light` preference is labeled Navy and the previous `dark` preference is labeled Midnight. System Default still follows the device preference to choose between those two dark variants. Stored preference keys remain compatible; this update does not write or reset the local dataset.

A separate `documentPalette` keeps exported PDF and printable receipts dark-ink-on-paper. Paper documents and the operating system's print/share dialogs are not application white containers and remain readable for their intended use.

On phones and narrow landscape screens, metric cards use two columns and activity rows stack their metadata. On wider landscape screens the sidebar, four-column metrics and activity/monitoring split match the reference. Scaling is bounded to avoid oversized text and distorted artwork. Long forms, expanded histories, font scaling and contextual sound warnings may legitimately require vertical scrolling. Audio status remains available below the Home overview instead of displacing the reference dashboard blocks at the top; alarm acknowledgement and sound settings actions are retained.

## Data and verification

This is a presentation-only update. The TrackerProvider, operational storage key, inventory, withdrawal/return builders, audit/authorization flows, signatures, name history, reports, audio playback and backup/restore logic are not changed. No SQL write or migration runs. The five routes and standard withdrawal entry point remain unchanged.

Source review and regression cases cover reference dimensions, narrow-layout boundaries, dark surface contrast, appearance preference compatibility and the independent print palette. No executable test runner, visual screenshot capture, installed device or printer is available through this editor; rendered pixel similarity and native behavior remain unverified.

Run in an exported development environment:

```sh
npx tsc --noEmit
deno test --no-check --allow-read --import-map=tests/import-map.json tests/compactLayout.test.ts tests/theme.test.ts tests/referenceConsole.test.ts tests/commandAppearance.test.ts
```

Compare the live screen against the reference at 1024 × 576, then verify 320px phones, tablets, desktop, both orientations, Navy/Midnight/System selections, all five tabs, keyboard-open forms, signatures, withdrawal review, partial returns, receipts and native print/share flows. Use existing backup copies; do not uninstall or clear device storage to test the styling.
