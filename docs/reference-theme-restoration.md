# OG6 reference theme and crest

The first supplied image is the visual reference: navy command surfaces, electric-blue accents and borders, green equipment-IN states and red overdue states. Existing tactical assets provide the network/communications header, illustrated sidebar and subtle workspace background. The reference screenshot itself is not used as a background, so its example counts, labels and old logo are never embedded behind the live interface.

The second supplied image is bundled unmodified as `assets/og6-communications-crest.png`. The shared CommandEmblem renders it with expo-image and contain sizing in mobile headers and landscape/desktop navigation, retaining the complete crest and readable proportions. It works without a network connection after the app assets are loaded.

On the first successful load of this update, the existing snapshot is preserved with only the theme preference changed to dark. A separate device-local appearance marker prevents overriding later Light Mode or System Default selections. No operational record, identifier, timestamp, signature, sound preference, backup or server schema is removed or reset. Light Mode remains available with a blue-tinted companion palette.

All five tabs, forms, menus, dialogs, status controls and navigation continue using shared semantic color tokens. Compact spacing and responsive portrait/landscape behavior remain in place.

Regression coverage is in `tests/commandAppearance.test.ts` and the existing `tests/theme.test.ts`. No automated runner or physical-device visual testing was available in this session; runtime and device checks remain unverified.
