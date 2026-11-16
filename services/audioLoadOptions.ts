import type { AVPlaybackStatusToSet } from 'expo-av';

// Select the backend BEFORE creating any player. JS timers or promise queues
// cannot move ExoPlayer's native release/audio-focus work onto Android's main thread.
// OG6 only accepts local MP3/PCM WAV clips, supported by Android MediaPlayer.
export function getAlertSoundInitialStatus(platform: string, volume = 0): AVPlaybackStatusToSet {
  return {
    shouldPlay: false,
    isLooping: false,
    volume: Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 0,
    progressUpdateIntervalMillis: 150,
    ...(platform === 'android' ? { androidImplementation: 'MediaPlayer' } : {}),
  };
}
