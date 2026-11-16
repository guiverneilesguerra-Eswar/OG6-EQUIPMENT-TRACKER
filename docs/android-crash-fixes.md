# Android withdrawal-list and audio crash fixes

The separate batch UI was subsequently removed. Its multi-selection/partial-return behavior now lives in the existing standard New equipment withdrawal form (`docs/unified-withdrawals.md`). R2 audio verification remains unchanged. The structural callback regression now checks `useWithdrawals.ts` and `WithdrawalForms.tsx`.

## 1. Batch inventory `TypeError: '' is not a function`

`useTracker()` exports `status(assetId)` as a function. The batch hook spread that tracker object and then exported a local string also named `status`. Initially it was `''`. An inventory FlatList row called `m.status(a.id)`, therefore invoking an empty string. This is a hook property collision, not a FlatList or Hermes defect.

R2 removes the generic `status` property and the tracker-object spread from the batch UI model entirely. The hook explicitly exports `getEquipmentStatus`, a memoized callback to the existing `assetStatus` service using current withdrawal records and the tracker clock. Inventory availability and receipt badges use this separate callback. Feedback remains `statusMessage`; it is rendered only as text. No status checks are disabled or replaced with a default IN state. Single withdrawals and the underlying transaction/availability rules are unchanged.

## 2. Native `Player is accessed on the wrong thread`

The application already uses expo-av for audio. Its default Android ExoPlayer backend has a known native lifecycle/release thread issue matching the reported `mqt_native_modules` versus `main` exception (Expo issue #31225). The supplied message alone does not provide the native call stack, so the exact native operation is not verified.

All audio decoder creation goes through `loadDecodedAlertSound`. That loader now uses a shared initial-status policy selecting Android's `MediaPlayer` before `Audio.Sound.createAsync`. Backend changes after loading have no effect, and JavaScript try/catch, requestAnimationFrame or promise queues cannot move ExoPlayer's native release operation onto the main thread.

This covers upload/restore probes and both saved playback channels, including late-result cleanup. It does not add a second player library, modify native dependencies, or silently fall back to ExoPlayer on decode errors. iOS/browser behavior remains unchanged. MP3/PCM WAV validation, serialization, cancellation, acknowledgement history, stored files and saved gains remain intact.

## R2: verify the delivered code and actual native engine

The second report contains the same `renderItem@250942:42` and component bundle positions as the first, although its cache directory differs. The source inspected here already had the first callback/MediaPlayer fix. This is consistent with an older bundle or retained player being used, but bundle positions alone do not prove that. A complete native Java stack is still needed to identify a persistent native error.

R2 adds **ANDROID FIX R2** in Settings → Access & Data Protection. This is a code revision indicator, not a database migration or a change to package identity. If that text is absent, the device has not received this code; additional source edits cannot repair the bundle it is running.

The shared decoder now verifies `androidImplementation` returned by native code, not just the creation options. Only a loaded **MediaPlayer** decoder may be accepted on Android. Upload/restore validation and both playback slots share this check; unverified/unloaded decoders are rejected and unloaded with visible guidance, not silently played as ExoPlayer. The Settings sound panel shows **VERIFIED ANDROID ENGINE · MediaPlayer** only after a selected clip has loaded and the native response has passed verification. No sound selected means no engine indicator is expected. Readiness resets clear this indicator. iOS/web keep their existing backend.

JavaScript guards cannot catch every native fatal exception or move native release onto the main thread. This check confirms which backend the updated app loads; it does not rewrite a faulty native host or guarantee an old retained ExoPlayer can be safely released.

### Safe Android retest

1. Export a complete backup before any installation change if possible. Do not clear storage or uninstall.
2. Fully close the app process, then reopen it with the latest OnSpace preview/code. For an installed APK, generate the updated APK and install over the existing app using the same application identity/signing key.
3. Check **ANDROID FIX R2** in Settings before testing the standard withdrawal dialog. Missing revision means the new code is not running.
4. With an existing selected MP3/WAV, confirm the verified MediaPlayer engine appears in its sound panel. Preview/test each channel, then stop, background/foreground and repeat.
5. Open the standard equipment multi-select, search and select items; unavailable items must remain disabled. Save/reopen a test transaction and perform partial/full returns; feedback must not change the equipment status callback.
6. If either crash remains with R2 visible, provide fresh logs including all Java `at ...` frames, especially `expo.modules.*`, the revision/engine indicators, and whether this is OnSpace phone preview or an installed APK. Live Preview network logs cannot verify the Android native runtime.

## Verification status

Source changes reviewed and regression tests added. **No automated test runner, Android device, native rebuild or Hermes session was available here; these tests are not claimed to have passed.**

From an exported development environment:

```sh
npx tsc --noEmit
deno test --no-check tests/audioLoadOptions.test.ts
deno test --allow-read=hooks,components,services,app tests/androidCrashRegression.test.ts
deno test --no-check --import-map=tests/audio-player-import-map.json tests/audioLoadOptions.test.ts tests/audioPlayback.test.ts
deno test --no-check --import-map=tests/upgrade-import-map.json tests/movements.test.ts
```

Fully close/relaunch the app after applying the code. An installed release APK needs a new build containing these changes; Fast Refresh alone may retain previously created ExoPlayer instances. Do not clear app storage or uninstall to test, as operational records are device-local.

Use test records and verify on Android:

1. Open New equipment withdrawal with real inventory; scroll/search, check IN/OUT/overdue badges and confirm unavailable items stay disabled.
2. Select inventory/manual items, save signature, review/save, and open the receipt. Verify a message is shown without replacing the status callback.
3. Perform partial and full batch returns and reopen receipts. Confirm IDs, balances and history remain intact.
4. Preview/test existing notification and alarm MP3/WAV clips; stop, repeat, change volume and replace either channel independently.
5. Upload and restore a supported audio clip, including invalid/overlong inputs; failures must retain prior selections.
6. Test background/foreground, tab navigation, audio completion, rapid tests, and a full app reload while audio was previously active.
7. Verify no overlapping sound, the 20-second overdue cadence, acknowledgement persistence and both saved gains after restart.

If the native exception persists in a newly rebuilt/relaunched installation, capture the complete Java stack (especially the `expo.modules.*` frames). This will distinguish another native player/library from the OG6 audio loader; the abbreviated message cannot establish that.

References: https://github.com/expo/expo/issues/31225 and https://github.com/expo/expo/blob/sdk-53/packages/expo-av/src/AV.types.ts (initial `androidImplementation` contract).
