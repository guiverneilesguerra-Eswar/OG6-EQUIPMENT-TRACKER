import type { Point } from './tracker';

// All views share the original stored coordinate system. Resizing never changes strokes.
export const signatureSpace = { width: 500, height: 180 };
export function signaturePoint(x: number, y: number, width: number, height: number): Point {
  const dimension = (value: number, fallback: number) => Number.isFinite(value) && value > 0 ? value : fallback;
  return {
    x: Math.max(0, Math.min(signatureSpace.width, (Number.isFinite(x) ? x : 0) * signatureSpace.width / dimension(width, signatureSpace.width))),
    y: Math.max(0, Math.min(signatureSpace.height, (Number.isFinite(y) ? y : 0) * signatureSpace.height / dimension(height, signatureSpace.height))),
  };
}
