export const alertSoundLimits = { maxBytes: 10 * 1024 * 1024, minDurationMillis: 100, maxDurationMillis: 19000 };
export const alertSoundReference = 'https://youtube.com/shorts/xx3nWl6eDHs?si=B-ZxOBbpp15XZQxf';
export interface AuthorizedAlertSound {
  id: string; filename: string; extension: 'mp3' | 'wav'; mimeType: 'audio/mpeg' | 'audio/wav';
  sizeBytes: number; durationMillis: number; uploadedAt: string; authorized: true; referenceUrl?: string;
}
export function validateAlertSoundBytes(filename: string, bytes: Uint8Array) {
  const extension = filename.match(/\.(mp3|wav)$/i)?.[1]?.toLowerCase() as 'mp3' | 'wav' | undefined;
  if (!extension) throw new Error('Choose an authorized .mp3 or .wav audio file.');
  if (!bytes.length || bytes.length > alertSoundLimits.maxBytes) throw new Error('Choose a non-empty audio file no larger than 10 MB.');
  const text = (offset: number, length: number) => String.fromCharCode(...bytes.slice(offset, offset + length));
  const wav = bytes.length >= 44 && text(0, 4) === 'RIFF' && text(8, 4) === 'WAVE';
  const mp3 = bytes.length >= 4 && (text(0, 3) === 'ID3' || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0 && (bytes[1] & 0x06) !== 0));
  if ((extension === 'wav' && !wav) || (extension === 'mp3' && !mp3)) throw new Error('The selected file does not contain valid MP3/WAV audio. Renaming another file is not supported.');
  return { extension, mimeType: extension === 'mp3' ? 'audio/mpeg' as const : 'audio/wav' as const };
}
export function validateAlertSoundDuration(durationMillis: number | undefined) {
  if (typeof durationMillis !== 'number' || !Number.isFinite(durationMillis) || durationMillis < alertSoundLimits.minDurationMillis) throw new Error('The audio could not be decoded or has no usable duration. Choose a supported MP3 or PCM WAV.');
  if (durationMillis > alertSoundLimits.maxDurationMillis) throw new Error('Choose audio no longer than 19 seconds to preserve the existing 20-second alarm interval. Files are not trimmed or substituted.');
  return durationMillis;
}
