import type { AVPlaybackStatusToSet } from 'expo-av';

export type VerifiedAudioBackend = 'MediaPlayer' | 'platform-default';
interface DecoderStatus { isLoaded: boolean; androidImplementation?: string; error?: string }

// Check the NATIVE response, not only the requested options. Never publish a
// ready Android slot backed by ExoPlayer, or pretend an unloaded decoder worked.
export function verifyDecodedAudioBackend(platform: string, status: DecoderStatus): VerifiedAudioBackend {
  if (!status.isLoaded) throw new Error('Audio decoding failed. Choose a supported MP3 or PCM WAV; saved selections are unchanged.');
  if (platform === 'android' && status.androidImplementation !== 'MediaPlayer') {
    throw new Error('Android audio did not load with MediaPlayer. Fully close the app and open the updated build. Do not clear app storage or uninstall; saved records are device-local.');
  }
  return platform === 'android' ? 'MediaPlayer' : 'platform-default';
}

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
