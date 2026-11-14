// Test-only decoder/player; never imported by the application or used as a sound asset.
type LoadedStatus = { isLoaded: true; durationMillis: number; isPlaying: boolean; didJustFinish: boolean };
type Status = LoadedStatus | { isLoaded: false; error?: string };
export const soundInstances: Audio.Sound[] = [];
export let maximumConcurrentPlayback = 0;
export const InterruptionModeAndroid = { DoNotMix: 1 };
export const InterruptionModeIOS = { DoNotMix: 1 };
export namespace Audio {
  export async function setAudioModeAsync(_options: unknown) {}
  export class Sound {
    playing = false; unloaded = false; volume: number; position = 0;
    private listener: ((status: Status) => void) | null = null;
    constructor(public readonly uri: string, volume: number) { this.volume = volume; soundInstances.push(this); }
    setOnPlaybackStatusUpdate(listener: ((status: Status) => void) | null) { this.listener = listener; }
    async getStatusAsync(): Promise<LoadedStatus> { return { isLoaded: true, durationMillis: 2000, isPlaying: this.playing, didJustFinish: false }; }
    async setVolumeAsync(value: number) { this.volume = value; }
    async setPositionAsync(value: number) { this.position = value; }
    async playAsync() {
      if (this.unloaded) throw new Error('Unloaded fixture');
      this.playing = true;
      maximumConcurrentPlayback = Math.max(maximumConcurrentPlayback, soundInstances.filter(sound => sound.playing).length);
      return this.getStatusAsync();
    }
    async stopAsync() { this.playing = false; this.position = 0; }
    async unloadAsync() { this.playing = false; this.unloaded = true; this.listener = null; }
  }
}
