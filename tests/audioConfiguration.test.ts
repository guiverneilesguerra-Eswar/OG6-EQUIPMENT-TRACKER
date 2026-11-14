import { audioSelectionPatch, normalizeAudioSelections } from '../services/audioConfiguration.ts';
import type { AuthorizedAlertSound } from '../services/alertSoundValidation.ts';
function equal(actual: unknown, expected: unknown) { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`); }
const sound = (id: string): AuthorizedAlertSound => ({ id, filename: `${id}.wav`, extension: 'wav', mimeType: 'audio/wav', sizeBytes: 100, durationMillis: 1000, uploadedAt: '2026-11-14T10:00:00.123Z', authorized: true });
Deno.test('legacy shared sound migrates without losing selection or altering data', () => {
  const legacy = sound('legacy'); const input = { alertSound: legacy, notificationVolume: 20, alarmVolume: 80 };
  const before = JSON.stringify(input); const result = normalizeAudioSelections(input);
  equal(result, { notificationSound: legacy, alarmSound: legacy }); equal(JSON.stringify(input), before);
  equal(normalizeAudioSelections({}), { notificationSound: null, alarmSound: null });
});
Deno.test('independent replacement/removal persists without restoring the legacy clip', () => {
  const legacy = sound('legacy'); const notification = sound('notification'); const alarm = sound('alarm');
  const settings = { alertSound: legacy, ...normalizeAudioSelections({ alertSound: legacy }), notificationVolume: 20, alarmVolume: 80 };
  const before = JSON.stringify(settings);
  const changedNotification = { ...settings, ...audioSelectionPatch('notification', notification) };
  equal(changedNotification.notificationSound, notification); equal(changedNotification.alarmSound, legacy);
  const changedAlarm = { ...changedNotification, ...audioSelectionPatch('alarm', alarm) };
  equal(changedAlarm.notificationSound, notification); equal(changedAlarm.alarmSound, alarm);
  equal(changedAlarm.notificationVolume, 20); equal(changedAlarm.alarmVolume, 80);
  const removedNotification = { ...changedAlarm, ...audioSelectionPatch('notification', null) };
  const reloaded = normalizeAudioSelections(JSON.parse(JSON.stringify(removedNotification)));
  equal(reloaded.notificationSound, null); equal(reloaded.alarmSound, alarm);
  const removedAlarm = normalizeAudioSelections({ ...removedNotification, ...audioSelectionPatch('alarm', null) });
  equal(removedAlarm, { notificationSound: null, alarmSound: null });
  equal(JSON.stringify(settings), before);
});
Deno.test('each channel patch contains only its own selection key', () => {
  equal(Object.keys(audioSelectionPatch('notification', sound('n'))), ['notificationSound']);
  equal(Object.keys(audioSelectionPatch('alarm', sound('a'))), ['alarmSound']);
  equal(audioSelectionPatch('notification', null), { notificationSound: null });
  equal(audioSelectionPatch('alarm', null), { alarmSound: null });
});
