import { Audio } from './expoAudio.ts';
import type { AuthorizedAlertSound } from '../../services/alertSoundValidation.ts';
export const releasedIds: string[] = [];
export async function resolveAuthorizedAlertSound(selection: AuthorizedAlertSound) {
  if (selection.id === 'missing') throw new Error('Saved test audio is missing.');
  return `fixture://${selection.id}`;
}
export function releaseAuthorizedAlertSound(id: string) { releasedIds.push(id); }
export async function loadDecodedAlertSound(uri: string, volume = 0) {
  const sound = new Audio.Sound(uri, volume);
  return { sound, status: await sound.getStatusAsync() };
}
