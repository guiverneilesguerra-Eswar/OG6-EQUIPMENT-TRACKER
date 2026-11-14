// Alert event categories and scheduling only. Audio comes exclusively from the authorized uploaded MP3/WAV.
export type AudioChannel = 'notification' | 'alarm';
export type AlertSoundKind = 'alarm' | 'critical' | 'due' | 'withdrawal' | 'return' | 'notification' | 'system';
export const soundKinds: AlertSoundKind[] = ['alarm', 'critical', 'due', 'withdrawal', 'return', 'notification', 'system'];
export function soundChannel(kind: AlertSoundKind): AudioChannel { return kind === 'alarm' || kind === 'critical' || kind === 'due' ? 'alarm' : 'notification'; }
export const alarmRepeatMilliseconds = 20000;
export function soundPriority(kind: AlertSoundKind) { return kind === 'alarm' || kind === 'critical' ? 3 : kind === 'due' || kind === 'system' ? 2 : 1; }
export function clampVolume(value: number) { return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 100; }
