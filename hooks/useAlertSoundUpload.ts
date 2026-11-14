import { useCallback, useEffect, useRef, useState } from 'react';
import { useTracker } from './useTracker';
import { useAudio } from './useAudio';
import { useAlert } from './useCommandAlert';
import { discardUncommittedAlertSound, selectAuthorizedAlertSound } from '@/services/authorizedAlertSound';
import { audioSelectionPatch } from '@/services/audioConfiguration';
import { configureAlertAudio, setChannelPlaybackVolume, stopSound } from '@/services/audio';
import { AudioChannel, clampVolume, soundChannel } from '@/services/soundClips';
import type { AuthorizedAlertSound } from '@/services/alertSoundValidation';

export function useAlertSoundUpload(channel: AudioChannel) {
  const tracker = useTracker(); const controller = useAudio(); const { showAlert } = useAlert();
  const latest = useRef({ tracker, controller }); latest.current = { tracker, controller };
  const alarm = channel === 'alarm'; const label = alarm ? 'Alarm' : 'Notification';
  const savedVolume = alarm ? tracker.data.settings.alarmVolume : tracker.data.settings.notificationVolume;
  const selected = alarm ? tracker.data.settings.alarmSound : tracker.data.settings.notificationSound;
  const [visible, setVisible] = useState(false); const [authorized, setAuthorized] = useState(false);
  const [uploading, setUploading] = useState(false); const [removing, setRemoving] = useState(false);
  const [error, setError] = useState(''); const [status, setStatus] = useState(''); const [volume, setVolume] = useState(savedVolume);
  const alive = useRef(true); const locked = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { setVolume(savedVolume); }, [savedVolume]);
  const open = useCallback(() => { setAuthorized(false); setError(''); setStatus(''); setVisible(true); }, []);
  const close = useCallback(() => { if (!locked.current) setVisible(false); }, []);
  const upload = useCallback(async () => {
    const current = latest.current;
    if (!authorized || locked.current || !current.tracker.loaded || current.tracker.busy) return;
    locked.current = true; setUploading(true); setError(''); setStatus('');
    let staged: AuthorizedAlertSound | null = null; let saved = false;
    try {
      staged = await selectAuthorizedAlertSound(); if (!staged) return;
      await latest.current.tracker.updateSettings(audioSelectionPatch(channel, staged)); saved = true;
      if (alive.current) {
        setVisible(false);
        setStatus(`${label} sound saved: ${staged.filename}. The other sound is unchanged. Use PREVIEW or TEST ${label.toUpperCase()} to hear this file and enable it in browsers.`);
      }
    } catch (e) {
      if (staged && !saved) await discardUncommittedAlertSound(staged).catch(() => {});
      if (alive.current) setError(e instanceof Error ? e.message : `Unable to upload ${channel} audio. Both saved selections are unchanged.`);
    } finally { locked.current = false; if (alive.current) setUploading(false); }
  }, [authorized, channel, label]);

  const remove = useCallback(async () => {
    const current = latest.current;
    if (locked.current || !current.tracker.loaded || current.tracker.busy) return;
    locked.current = true; setRemoving(true); setError(''); setStatus('');
    try {
      await current.tracker.updateSettings(audioSelectionPatch(channel, null));
      await configureAlertAudio(channel, null);
      if (alive.current) setStatus(`${label} sound removed. The other selected sound and both volume preferences are unchanged.`);
    } catch (e) { if (alive.current) setError(e instanceof Error ? e.message : 'Unable to remove this sound. Retry.'); }
    finally { locked.current = false; if (alive.current) setRemoving(false); }
  }, [channel, label]);
  const requestRemove = useCallback(() => {
    showAlert(`Remove ${channel} sound?`, `Only the ${channel} selection will be cleared. The other sound, equipment records and volume settings will be preserved.`, [
      { text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => { void remove(); } },
    ]);
  }, [channel, remove, showAlert]);
  const previewOrTest = useCallback(async (preview: boolean) => {
    if (locked.current) return;
    setError(''); setStatus('');
    const message = await latest.current.controller.test(channel === 'alarm', preview);
    if (alive.current) setStatus(message);
  }, [channel]);
  const preview = useCallback(() => { void previewOrTest(true); }, [previewOrTest]);
  const test = useCallback(() => { void previewOrTest(false); }, [previewOrTest]);
  const stop = useCallback(async () => {
    try { await stopSound(channel); if (alive.current) setStatus(`${label} preview stopped.`); }
    catch { if (alive.current) setError('Unable to stop this preview. Retry.'); }
  }, [channel, label]);

  // Slider movement updates only this live player channel. Persistence occurs on release,
  // avoiding a tracker write for every pixel and restoring saved gain if saving fails.
  const changeVolume = useCallback((value: number) => {
    const next = clampVolume(value); setVolume(next); void setChannelPlaybackVolume(channel, next);
  }, [channel]);
  const saveVolume = useCallback(async (value: number) => {
    const next = clampVolume(value); setVolume(next); setError('');
    try {
      await latest.current.tracker.updateSettings(channel === 'alarm' ? { alarmVolume: next } : { notificationVolume: next });
    } catch (e) {
      const settings = latest.current.tracker.data.settings; const previous = channel === 'alarm' ? settings.alarmVolume : settings.notificationVolume;
      if (alive.current) { setVolume(previous); setError(e instanceof Error ? e.message : 'Unable to save volume.'); }
      await setChannelPlaybackVolume(channel, previous);
    }
  }, [channel]);
  const playback = controller.audio[channel];
  const disabled = tracker.busy || !tracker.loaded || uploading || removing || controller.testing || controller.acknowledging;
  const testDisabled = disabled || !selected || playback.configuring || playback.sourceId !== selected?.id;
  const previewPlaying = Boolean(controller.audio.testPlayback && controller.audio.playing && soundChannel(controller.audio.playing) === channel);
  return { channel, label, visible, authorized, setAuthorized, uploading, removing, error, status, open, close, upload, requestRemove,
    selected, disabled, testDisabled, preview, test, stop, previewPlaying, volume, changeVolume, saveVolume, playback, browser: controller.browser };
}
