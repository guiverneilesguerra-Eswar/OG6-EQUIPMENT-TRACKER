import { alarmRepeatMilliseconds } from './soundClips';

export interface AlarmCountdownInput {
  now: number; lastAlarmAt: number; pendingCount: number; enabled: boolean; volume: number;
  foreground: boolean; browser: boolean; unlocked: boolean; ready: boolean;
  requiresUpload: boolean; error: string; halted: boolean; testing: boolean; playing: boolean;
}
export type AlarmBannerMode = 'idle' | 'disabled' | 'muted' | 'upload-required' | 'browser-blocked' | 'audio-error' | 'paused' | 'halted' | 'loading' | 'test' | 'playing' | 'countdown';
export function alarmCountdown(input: AlarmCountdownInput): { mode: AlarmBannerMode; label: string; seconds: number | null } {
  const status = (mode: AlarmBannerMode, label: string) => ({ mode, label, seconds: null });
  if (input.testing) return status('test', 'TEST SOUND PLAYING');
  if (!input.pendingCount) return status('idle', 'NO PENDING OVERDUE ALARMS');
  if (!input.enabled) return status('disabled', 'ALARM DISABLED');
  if (input.volume <= 0) return status('muted', 'ALARM MUTED · 0%');
  if (input.requiresUpload) return status('upload-required', 'ALARM SOUND NOT UPLOADED');
  if (input.browser && !input.unlocked) return status('browser-blocked', 'BROWSER AUDIO BLOCKED');
  if (input.error) return status('audio-error', 'AUDIO UNAVAILABLE');
  if (!input.foreground) return status('paused', 'ALARM PAUSED · APP INACTIVE');
  if (input.halted) return status('halted', 'ALARM STOPPED · RETRY ACKNOWLEDGEMENT');
  if (!input.ready) return status('loading', 'LOADING SOUND');
  // Display only: the scheduler retains its existing 20-second attempt timestamps.
  const seconds = input.lastAlarmAt > 0 ? Math.max(0, Math.ceil((input.lastAlarmAt + alarmRepeatMilliseconds - input.now) / 1000)) : 0;
  const time = `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  return { mode: input.playing ? 'playing' : 'countdown', label: `${input.playing ? 'ALARM PLAYING · NEXT IN' : 'NEXT ALARM IN'} ${time}`, seconds };
}
