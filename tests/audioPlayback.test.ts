import { configureAlertAudio, disposeAudio, getAudioState, playAlert, setAudioForeground, setChannelPlaybackVolume, stopSound } from '../services/audio.ts';
import { maximumConcurrentPlayback, soundInstances } from './mocks/expoAudio.ts';
import { releasedIds } from './mocks/alertSoundFiles.ts';
import type { AuthorizedAlertSound } from '../services/alertSoundValidation.ts';
function equal(actual: unknown, expected: unknown) { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`); }
const selection = (id: string): AuthorizedAlertSound => ({ id, filename: `${id}.mp3`, extension: 'mp3', mimeType: 'audio/mpeg', sizeBytes: 100, durationMillis: 2000, uploadedAt: '2026-11-14T10:00:00.123Z', authorized: true });
const playing = () => soundInstances.find(sound => sound.playing);
Deno.test('independent audio sources, activation, live volumes, cancellation and shared legacy ownership', async () => {
  setAudioForeground(true);
  try {
    await Promise.all([configureAlertAudio('notification', selection('n1')), configureAlertAudio('alarm', selection('a1'))]);
    equal(getAudioState().notification.sourceId, 'n1'); equal(getAudioState().alarm.sourceId, 'a1');
    equal((await playAlert('withdrawal', 100)).reason, 'blocked');
    equal((await playAlert('notification', 30, true)).ok, true);
    equal(getAudioState().notification.unlocked, true); equal(getAudioState().alarm.unlocked, false);
    await setChannelPlaybackVolume('notification', 70); equal(playing()?.volume, 0.7);
    await setChannelPlaybackVolume('alarm', 0); equal(playing()?.volume, 0.7);
    equal((await playAlert('alarm', 100, true)).reason, 'muted');
    await setChannelPlaybackVolume('alarm', 5); equal(playing()?.volume, 0.7);
    await configureAlertAudio('alarm', selection('a2'));
    equal(playing()?.uri, 'fixture://n1'); equal(getAudioState().notification.unlocked, true);
    await stopSound('notification');
    equal((await playAlert('alarm', 100, true)).ok, true);
    await configureAlertAudio('notification', selection('n2'));
    equal(playing()?.uri, 'fixture://a2'); equal(getAudioState().alarm.unlocked, true);
    equal(getAudioState().notification.unlocked, false);
    const queued = playAlert('notification', 80, true);
    await stopSound('alarm'); equal((await queued).ok, true);
    equal(playing()?.uri, 'fixture://n2');
    equal((await playAlert('notification', 80, true)).reason, 'busy');
    await configureAlertAudio('alarm', null);
    equal(playing()?.uri, 'fixture://n2'); equal(getAudioState().notification.sourceId, 'n2');
    equal(getAudioState().alarm.requiresUpload, true);
    await stopSound();
    let missingRejected = false;
    try { await configureAlertAudio('alarm', selection('missing')); }
    catch (error) { missingRejected = true; if (!(error instanceof Error) || !error.message.includes('missing')) throw error; }
    equal(missingRejected, true);
    equal(getAudioState().notification.ready, true);
    equal((await playAlert('return', 100)).ok, true); await stopSound();
    await configureAlertAudio('alarm', selection('a2'));
    equal((await playAlert('critical', 100, true)).ok, true);
    // No pending overdue withdrawal must not truncate a one-shot critical/due alarm.
    await stopSound('overdue'); equal(playing()?.uri, 'fixture://a2');
    await stopSound('alarm');
    await Promise.all([configureAlertAudio('notification', selection('legacy-shared')), configureAlertAudio('alarm', selection('legacy-shared'))]);
    const before = releasedIds.filter(id => id === 'legacy-shared').length;
    await configureAlertAudio('notification', null);
    equal(releasedIds.filter(id => id === 'legacy-shared').length, before);
    equal(getAudioState().alarm.ready, true);
    await configureAlertAudio('alarm', null);
    equal(releasedIds.filter(id => id === 'legacy-shared').length, before + 1);
    equal(maximumConcurrentPlayback, 1);
  } finally { await disposeAudio(); }
});
