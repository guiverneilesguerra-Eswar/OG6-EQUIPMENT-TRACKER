# OG6 compact command-console layout

This update is limited to presentation. Device-local equipment records, withdrawals, returns, receipts, imports, sound selections, alarm intervals, authorization services and all five routes are unchanged. No Drive connection, authentication or database migration is introduced.

## Shared rhythm

- Adjacent rounded cards: 8px.
- Card and nested-panel padding: 12px.
- Section and control-group separation: 8px.
- Heading-to-content and label-to-input separation: 4px.
- Related label/value separation: 2px.
- Short metadata and labels use consistent 20–24px line heights; long body text retains 26px line height at 16px.
- Buttons, sliders and navigation controls retain 48px minimum touch targets.
- Navy surfaces, blue illuminated borders, rounded corners, imagery and platform shadows are retained.

The previous ultra-compact theme used 6px gaps and 8px padding. These are normalized upward to the requested 8–12px gaps / 12–16px padding; compactness improvements come from reducing oversized headers, repeated text margins, navigation branding and empty dialog height, not crowding content.

## Responsive behavior

Portrait keeps the existing bottom navigation and full-width pages. Supported landscape widths keep the existing sidebar. Header controls now participate in normal layout instead of absolute positioning. Activity tables are enabled only when the activity panel itself has enough space; narrow panels use wrapping activity rows. Date-filter columns and buttons can shrink or wrap rather than forcing horizontal overflow.

Short modal forms use measured content and header heights. Long forms, import previews and explicitly sized dialogs remain bounded and scrollable, accounting for safe-area insets. The signature drawing surface remains unchanged.

## Verification

Pure layout checks: `deno test --unstable-sloppy-imports tests/compactLayout.test.ts`.

Manual checks remain necessary in Live Preview and installed Android/iOS builds:

1. Check 320, 375, 414, 768, 1024, 1440 and 1920px widths and portrait/landscape rotation.
2. Review all five tabs with empty and populated records, long equipment names, serial IDs and large metric counts.
3. Check header actions, status badges, date filters and Settings sound controls for horizontal overflow.
4. Open short forms, long forms, password dialogs, notifications, import previews and the date picker; verify scrolling and keyboard handling.
5. Confirm existing search, withdrawal/return, receipt, import, archival and audio actions still run normally.

Automated tests and device/visual checks have not been executed in this editor session. No pixel-exact comparison is claimed because no new reference image was attached to this request.
