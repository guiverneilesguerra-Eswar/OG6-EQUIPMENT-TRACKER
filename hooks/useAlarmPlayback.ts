import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { useTracker } from './useTracker';
import { AudioState, configureAlertAudio, getAudioState, playAlert, prepareAudio, setAudioForeground, setPlaybackVolume, stopSound, subscribeAudio } from '@/services/audio';
import { alarmCountdown } from '@/services/alarmCountdown';
import { pendingOverdueIds } from '@/services/alarmPolicy';
import { alarmRepeatMilliseconds } from '@/services/soundClips';

// One app-wide scheduler and one serialized player; each source is prepared independently.
export function useAlarmPlayback() {
  const tracker = useTracker(); const { data, loaded } = tracker; const s = data.settings;
  const [audio, setAudio] = useState<AudioState>(getAudioState);
  const [foreground, setForeground] = useState(true); const [clock, setClock] = useState(Date.now());
  const [actionError, setActionError] = useState(''); const [acknowledging, setAcknowledging] = useState(false);
  const [testing, setTesting] = useState(false); const [lastAlarmAt, setLastAlarmAt] = useState(0);
  const lastAlarm = useRef(0); const signature = useRef(''); const halted = useRef(false);
  const alive = useRef(true); const actionBusy = useRef(false); const latest = useRef(tracker); latest.current = tracker;
  const knownSystemNotices = useRef<Set<string> | null>(null);
  const pending = useMemo(() => loaded ? pendingOverdueIds(data.withdrawals, data.notices, clock) : [], [loaded, data.withdrawals, data.notices, clock]);
  const pendingKey = pending.slice().sort().join('|'); const alarmAudio = audio.alarm;
  const markAlarmTime = useCallback((at: number) => { lastAlarm.current = at; setLastAlarmAt(at); }, []);
  const countdown = alarmCountdown({ now: clock, lastAlarmAt, pendingCount: pending.length,
    enabled: s.enabled && s.alarmEnabled !== false, volume: s.alarmVolume, foreground,
    browser: Platform.OS === 'web', unlocked: alarmAudio.unlocked, ready: alarmAudio.ready,
    requiresUpload: !s.alarmSound || alarmAudio.requiresUpload, error: alarmAudio.error,
    halted: halted.current, testing: audio.testPlayback, playing: audio.playing === 'alarm' });

  useEffect(() => { if (loaded) void configureAlertAudio('notification', s.notificationSound).catch(() => {}); }, [loaded, s.notificationSound?.id]);
  useEffect(() => { if (loaded) void configureAlertAudio('alarm', s.alarmSound).catch(() => {}); }, [loaded, s.alarmSound?.id]);

  useEffect(() => {
    alive.current = true; const unsubscribe = subscribeAudio(setAudio);
    let appActive = AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
    const update = () => {
      const browserVisible = Platform.OS !== 'web' || typeof document === 'undefined' || document.visibilityState !== 'hidden';
      const active = appActive && browserVisible;
      setForeground(active); setClock(Date.now()); setAudioForeground(active);
    };
    const subscription = AppState.addEventListener('change', value => { appActive = value === 'active'; update(); });
    if (Platform.OS === 'web' && typeof document !== 'undefined') document.addEventListener('visibilitychange', update);
    update(); const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => {
      alive.current = false; unsubscribe(); clearInterval(timer); subscription.remove();
      if (Platform.OS === 'web' && typeof document !== 'undefined') document.removeEventListener('visibilitychange', update);
      setAudioForeground(false);
    };
  }, []);

  useEffect(() => {
    void setPlaybackVolume(s.notificationVolume, s.alarmVolume);
    if (!s.enabled) void stopSound();
    else if (s.alarmEnabled === false || s.alarmVolume === 0) void stopSound('alarm');
  }, [s.enabled, s.alarmEnabled, s.notificationVolume, s.alarmVolume]);

  useEffect(() => {
    if (signature.current !== pendingKey) { signature.current = pendingKey; markAlarmTime(0); halted.current = false; }
    if (testing || audio.testPlayback) return;
    const eligible = loaded && foreground && s.enabled && s.alarmEnabled !== false && s.alarmVolume > 0 && pending.length > 0;
    if (!eligible) { markAlarmTime(0); void stopSound('overdue'); return; }
    if (!alarmAudio.ready || alarmAudio.configuring || alarmAudio.requiresUpload || alarmAudio.sourceId !== s.alarmSound?.id || !alarmAudio.unlocked || alarmAudio.error || halted.current || acknowledging) return;
    if (clock - lastAlarm.current < alarmRepeatMilliseconds) return;
    markAlarmTime(clock); void playAlert('alarm', s.alarmVolume);
  }, [pendingKey, pending.length, loaded, foreground, clock, s.enabled, s.alarmEnabled, s.alarmVolume, s.alarmSound?.id, alarmAudio.ready, alarmAudio.configuring, alarmAudio.requiresUpload, alarmAudio.sourceId, alarmAudio.unlocked, alarmAudio.error, audio.testPlayback, acknowledging, testing, markAlarmTime]);

  useEffect(() => {
    if (!loaded) return;
    const errors = data.notices.filter(n => n.type === 'error'); const next = new Set(errors.map(n => n.id));
    if (knownSystemNotices.current && s.enabled && foreground) {
      const fresh = errors.filter(n => !knownSystemNotices.current?.has(n.id));
      if (fresh.some(n => n.priority === 'critical') && s.alarmEnabled !== false) void playAlert('critical', s.alarmVolume);
      if (fresh.some(n => n.priority !== 'critical')) void playAlert('system', s.notificationVolume);
    }
    knownSystemNotices.current = next;
  }, [loaded, data.notices, s.enabled, s.alarmEnabled, s.alarmVolume, s.notificationVolume, foreground]);

  const acknowledge = useCallback(async () => {
    if (actionBusy.current) return;
    actionBusy.current = true; halted.current = true; setActionError(''); setAcknowledging(true);
    try { await stopSound('alarm'); await latest.current.acknowledgeOverdue(); }
    catch (error) {
      if (alive.current) setActionError(`${error instanceof Error ? error.message : 'Unable to save acknowledgement.'} Alarm is temporarily stopped; retry acknowledgement to save it.`);
    } finally { actionBusy.current = false; if (alive.current) setAcknowledging(false); }
  }, []);

  const test = useCallback(async (alarm: boolean, preview = false) => {
    if (actionBusy.current) return 'Another audio action is in progress.';
    actionBusy.current = true; setTesting(true); setActionError('');
    try {
      const settings = latest.current.data.settings; const channel = alarm ? 'alarm' : 'notification';
      const selection = alarm ? settings.alarmSound : settings.notificationSound;
      const volume = alarm ? settings.alarmVolume : settings.notificationVolume;
      if (!selection) return `Upload ${channel} sound in SETTINGS first.`;
      if (volume === 0) return `${alarm ? 'Alarm' : 'Notification'} sound is muted. Increase its volume to preview or test.`;
      const status = getAudioState()[channel];
      if (status.configuring || status.sourceId !== selection.id) return `The selected ${channel} sound is loading. Retry shortly.`;
      // A test explicitly replaces current playback; it never acknowledges a withdrawal.
      await stopSound(); await prepareAudio(channel);
      if (alarm) markAlarmTime(Date.now());
      const result = await playAlert(alarm ? 'alarm' : 'notification', volume, true);
      if (!result.ok) {
        const message = result.message || 'Audio test could not start. Try again.';
        if (alive.current) setActionError(message);
        return message;
      }
      return `${preview ? 'Preview' : 'Test'}: ${selection.filename} is playing once at ${channel} volume (${volume}%). Device media volume still applies.`;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to test audio.';
      if (alive.current) setActionError(message);
      return message;
    } finally { actionBusy.current = false; if (alive.current) setTesting(false); }
  }, []);
  const stopTest = useCallback(async () => {
    try { const wasOverdueAlarm = getAudioState().playing === 'alarm'; await stopSound(); if (wasOverdueAlarm) markAlarmTime(Date.now()); }
    catch { if (alive.current) setActionError('Unable to stop audio. Disable alerts and retry.'); }
  }, []);
  return { audio, foreground, pendingCount: pending.length, pendingKey, countdown, actionError, acknowledging, testing,
    acknowledge, test, stopTest, alarmsEnabled: s.enabled && s.alarmEnabled !== false, browser: Platform.OS === 'web' };
}
export type AlarmPlaybackValue = ReturnType<typeof useAlarmPlayback>;
