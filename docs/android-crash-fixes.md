# Android batch and audio crash fixes

## 1. Batch inventory `TypeError: '' is not a function`

`useTracker()` exports `status(assetId)` as a function. The batch hook spread that tracker object and then exported a local string also named `status`. Initially it was `''`. An inventory FlatList row called `m.status(a.id)`, therefore invoking an empty string. This is a hook property collision, not a FlatList or Hermes defect.

The batch hook now explicitly retains `status: tracker.status` and exposes feedback as `statusMessage`. Create/reset, successful withdrawal, return and receipt-export feedback all use `setStatusMessage`. The banner renders the message; inventory availability and receipt badges continue using the actual status function. No status checks are disabled or replaced with a default IN state.

## 2. Native `Player is accessed on the wrong thread`

The application already uses expo-av for audio. Its default Android ExoPlayer backend has a known native lifecycle/release thread issue matching the reported `mqt_native_modules` versus `main` exception (Expo issue #31225). The supplied message alone does not provide the native call stack, so the exact native operation is not verified.

All audio decoder creation goes through `loadDecodedAlertSound`. That loader now uses a shared initial-status policy selecting Android's `MediaPlayer` before `Audio.Sound.createAsync`. Backend changes after loading have no effect, and JavaScript try/catch, requestAnimationFrame or promise queues cannot move ExoPlayer's native release operation onto the main thread.

This covers upload/restore probes and both saved playback channels, including late-result cleanup. It does not add a second player library, modify native dependencies, or silently fall back to ExoPlayer on decode errors. iOS/browser behavior remains unchanged. MP3/PCM WAV validation, serialization, cancellation, acknowledgement history, stored files and saved gains remain intact.

## Verification status

Source changes reviewed and regression tests added. **No automated test runner, Android device, native rebuild or Hermes session was available here; these tests are not claimed to have passed.**

From an exported development environment:

```sh
npx tsc --noEmit
deno test --no-check tests/audioLoadOptions.test.ts
deno test --allow-read=hooks,components,services tests/androidCrashRegression.test.ts
deno test --no-check --import-map=tests/audio-player-import-map.json tests/audioPlayback.test.ts
deno test --no-check --import-map=tests/upgrade-import-map.json tests/movements.test.ts
```

Fully close/relaunch the app after applying the code. An installed release APK needs a new build containing these changes; Fast Refresh alone may retain previously created ExoPlayer instances. Do not clear app storage or uninstall to test, as operational records are device-local.

Use test records and verify on Android:

1. Open New Batch Withdrawal with real inventory; scroll/search, check IN/OUT/overdue badges and confirm unavailable items stay disabled.
2. Select inventory/manual items, save signature, review/save, and open the receipt. Verify a message is shown without replacing the status callback.
3. Perform partial and full batch returns and reopen receipts. Confirm IDs, balances and history remain intact.
4. Preview/test existing notification and alarm MP3/WAV clips; stop, repeat, change volume and replace either channel independently.
5. Upload and restore a supported audio clip, including invalid/overlong inputs; failures must retain prior selections.
6. Test background/foreground, tab navigation, audio completion, rapid tests, and a full app reload while audio was previously active.
7. Verify no overlapping sound, the 20-second overdue cadence, acknowledgement persistence and both saved gains after restart.

If the native exception persists in a newly rebuilt/relaunched installation, capture the complete Java stack (especially the `expo.modules.*` frames). This will distinguish another native player/library from the OG6 audio loader; the abbreviated message cannot establish that.

References: https://github.com/expo/expo/issues/31225 and https://github.com/expo/expo/blob/sdk-53/packages/expo-av/src/AV.types.ts (initial `androidImplementation` contract).
