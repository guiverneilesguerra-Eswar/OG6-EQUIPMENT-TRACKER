import { unzlibSync } from 'fflate';
import { signaturePng } from '../services/signaturePng.ts';
import { signatureRaster } from '../constants/report.ts';
const check = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
const signature = [[{ x: 25, y: 40 }, { x: 100, y: 75 }, { x: 200, y: 100 }], [{ x: 210, y: 60 }, { x: 260, y: 65 }]];
function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
Deno.test('captured pen strokes become a valid transparent PNG without mutating the evidence', () => {
  const before = JSON.stringify(signature); const bytes = signaturePng(signature)!;
  check(bytes.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10', 'PNG file signature.');
  const view = new DataView(bytes.buffer); let offset = 8; let raw = new Uint8Array(0);
  const types: string[] = [];
  while (offset < bytes.length) {
    const length = view.getUint32(offset); const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8)); types.push(type);
    check(view.getUint32(offset + 8 + length) === crc32(bytes.subarray(offset + 4, offset + 8 + length)), `${type} CRC must be valid.`);
    if (type === 'IHDR') {
      check(view.getUint32(offset + 8) === signatureRaster.width && view.getUint32(offset + 12) === signatureRaster.height, 'Preserve the pad aspect ratio.');
      check(bytes[offset + 16] === 8 && bytes[offset + 17] === 6, '8-bit RGBA format.');
    }
    if (type === 'IDAT') raw = unzlibSync(bytes.subarray(offset + 8, offset + 8 + length));
    offset += 12 + length;
  }
  check(types.join(',') === 'IHDR,IDAT,IEND', 'Complete PNG chunks.');
  const stride = signatureRaster.width * 4 + 1;
  check(raw.length === stride * signatureRaster.height, 'Decoded scanline length.');
  const alpha = (x: number, y: number) => raw[y * stride + 1 + x * 4 + 3];
  check(alpha(50, 80) > 0 && alpha(200, 150) > 0, 'Ink remains at the captured coordinates, scaled exactly 2x.');
  check(alpha(0, 0) === 0 && alpha(999, 359) === 0, 'Blank space remains transparent.');
  check(JSON.stringify(signature) === before, 'Never change stored strokes.');
  check(signaturePng(signature)!.join(',') === bytes.join(','), 'Deterministic signature image.');
});
Deno.test('absent or inkless signatures stay blank; invalid captured evidence is rejected', () => {
  check(signaturePng(undefined) === null && signaturePng([]) === null, 'No typed-name substitute.');
  check(signaturePng([[{ x: 10, y: 10 }]]) === null, 'No fabricated ink.');
  for (const invalid of [[[{ x: NaN, y: 1 }]], [[{ x: 501, y: 10 }]], [[{ x: 10, y: -1 }]], [[]]]) {
    let rejected = false; try { signaturePng(invalid); } catch { rejected = true; }
    check(rejected, 'Invalid evidence must not be exported as a different signature.');
  }
});
