import { signaturePoint, signatureSpace, signatureViewport, containedSignaturePoint, createSignatureSession, beginSignatureStroke, moveSignatureStroke, endSignatureStroke, copySignature, signaturePath } from '../services/signatureCanvas.ts';
function equal(actual: unknown, expected: unknown) { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('Canonical coordinates differ'); }
Deno.test('compact, expanded and rotated canvases map to the same stored signature space', () => {
  equal(signatureSpace, { width: 500, height: 180 });
  equal(signaturePoint(125, 90, 250, 180), { x: 250, y: 90 });
  equal(signaturePoint(400, 240, 800, 480), { x: 250, y: 90 });
  equal(signaturePoint(150, 300, 300, 600), { x: 250, y: 90 });
  equal(signaturePoint(500, 180, 500, 180), { x: 500, y: 180 });
});
Deno.test('pen-up and repeated separated finger/mouse/pen strokes never erase preceding ink', () => {
  const initial = [[{ x: 10, y: 20 }, { x: 20, y: 30 }, { x: 30, y: 40 }]];
  const session = createSignatureSession(initial);
  for (const pointerId of [1, 6, 17, 100]) {
    const before = copySignature(session.strokes); const count = before.length;
    equal(beginSignatureStroke(session, pointerId, { x: 100, y: 40 }), true);
    equal(beginSignatureStroke(session, pointerId + 1, { x: 300, y: 90 }), false);
    equal(moveSignatureStroke(session, pointerId + 1, { x: 350, y: 110 }), false);
    equal(moveSignatureStroke(session, pointerId, { x: 120, y: 50 }), true);
    equal(moveSignatureStroke(session, pointerId, { x: 150, y: 70 }), true);
    equal(endSignatureStroke(session, pointerId), true); equal(session.pointerId, null);
    equal(session.strokes.slice(0, count), before); equal(session.strokes.length, count + 1);
    equal(endSignatureStroke(session, pointerId), false);
    const saved = JSON.stringify(session.strokes); equal(JSON.stringify(copySignature(session.strokes)), saved);
  }
  equal(initial, [[{ x: 10, y: 20 }, { x: 20, y: 30 }, { x: 30, y: 40 }]]);
  const reopened = createSignatureSession(JSON.parse(JSON.stringify(session.strokes)));
  equal(reopened.strokes, session.strokes); equal(signaturePath(reopened.strokes[1]).includes('L'), true);
});
Deno.test('compact/expanded/rotated contain geometry preserves proportions and original vector coordinates', () => {
  const p = { x: 175, y: 110 };
  for (const [width, height] of [[280, 180], [375, 560], [920, 260], [600, 120]]) {
    const fit = signatureViewport(width, height);
    const mapped = containedSignaturePoint(fit.left + p.x * fit.scale, fit.top + p.y * fit.scale, width, height);
    if (Math.abs(mapped.x - p.x) > 0.0001 || Math.abs(mapped.y - p.y) > 0.0001) throw new Error('Resizing distorted ink');
  }
});
Deno.test('cancellation retains incomplete strokes and accepts a fresh pointer without joining distinct strokes', () => {
  const session = createSignatureSession([]);
  beginSignatureStroke(session, 7, { x: 40, y: 40 }); moveSignatureStroke(session, 7, { x: 80, y: 80 });
  endSignatureStroke(session, 7); const first = copySignature(session.strokes);
  beginSignatureStroke(session, 8, { x: 300, y: 100 }); moveSignatureStroke(session, 8, { x: 350, y: 120 }); endSignatureStroke(session, 8);
  equal(session.strokes[0], first[0]); equal(session.strokes[1][0], { x: 300, y: 100 });
});
Deno.test('bad dimensions and out-of-bounds pointers never produce invalid stored points', () => {
  equal(signaturePoint(50, 18, 0, NaN), { x: 50, y: 18 });
  equal(signaturePoint(-10, 500, 250, 200), { x: 0, y: 180 });
  equal(signaturePoint(Infinity, NaN, 250, 200), { x: 0, y: 0 });
});
