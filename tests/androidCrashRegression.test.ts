// Structural regression checks complement, but do not replace, Hermes/device tests.
function check(value: boolean, message: string) {
  if (!value) throw new Error(message);
}
const source = (path: string) => Deno.readTextFile(new URL(path, import.meta.url));

Deno.test('batch feedback cannot replace the equipment status callback', async () => {
  const hook = await source('../hooks/useBatchWithdrawals.ts');
  const component = await source('../components/feature/BatchWithdrawals.tsx');
  check(hook.includes('const [statusMessage, setStatusMessage]'), 'Feedback needs a distinct state name');
  check(!/\[status\s*,/.test(hook), 'String state named status would shadow tracker.status');
  check(!/\bsetStatus\(/.test(hook), 'Every feedback update must use setStatusMessage');
  check(!hook.includes('return { ...tracker'), 'Batch UI contract cannot be overwritten by tracker spreads');
  check(hook.includes('const getEquipmentStatus = useCallback') && hook.includes('assetStatus(assetId, tracker.data.withdrawals, tracker.now)'), 'Use authoritative records in a separately named callback');
  check(hook.includes('loaded: tracker.loaded, getEquipmentStatus'), 'Export the equipment callback explicitly');
  check(hook.includes('error, statusMessage, working'), 'Feedback must be exported separately');
  check(component.includes('{m.statusMessage ?') && component.includes('{m.statusMessage}</Text>'), 'Banner must render the message, not the function');
  check(!/\{m\.status\}/.test(component), 'Equipment status callback cannot be a Text child');
  check(component.includes('m.getEquipmentStatus(a.id)') && component.includes('m.getEquipmentStatus(w.assetId)'), 'Inventory and receipt status checks must remain active');
  check(!/m\.status\(/.test(component), 'Rows cannot call a generic status property');
  check(component.includes('androidFixRevision'), 'Device form must show the active repair revision');
});

Deno.test('all authorized sound probes and playback use the Android-safe initial backend', async () => {
  const files = await source('../services/authorizedAlertSound.ts');
  const playback = await source('../services/audio.ts');
  check(files.includes("import { getAlertSoundInitialStatus, verifyDecodedAudioBackend } from './audioLoadOptions'"), 'Loader must import both requested and native-response backend policies');
  check(files.includes('Audio.Sound.createAsync({ uri }, getAlertSoundInitialStatus(Platform.OS, volume))'), 'Choose backend during creation, not after loading');
  check((files.match(/Audio\.Sound\.createAsync\(/g) || []).length === 1, 'Keep decoder creation centralized');
  check(files.includes('await loadDecodedAlertSound(uri); probe = loaded.sound'), 'Uploads must use the safe loader');
  check(files.includes('await loadDecodedAlertSound(uri); probe = result.sound'), 'Restored clips must use the safe loader');
  check(playback.includes('await loadDecodedAlertSound(uri, 1)'), 'Both player slots must use the safe loader');
  check(files.includes('void result.sound.unloadAsync().catch'), 'Late decoders must still be unloaded');
  check(files.includes('verifyDecodedAudioBackend(Platform.OS, result.status)'), 'Verify native decoder before accepting uploads or restored clips');
  check(playback.includes('backend = verifyDecodedAudioBackend(Platform.OS, loaded.status)'), 'Slots must verify native backend before publishing readiness');
  check(playback.includes('ready: true, backend'), 'Expose verified backend rather than only the requested backend');
});
