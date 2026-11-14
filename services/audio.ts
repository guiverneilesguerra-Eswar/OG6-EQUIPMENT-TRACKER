import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import { Platform } from 'react-native';
import { AlertSoundKind, AudioChannel, clampVolume, soundChannel, soundPriority } from './soundClips';
import { AuthorizedAlertSound, validateAlertSoundDuration } from './alertSoundValidation';
import { loadDecodedAlertSound, releaseAuthorizedAlertSound, resolveAuthorizedAlertSound } from './authorizedAlertSound';

export interface ChannelAudioState { ready: boolean; unlocked: boolean; error: string; requiresUpload: boolean; configuring: boolean; sourceId: string | null }
export interface AudioState { notification: ChannelAudioState; alarm: ChannelAudioState; playing: AlertSoundKind | null; testPlayback: boolean }
export interface PlaybackResult { ok: boolean; reason: 'started' | 'blocked' | 'muted' | 'busy' | 'cancelled' | 'failed'; message: string }
interface Job { kind: AlertSoundKind; sourceId: string; volume: number; userInitiated: boolean; cancelled: boolean; resolve: (result: PlaybackResult) => void }
interface Active { sound: Audio.Sound; job: Job; watchdog: ReturnType<typeof setTimeout> | null }
type AudioScope = 'all' | AudioChannel | 'overdue';
interface Slot { selection: AuthorizedAlertSound | null; heldSourceId: string | null; clip: Audio.Sound | null; prepared: Promise<void> | null; configuration: Promise<void> | null; generation: number; initialized: boolean }
const initialChannel = (): ChannelAudioState => ({ ready: false, unlocked: Platform.OS !== 'web', error: '', requiresUpload: true, configuring: false, sourceId: null });
const initialSlot = (): Slot => ({ selection: null, heldSourceId: null, clip: null, prepared: null, configuration: null, generation: 0, initialized: false });
let state: AudioState = { notification: initialChannel(), alarm: initialChannel(), playing: null, testPlayback: false };
const slots: Record<AudioChannel, Slot> = { notification: initialSlot(), alarm: initialSlot() };
// Live slider gain also applies to future jobs before the slider-release persistence finishes.
const liveVolumes: Record<AudioChannel, number | null> = { notification: null, alarm: null };
const listeners = new Set<(value: AudioState) => void>();
let audioMode: Promise<void> | null = null;
let active: Active | null = null;
let queue: Job[] = [];
let startingJob: Job | null = null;
let foreground = true;
let operations: Promise<unknown> = Promise.resolve();
const response = (reason: PlaybackResult['reason'], message = ''): PlaybackResult => ({ ok: reason === 'started', reason, message });
function publish(patch: Partial<AudioState>) { state = { ...state, ...patch }; listeners.forEach(listener => listener(state)); }
function publishChannel(channel: AudioChannel, patch: Partial<ChannelAudioState>) {
  publish(channel === 'alarm' ? { alarm: { ...state.alarm, ...patch } } : { notification: { ...state.notification, ...patch } });
}
export function getAudioState() { return state; }
export function subscribeAudio(listener: (value: AudioState) => void) { listeners.add(listener); listener(state); return () => { listeners.delete(listener); }; }
function exclusive(task: () => Promise<void>) { const next = operations.then(task, task); operations = next.catch(() => {}); return next; }
function initializeAudioMode() {
  if (!audioMode) {
    const task = Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false, shouldDuckAndroid: false,
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix, interruptionModeIOS: InterruptionModeIOS.DoNotMix, playThroughEarpieceAndroid: false });
    audioMode = task;
    void task.catch(() => { if (audioMode === task) audioMode = null; });
  }
  return audioMode;
}
function releaseIfUnused(id: string) {
  if (!Object.values(slots).some(slot => slot.selection?.id === id || slot.heldSourceId === id)) releaseAuthorizedAlertSound(id);
}
function matchesScope(kind: AlertSoundKind, scope: AudioScope) { return scope === 'all' || (scope === 'overdue' ? kind === 'alarm' : soundChannel(kind) === scope); }
function cancelJobs(scope: AudioScope) {
  const matches = (kind: AlertSoundKind) => matchesScope(kind, scope);
  queue.forEach(job => { if (matches(job.kind)) { job.cancelled = true; job.resolve(response('cancelled')); } });
  queue = queue.filter(job => !matches(job.kind));
  if (startingJob && matches(startingJob.kind)) startingJob.cancelled = true;
  if (active && matches(active.job.kind)) active.job.cancelled = true;
}

// Independent source slots, decoder state and browser activation. Replacing/removing one
// channel cancels only its jobs and leaves the other selected file and playback untouched.
export function configureAlertAudio(channel: AudioChannel, selection?: AuthorizedAlertSound | null): Promise<void> {
  const slot = slots[channel]; const next = selection ?? null;
  if (slot.initialized && (slot.selection?.id ?? null) === (next?.id ?? null)) {
    return slot.configuration || (next ? prepareAudio(channel) : Promise.resolve());
  }
  const previousId = slot.selection?.id; const token = ++slot.generation;
  slot.initialized = true; slot.selection = next;
  publishChannel(channel, { ready: false, configuring: true, sourceId: next?.id ?? null, requiresUpload: !next, error: '', unlocked: Platform.OS !== 'web' });
  cancelJobs(channel);
  const task = (async () => {
    await exclusive(async () => {
      if (active && soundChannel(active.job.kind) === channel) await stopActive();
      if (slot.prepared) await slot.prepared.catch(() => {});
      if (slot.clip) { slot.clip.setOnPlaybackStatusUpdate(null); try { await slot.clip.unloadAsync(); } catch {} slot.clip = null; }
      slot.prepared = null; slot.heldSourceId = null;
      if (previousId) releaseIfUnused(previousId);
    });
    if (token !== slot.generation) return;
    publishChannel(channel, { configuring: false });
    if (next) await prepareAudio(channel);
    pump();
  })();
  slot.configuration = task;
  void task.finally(() => { if (slot.configuration === task) slot.configuration = null; }).catch(() => {});
  return task;
}
export function prepareAudio(channel: AudioChannel): Promise<void> {
  const slot = slots[channel];
  if (!slot.selection) return Promise.reject(new Error(`Upload ${channel} sound in SETTINGS first. No substitute audio is used.`));
  if (state[channel].configuring && slot.configuration) return slot.configuration;
  if (slot.prepared) return slot.prepared;
  const selection = slot.selection; const token = slot.generation; slot.heldSourceId = selection.id;
  const task = (async () => {
    await initializeAudioMode();
    const uri = await resolveAuthorizedAlertSound(selection);
    const loaded = await loadDecodedAlertSound(uri, 1); const sound = loaded.sound;
    if (token !== slot.generation) { await sound.unloadAsync(); throw new Error('Sound selection changed.'); }
    try { validateAlertSoundDuration(loaded.status.isLoaded ? loaded.status.durationMillis : undefined); }
    catch (error) { await sound.unloadAsync(); throw error; }
    slot.clip = sound;
    sound.setOnPlaybackStatusUpdate(status => {
      if (active?.sound !== sound) return;
      if (!status.isLoaded && status.error) {
        publishChannel(channel, { error: `${channel === 'alarm' ? 'Alarm' : 'Notification'} playback stopped. Retry its preview in SETTINGS.`, unlocked: Platform.OS !== 'web' });
        void exclusive(async () => { if (active?.sound === sound) await stopActive(); }).then(pump).catch(() => {});
      } else if (status.isLoaded && status.didJustFinish) {
        void exclusive(async () => { if (active?.sound === sound) await stopActive(); }).then(pump).catch(() => {});
      }
    });
    publishChannel(channel, { ready: true, error: '' });
  })();
  slot.prepared = task;
  void task.catch(error => {
    if (slot.prepared === task) slot.prepared = null;
    if (token === slot.generation) publishChannel(channel, { ready: false, error: error instanceof Error ? error.message : 'Unable to load this sound. Replace it or retry its preview.' });
  });
  return task;
}
async function stopActive() {
  const previous = active; if (!previous) return;
  if (previous.watchdog) clearTimeout(previous.watchdog);
  // Ownership is retained until stopping resolves; two clips never play simultaneously.
  try { await previous.sound.stopAsync(); }
  catch {
    try { await previous.sound.unloadAsync(); } catch {}
    const channel = soundChannel(previous.job.kind); const slot = slots[channel];
    if (slot.clip === previous.sound) { slot.clip = null; slot.prepared = null; publishChannel(channel, { ready: false }); }
  }
  if (active === previous) { active = null; publish({ playing: null, testPlayback: false }); }
}
function pump() {
  void exclusive(async () => {
    if (active) return;
    const job = queue.shift(); if (!job) return;
    const channel = soundChannel(job.kind); const slot = slots[channel]; startingJob = job;
    try {
      if (job.cancelled || !foreground || state[channel].configuring || job.sourceId !== slot.selection?.id) { job.resolve(response('cancelled')); return; }
      await prepareAudio(channel);
      if (job.cancelled || !foreground || state[channel].configuring || job.sourceId !== slot.selection?.id) { job.resolve(response('cancelled')); return; }
      if (job.volume === 0) { job.resolve(response('muted')); return; }
      const sound = slot.clip; if (!sound) throw new Error('Selected audio is not loaded.');
      await sound.setPositionAsync(0); await sound.setVolumeAsync(job.volume / 100);
      if (job.cancelled || !foreground || job.volume === 0) { job.resolve(response('cancelled')); return; }
      const entry: Active = { sound, job, watchdog: null }; active = entry;
      publish({ playing: job.kind, testPlayback: job.userInitiated }); publishChannel(channel, { error: '' });
      const result = await sound.playAsync();
      if (job.cancelled || !foreground) { await stopActive(); job.resolve(response('cancelled')); return; }
      if (!result.isLoaded || !result.isPlaying) throw new Error('Playback did not start.');
      if (job.userInitiated) publishChannel(channel, { unlocked: true });
      const duration = validateAlertSoundDuration(result.durationMillis);
      entry.watchdog = setTimeout(() => { void exclusive(async () => { if (active === entry) await stopActive(); }).then(pump).catch(() => {}); }, duration + 1000);
      job.resolve(response('started'));
    } catch {
      await stopActive();
      const message = !state[channel].ready && state[channel].error ? state[channel].error : Platform.OS === 'web'
        ? `Browser ${channel} audio is blocked or unavailable. Use its PREVIEW or TEST button in SETTINGS and check browser/device volume.`
        : `Unable to play ${channel} audio. Check device media volume and retry its TEST button or replace this file.`;
      publishChannel(channel, { error: message, unlocked: Platform.OS !== 'web' });
      job.resolve(response('failed', message));
      // A bad alarm file must not cancel independently configured notification jobs.
      cancelJobs(channel);
    } finally { if (startingJob === job) startingJob = null; }
  }).then(() => { if (!active && queue.length) pump(); }).catch(() => {});
}
export function playAlert(kind: AlertSoundKind, volume: number, userInitiated = false): Promise<PlaybackResult> {
  const channel = soundChannel(kind); const status = state[channel]; const sourceId = slots[channel].selection?.id;
  const level = liveVolumes[channel] ?? clampVolume(volume);
  if (!sourceId || status.requiresUpload) return Promise.resolve(response('failed', `Upload ${channel} sound in SETTINGS first.`));
  if (status.configuring) return Promise.resolve(response('busy', 'This sound is loading. Try again shortly.'));
  if (!foreground) return Promise.resolve(response('cancelled', 'Audio is paused while the application is inactive.'));
  if (level === 0) return Promise.resolve(response('muted', 'This sound is muted. Increase its volume to test.'));
  if (Platform.OS === 'web' && !status.unlocked && !userInitiated) return Promise.resolve(response('blocked', `Use TEST ${channel.toUpperCase()} in SETTINGS to allow this browser sound.`));
  const duplicate = active?.job.kind === kind || startingJob?.kind === kind || queue.some(job => job.kind === kind);
  if (duplicate || queue.length >= 32) return Promise.resolve(response('busy', 'This sound is already playing or scheduled.'));
  return new Promise(resolve => {
    queue.push({ kind, sourceId, volume: level, userInitiated, cancelled: false, resolve });
    queue.sort((a, b) => soundPriority(b.kind) - soundPriority(a.kind));
    if (!userInitiated && soundPriority(kind) === 3 && active && soundChannel(active.job.kind) === 'notification') {
      active.job.cancelled = true; void exclusive(stopActive).then(pump).catch(() => {});
    } else pump();
  });
}
export async function setChannelPlaybackVolume(channel: AudioChannel, volume: number) {
  const level = clampVolume(volume); liveVolumes[channel] = level;
  queue.forEach(job => { if (soundChannel(job.kind) === channel) job.volume = level; });
  if (startingJob && soundChannel(startingJob.kind) === channel) startingJob.volume = level;
  if (active && soundChannel(active.job.kind) === channel) active.job.volume = level;
  await exclusive(async () => {
    if (!active || soundChannel(active.job.kind) !== channel) return;
    if (!active.job.volume) await stopActive(); else await active.sound.setVolumeAsync(active.job.volume / 100);
  }).then(pump).catch(() => { publishChannel(channel, { error: 'Unable to apply this volume. Retry the sound preview.' }); });
}
export async function setPlaybackVolume(notification: number, alarm: number) {
  await Promise.all([setChannelPlaybackVolume('notification', notification), setChannelPlaybackVolume('alarm', alarm)]);
}
export async function stopSound(scope: AudioScope = 'all') {
  cancelJobs(scope);
  await exclusive(async () => { if (active && matchesScope(active.job.kind, scope)) await stopActive(); });
  pump();
}
export function setAudioForeground(value: boolean) { foreground = value; if (!value) void stopSound(); }
export async function disposeAudio() {
  foreground = false; await stopSound();
  await exclusive(async () => {
    const ids = new Set<string>();
    for (const slot of Object.values(slots)) ++slot.generation;
    for (const channel of ['notification', 'alarm'] as const) {
      const slot = slots[channel];
      if (slot.prepared) await slot.prepared.catch(() => {});
      if (slot.clip) { slot.clip.setOnPlaybackStatusUpdate(null); try { await slot.clip.unloadAsync(); } catch {} }
      if (slot.selection) ids.add(slot.selection.id);
      if (slot.heldSourceId) ids.add(slot.heldSourceId);
      slot.clip = null; slot.prepared = null; slot.heldSourceId = null;
      publishChannel(channel, { ready: false, unlocked: Platform.OS !== 'web' });
    }
    ids.forEach(releaseAuthorizedAlertSound);
    publish({ playing: null, testPlayback: false });
  });
}
