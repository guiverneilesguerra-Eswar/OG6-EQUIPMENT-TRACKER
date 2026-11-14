import type { AuthorizedAlertSound } from './alertSoundValidation';
import type { AudioChannel } from './soundClips';

export interface AudioSelections {
  notificationSound?: AuthorizedAlertSound | null;
  alarmSound?: AuthorizedAlertSound | null;
  /** Read-only migration source; new uploads never write the legacy shared field. */
  alertSound?: AuthorizedAlertSound | null;
}
export function normalizeAudioSelections(input: AudioSelections) {
  // Explicit null is a saved removal, not permission to restore the legacy sound.
  return {
    notificationSound: input.notificationSound === undefined ? input.alertSound ?? null : input.notificationSound,
    alarmSound: input.alarmSound === undefined ? input.alertSound ?? null : input.alarmSound,
  };
}
export function audioSelectionPatch(channel: AudioChannel, selection: AuthorizedAlertSound | null) {
  return channel === 'alarm' ? { alarmSound: selection } : { notificationSound: selection };
}
