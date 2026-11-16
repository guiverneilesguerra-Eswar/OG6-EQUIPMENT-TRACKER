import { signaturePoint, signatureSpace } from '../services/signatureCanvas.ts';
function equal(actual: unknown, expected: unknown) { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('Canonical coordinates differ'); }
Deno.test('compact, expanded and rotated canvases map to the same stored signature space', () => {
  equal(signatureSpace, { width: 500, height: 180 });
  equal(signaturePoint(125, 90, 250, 180), { x: 250, y: 90 });
  equal(signaturePoint(400, 240, 800, 480), { x: 250, y: 90 });
  equal(signaturePoint(150, 300, 300, 600), { x: 250, y: 90 });
  equal(signaturePoint(500, 180, 500, 180), { x: 500, y: 180 });
});
Deno.test('bad dimensions and out-of-bounds pointers never produce invalid stored points', () => {
  equal(signaturePoint(50, 18, 0, NaN), { x: 50, y: 18 });
  equal(signaturePoint(-10, 500, 250, 200), { x: 0, y: 180 });
  equal(signaturePoint(Infinity, NaN, 250, 200), { x: 0, y: 0 });
});
