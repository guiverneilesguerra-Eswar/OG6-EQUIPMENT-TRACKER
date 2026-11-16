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
  check(hook.includes('status: tracker.status'), 'Hook must preserve the equipment status function');
  check(hook.includes('error, statusMessage, working'), 'Feedback must be exported separately');
  check(component.includes('{m.statusMessage ?') && component.includes('{m.statusMessage}</Text>'), 'Banner must render the message, not the function');
  check(!/\{m\.status\}/.test(component), 'Equipment status callback cannot be a Text child');
  check(component.includes('m.status(a.id)') && component.includes('m.status(w.assetId)'), 'Inventory and receipt status checks must remain active');
});

Deno.test('all authorized sound probes and playback use the Android-safe initial backend', async () => {
  const files = await source('../services/authorizedAlertSound.ts');
  const playback = await source('../services/audio.ts');
  check(files.includes("import { getAlertSoundInitialStatus } from './audioLoadOptions'"), 'Loader must import the backend policy');
  check(files.includes('Audio.Sound.createAsync({ uri }, getAlertSoundInitialStatus(Platform.OS, volume))'), 'Choose backend during creation, not after loading');
  check((files.match(/Audio\.Sound\.createAsync\(/g) || []).length === 1, 'Keep decoder creation centralized');
  check(files.includes('await loadDecodedAlertSound(uri); probe = loaded.sound'), 'Uploads must use the safe loader');
  check(files.includes('await loadDecodedAlertSound(uri); probe = result.sound'), 'Restored clips must use the safe loader');
  check(playback.includes('await loadDecodedAlertSound(uri, 1)'), 'Both player slots must use the safe loader');
  check(files.includes('void result.sound.unloadAsync().catch'), 'Late decoders must still be unloaded');
});
