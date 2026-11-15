# OG6 independent notification and alarm audio

## Settings-only configuration

**SETTINGS → SOUND & NOTIFICATIONS** now has two independent sections:

- **A. NOTIFICATION SOUND**: Upload Notification Sound, Preview Notification, Test Notification, Replace Notification Sound, Remove Notification Sound, and Notification Volume (0–100%). Used for equipment withdrawals, returns, registration/edit/import confirmations and general system notifications.
- **B. ALARM SOUND**: Upload Alarm Sound, Preview Alarm, Test Alarm, Replace Alarm Sound, Remove Alarm Sound, and Alarm Volume (0–100%). Used for active unacknowledged overdue equipment, repeated overdue reminders, explicitly critical alerts, and existing high-priority due-soon reminders.

Each panel displays its own filename/duration, active-default selection label, loading/error state, browser activation state and stop-preview control. Upload/replace/remove/preview/test/volume controls exist only in SETTINGS. Other tabs retain operational STOP ALARM / ACKNOWLEDGE controls and overdue countdown states, but their shared banner no longer exposes sound-setup prompts, configuration shortcuts, an uploader, audio activation, previews or tests. Normal workspace navigation to SETTINGS is preserved.

SETTINGS contains one **OPEN REFERENCE SOUND** button for the original YouTube reference. It opens the link externally and reports opening failures. It does not upload, download, substitute, play through the app player, modify either selected file, reset volume or save preferences. The existing uploaded notification and alarm MP3/WAV files remain the active default sounds. There is no shared Upload Reference Sound control; the two dedicated channel uploaders are retained.

The master notification toggle, separate high-priority-alarm toggle, warning-window selection, navy theme, five tabs, receipts, exports, inventory import/scanning, transactions and password-authorized actions are preserved.

## Independent persistence and migration

Settings store `notificationSound` and `alarmSound` independently. New uploads always get separate generated file IDs. Uploading/replacing/removing one changes only that selection, preserving the other sound and both volume preferences. Removal requires confirmation, saves explicit `null` and stops/cancels only the removed channel. Explicit null remains removed after restart; it never restores the old shared sound.

Existing legacy `alertSound` selections are retained as the initial selection for both channels during migration. This is a compatibility migration, not a replacement of user audio. Either can then be replaced or removed independently. The legacy metadata field is read only for migration; production playback and new uploads use the separate fields. Both decoder slots can safely reference a legacy file until independently replaced. Shared browser URLs are not released while the other slot is loading or using them.

Files are copied into persistent app document storage on native devices and stored as local IndexedDB Blobs in desktop browsers. Only metadata goes into the existing local tracker settings; media is not embedded as base64 in inventory records or backend database rows. Each binary is addressed by its own generated ID. A failed preference save discards only the newly staged upload. Previously committed files remain in local storage; Remove clears the active selection without risking another legacy reference or equipment data.

Clearing app/browser storage or browser eviction can remove saved audio and records. Audio is device-local, not synchronized between devices. Missing audio produces channel-specific retry/re-upload guidance without resetting either selection or inventory.

## File validation

- Authorized MP3 and WAV uploads, with an explicit permission acknowledgement. New uploads need not match the previous YouTube reference; each channel can use its own chosen file.
- Non-empty files up to 10 MB; extension and audio file signature must agree.
- Decoder validation without playback must succeed before selection persistence.
- Decoded duration: 0.1–19 seconds, retaining the unchanged 20-second overdue-alarm interval. Overlong audio is rejected rather than trimmed or recreated.
- Decoding has a 30-second timeout and unloads late results.
- Cancelled, invalid, unsupported, oversized, overlong or failed uploads preserve both previous selections and existing records.

No generated or remote substitute is used when a channel has no selected file. Visual notifications and acknowledgement history continue to work.

## Serialized player and independent gain

Android/iOS and desktop browsers use `expo-av` with two bounded preloaded decoder slots and one serialized player. Source-specific generations, startup cancellation, same-kind duplicate guards, a bounded priority queue, serialized start/stop and a duration-aware completion watchdog prevent overlapping audio. Each event is routed to its matching file and gain. A bad or missing alarm file does not invalidate notification playback, and vice versa.

Changing a source cancels only that channel's playback and queued jobs. Changing notification audio while an alarm plays does not stop the alarm; changing alarm audio while a notification plays does not stop the notification. Urgent automatic alarms can preempt lower-priority notification playback. Foreground/hidden transitions cancel active and queued sounds rather than replaying stale events later. The overdue scheduler stops only recurring-overdue jobs when there are no pending withdrawals, so it does not truncate independent one-shot critical or due-soon alerts.

Both application volume defaults remain **100%**. Existing saved choices, including 0% mute, survive restart. Slider movement updates the selected channel immediately, including active, queued and future jobs; releasing the slider persists only that channel's volume. Failed saving restores its saved gain and shows an error. Replacing/removing a file does not reset gain or alter the other channel.

PREVIEW and TEST each play the matching file once at its own volume, even if automatic alerts are disabled. A muted channel must be raised above 0% for audible testing. Tests can replace current playback intentionally but never acknowledge equipment. Source-change guards prevent testing a previous clip while its replacement is loading.

Browsers may block automatic playback until a user gesture starts the selected clip. Preview/test each channel in SETTINGS after restart or replacement; browser activation and errors are reported independently. Application gain cannot override hardware media volume, a muted browser tab, Do Not Disturb or unavailable output devices. Alerts operate while the app is open and active; background push is not configured.

## Preserved acknowledgement history and countdown

All existing acknowledgement paths still use the locked, device-local tracker commit and whitelisted audit service. Effective actions save one activity with the actual ISO timestamp, affected withdrawal IDs, fixed workspace actor, description and action source. Passwords, credentials, signatures and record snapshots are excluded. Activity, withdrawal acknowledgements and notice flags persist together. Already-acknowledged, returned, archived, invalid or future-due targets do not create duplicate events. Returns, tests, mark-read and clear-read are not fabricated user acknowledgement events.

History remains visible in HOME activities and related equipment/withdrawal details. A failed acknowledgement save does not claim a saved event; the alarm remains temporarily halted with retry guidance.

The banner still consumes the scheduler's one-second clock and unchanged 20-second last-attempt timestamps. It uses only alarm-channel readiness, file selection, gain and browser activation. States remain distinct: NEXT ALARM IN, ALARM PLAYING, ALARM MUTED, ALARM DISABLED, BROWSER AUDIO BLOCKED, ALARM SOUND NOT UPLOADED, LOADING SOUND, AUDIO UNAVAILABLE, ALARM PAUSED and ALARM STOPPED. No independent countdown timer or altered repeat cadence is introduced.

## Validation status

Automated tests, type/build checks and physical Android/browser playback tests were **not run in this editor session**. Cross-file inspection confirmed two sound panels mounted only in SETTINGS, one reference action in SETTINGS and no sound-settings shortcut in the shared alarm banner. Added source-placement regression tests guard these boundaries, operational acknowledgement/countdown controls and the reference action's lack of audio/preference mutations. These source checks are not playback or rendered-UI tests. Existing pure tests cover channel routing, defaults, migration, independent patch keys, replacement/removal, persisted nulls, volume preservation, headers, size/duration bounds, acknowledgement integrity and countdown timing. A separate mocked-player suite covers independent browser activation, active/queued playback, live gain including future muted jobs, source replacement/removal, channel-specific failure, duplicate suppression, legacy URL ownership and maximum concurrency of one. Mocks are test-only; they do not supply application audio.

```sh
deno test --import-map tests/import-map.json tests/audio.test.ts tests/audioConfiguration.test.ts tests/alarmAcknowledgements.test.ts tests/alertSoundValidation.test.ts
deno test --import-map tests/audio-player-import-map.json tests/audioPlayback.test.ts
deno test --allow-read=app,components,hooks tests/audioSettingsPlacement.test.ts
```

Before operational use, verify on Android and desktop:

1. Upload two audibly different authorized files; preview/test each and verify withdrawal/return/general events use notification audio, while overdue/critical/due-soon events use alarm audio.
2. Restart, check both files and saved gains, then replace and remove each independently. Check that a removed selection stays removed and legacy selections are not accidentally restored.
3. Change either slider during its playback, including 0% and 100%, and ensure the other gain is unchanged. Trigger a new event during slider movement to confirm live gain applies before saving.
4. Replace/remove notification audio while an alarm plays and vice versa; no unrelated source should be stopped, overwritten or disabled.
5. Test separate browser activation, autoplay restrictions, missing/evicted audio, invalid files, decoder/storage/save failures, rapid tests, repeated alerts and background transitions without overlap.
6. Verify overdue 20-second cadence, countdown states, acknowledgement timestamps/IDs and absence of duplicate history. Compare existing assets, withdrawals, signatures, receipts, imports, reports and server password gates for preservation.
7. Inspect HOME, WITHDRAWALS (including return forms), INVENTORY and REPORTS: no sound upload, preview, test, reference link, slider or enable/disable configuration should appear. Operational overdue status and STOP ALARM / ACKNOWLEDGE must remain. Open the reference in SETTINGS and confirm both selected filenames, volumes and active defaults are unchanged.
