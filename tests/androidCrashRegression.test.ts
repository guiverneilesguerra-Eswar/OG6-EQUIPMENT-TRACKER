// Structural regression checks complement, but do not replace, Hermes/device tests.
function check(value: boolean, message: string) {
  if (!value) throw new Error(message);
}
const source = (path: string) => Deno.readTextFile(new URL(path, import.meta.url));

Deno.test('unified withdrawal rows keep an explicit equipment status callback', async () => {
  const hook = await source('../hooks/useWithdrawals.ts');
  const component = await source('../components/feature/WithdrawalForms.tsx');
  const page = await source('../app/(tabs)/withdrawals.tsx');
  check(!/\[status\s*,/.test(hook), 'String state named status would shadow tracker.status');
  check(hook.includes('const getEquipmentStatus = useCallback') && hook.includes('assetStatus(assetId, tracker.data.withdrawals, tracker.now)'), 'Use authoritative records in a separately named callback');
  check(hook.includes('return { ...tracker, getEquipmentStatus'), 'Export the constructed callback after tracker properties');
  check(!/\{m\.status\}/.test(component) && !/m\.status\(/.test(component), 'Rows cannot render or invoke a generic feedback property');
  check(component.includes('m.getEquipmentStatus(a.id)') && component.includes('m.getEquipmentStatus(item.assetId)'), 'Inventory and receipt status checks must remain active');
  check(!page.includes('BatchWithdrawals'), 'The standard page must not mount the removed batch module');
  check(page.includes('onPress={m.beginWithdrawal}'), 'Only the standard New Withdrawal action creates transactions');
  check(hook.includes('await tracker.withdrawTransaction(input)') && hook.includes('validateWithdrawalDraft(tracker.data, input, saved)'), 'Final save must revalidate the complete transaction');
  check(component.includes('accessibilityRole="checkbox"') && component.includes('keyboardShouldPersistTaps="handled"'), 'Android must support multi-select list taps');
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
