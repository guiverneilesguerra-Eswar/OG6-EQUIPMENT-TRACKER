import { alertSoundLimits, validateAlertSoundBytes, validateAlertSoundDuration } from '../services/alertSoundValidation.ts';
function equal(actual: unknown, expected: unknown) { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`); }
function rejects(action: () => unknown) { try { action(); } catch { return; } throw new Error('Expected invalid audio to be rejected.'); }
// File-header fixtures only: these are not playable assets or application sound substitutes.
function wavHeader() { const bytes = new Uint8Array(44); const set = (offset: number, text: string) => { [...text].forEach((char, i) => { bytes[offset + i] = char.charCodeAt(0); }); }; set(0, 'RIFF'); set(8, 'WAVE'); return bytes; }
Deno.test('accepts MP3/WAV headers and preserves the actual file format', () => {
  equal(validateAlertSoundBytes('Reference.WAV', wavHeader()), { extension: 'wav', mimeType: 'audio/wav' });
  equal(validateAlertSoundBytes('reference.mp3', new Uint8Array([0x49, 0x44, 0x33, 4])), { extension: 'mp3', mimeType: 'audio/mpeg' });
  equal(validateAlertSoundBytes('reference.mp3', new Uint8Array([0xff, 0xfb, 0x90, 0])), { extension: 'mp3', mimeType: 'audio/mpeg' });
});
Deno.test('rejects renamed media, unsupported extensions, empty and overlarge files', () => {
  rejects(() => validateAlertSoundBytes('command.mp3', new TextEncoder().encode('<script>test</script>')));
  rejects(() => validateAlertSoundBytes('video.mp4', wavHeader()));
  rejects(() => validateAlertSoundBytes('wrong.mp3', wavHeader()));
  rejects(() => validateAlertSoundBytes('empty.wav', new Uint8Array(0)));
  rejects(() => validateAlertSoundBytes('huge.wav', new Uint8Array(alertSoundLimits.maxBytes + 1)));
});
Deno.test('full decoded clips must finish within the existing alarm repeat window', () => {
  equal(validateAlertSoundDuration(1000), 1000); equal(validateAlertSoundDuration(19000), 19000);
  rejects(() => validateAlertSoundDuration(19001)); rejects(() => validateAlertSoundDuration(0));
  rejects(() => validateAlertSoundDuration(undefined)); rejects(() => validateAlertSoundDuration(Number.NaN));
});
