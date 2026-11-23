import type { Point, Signature } from './tracker';

// All views share the original stored coordinate system. Resizing never changes strokes.
export const signatureSpace = { width: 500, height: 180 };
export const signatureInkWidth = 2.4;
export function copySignature(value: Signature): Signature {
  return value.map(stroke => stroke.map(point => ({ ...point })));
}
// Uniform contain transform matches the SVG viewBox; ink is never stretched.
export function signatureViewport(width: number, height: number) {
  const w = Number.isFinite(width) && width > 0 ? width : signatureSpace.width;
  const h = Number.isFinite(height) && height > 0 ? height : signatureSpace.height;
  const scale = Math.max(0.001, Math.min(w / signatureSpace.width, h / signatureSpace.height));
  return { scale, left: (w - signatureSpace.width * scale) / 2, top: (h - signatureSpace.height * scale) / 2 };
}
export function containedSignaturePoint(x: number, y: number, width: number, height: number): Point {
  const fit = signatureViewport(width, height);
  return signaturePoint((x - fit.left) / fit.scale, (y - fit.top) / fit.scale, signatureSpace.width, signatureSpace.height);
}
export interface SignatureSession { strokes: Signature; pointerId: number | null }
export function createSignatureSession(value: Signature): SignatureSession { return { strokes: copySignature(value), pointerId: null }; }
export function beginSignatureStroke(session: SignatureSession, pointerId: number, point: Point): boolean {
  if (session.pointerId !== null) return false;
  session.pointerId = pointerId; session.strokes.push([{ ...point }]); return true;
}
export function moveSignatureStroke(session: SignatureSession, pointerId: number, point: Point): boolean {
  if (session.pointerId !== pointerId) return false;
  const stroke = session.strokes[session.strokes.length - 1]; const last = stroke?.[stroke.length - 1];
  if (!last || Math.hypot(last.x - point.x, last.y - point.y) < 0.15) return false;
  // One midpoint retains short fast pen strokes and continuous straight segments.
  stroke.push({ x: (last.x + point.x) / 2, y: (last.y + point.y) / 2 }, { ...point }); return true;
}
export function endSignatureStroke(session: SignatureSession, pointerId: number): boolean {
  if (session.pointerId !== pointerId) return false;
  // Pointer-up/cancel/leave never remove any completed or partial strokes.
  session.pointerId = null; return true;
}
export function signaturePath(stroke: Point[]): string {
  return stroke.filter(p => Number.isFinite(p.x) && Number.isFinite(p.y)).map((point, index) => `${index ? 'L' : 'M'}${point.x},${point.y}`).join(' ');
}
export function signaturePoint(x: number, y: number, width: number, height: number): Point {
  const dimension = (value: number, fallback: number) => Number.isFinite(value) && value > 0 ? value : fallback;
  return {
    x: Math.max(0, Math.min(signatureSpace.width, (Number.isFinite(x) ? x : 0) * signatureSpace.width / dimension(width, signatureSpace.width))),
    y: Math.max(0, Math.min(signatureSpace.height, (Number.isFinite(y) ? y : 0) * signatureSpace.height / dimension(height, signatureSpace.height))),
  };
}
