export interface AudioPreferences { notificationVolume: number; alarmVolume: number; alarmEnabled?: boolean; audioPreferencesVersion?: number }
export function normalizeAudioPreferences(input: Partial<AudioPreferences>): AudioPreferences {
  const volume = (value: number | undefined) => typeof value === 'number' && Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 100;
  // One-time requested maximum-volume upgrade; later saved volume choices remain unchanged.
  const upgraded = input.audioPreferencesVersion === 2;
  return { notificationVolume: upgraded ? volume(input.notificationVolume) : 100,
    alarmVolume: upgraded ? volume(input.alarmVolume) : 100,
    alarmEnabled: typeof input.alarmEnabled === 'boolean' ? input.alarmEnabled : true,
    audioPreferencesVersion: 2 };
}
