import { zlibSync } from 'fflate';
import type { Signature } from './tracker';
import { signatureRaster as config } from '../constants/report';

// Rasterize actual stored pen strokes. No canvas, screenshot, typed-name image,
// browser APIs, remote media, or platform-specific native dependency is involved.
export function signaturePng(signature: Signature | undefined): Uint8Array | null {
  if (signature == null || (Array.isArray(signature) && signature.length === 0)) return null;
  if (!Array.isArray(signature) || signature.length > config.maxStrokes) throw new Error('The captured signature is invalid.');
  let points = 0; let hasInk = false; let samples = 0;
  const pixels = new Uint8Array(config.width * config.height * 4);
  const scale = config.width / config.sourceWidth;
  const radius = config.strokeWidth * scale / 2;
  const stamp = (x: number, y: number) => {
    for (let py = Math.max(0, Math.floor(y - radius - 1)); py <= Math.min(config.height - 1, Math.ceil(y + radius + 1)); py++) {
      for (let px = Math.max(0, Math.floor(x - radius - 1)); px <= Math.min(config.width - 1, Math.ceil(x + radius + 1)); px++) {
        const coverage = Math.max(0, Math.min(1, radius + 0.5 - Math.hypot(px + 0.5 - x, py + 0.5 - y)));
        const offset = (py * config.width + px) * 4 + 3;
        pixels[offset] = Math.max(pixels[offset], Math.round(coverage * 255));
      }
    }
  };
  for (const stroke of signature) {
    if (!Array.isArray(stroke) || !stroke.length) throw new Error('The captured signature has an invalid stroke.');
    points += stroke.length;
    if (points > config.maxPoints) throw new Error('The captured signature exceeds the supported size.');
    for (const point of stroke) {
      if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < 0 || point.x > config.sourceWidth || point.y < 0 || point.y > config.sourceHeight) throw new Error('The captured signature has invalid coordinates.');
    }
    for (let index = 1; index < stroke.length; index++) {
      const a = stroke[index - 1], b = stroke[index];
      const dx = (b.x - a.x) * scale, dy = (b.y - a.y) * scale;
      if (dx === 0 && dy === 0) continue;
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
      samples += steps + 1;
      if (samples > config.maxSamples) throw new Error('The captured signature is too complex to export safely.');
      for (let step = 0; step <= steps; step++) stamp(a.x * scale + dx * step / steps, a.y * scale + dy * step / steps);
      hasInk = true;
    }
  }
  if (!hasInk) return null;
  const stride = config.width * 4;
  const scanlines = new Uint8Array((stride + 1) * config.height);
  for (let row = 0; row < config.height; row++) scanlines.set(pixels.subarray(row * stride, (row + 1) * stride), row * (stride + 1) + 1);
  const header = new Uint8Array(13); const view = new DataView(header.buffer);
  view.setUint32(0, config.width); view.setUint32(4, config.height); header[8] = 8; header[9] = 6;
  const chunks = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk('IHDR', header), pngChunk('IDAT', zlibSync(scanlines)), pngChunk('IEND', new Uint8Array(0))];
  const result = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let offset = 0; for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}
function pngChunk(type: string, payload: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(payload.length + 12); const view = new DataView(chunk.buffer);
  view.setUint32(0, payload.length);
  for (let index = 0; index < 4; index++) chunk[4 + index] = type.charCodeAt(index);
  chunk.set(payload, 8);
  let crc = 0xffffffff;
  for (const byte of chunk.subarray(4, chunk.length - 4)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  view.setUint32(chunk.length - 4, (crc ^ 0xffffffff) >>> 0);
  return chunk;
}
