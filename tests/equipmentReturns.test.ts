import { buildEquipmentReturn } from '../services/equipmentReturns.ts';
import type { ReturnInput } from '../services/equipmentReturns.ts';
import type { Withdrawal } from '../services/tracker.ts';
const check = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
const signature = [[{ x: 10, y: 20 }, { x: 40, y: 60 }, { x: 90, y: 80 }]];
const withdrawal: Withdrawal = { id: 'WD-1', assetId: 'AST-1', receiver: 'Original receiver', releaser: 'Releaser', signature,
  withdrawalAt: '2026-11-14T08:00:00Z', dueAt: '2026-11-15T08:00:00Z', createdAt: '2026-11-14T08:00:00Z', notes: 'Exercise' };
const at = '2026-11-15T07:30:00.456Z';
const input: ReturnInput = { returning: ' Returning person ', receiving: ' Receiving person ', condition: ' Good ', remarks: ' Complete ', receivingSignature: signature };
function rejects(action: () => unknown) { let failed = false; try { action(); } catch { failed = true; } check(failed, 'Expected validation failure.'); }
Deno.test('return persists separate receiver evidence and actual event timestamp without modifying withdrawal', () => {
  const before = JSON.stringify(withdrawal); const inputBefore = JSON.stringify(input);
  const returned = buildEquipmentReturn(withdrawal, input, at);
  check(returned.receiving === 'Receiving person', 'Receiving personnel must be trimmed.');
  check(returned.returnedAt === at && returned.receivingSignatureAt === at && returned.alarmAcknowledgedAt === at, 'Event timestamps must match.');
  check(returned.signature === withdrawal.signature && returned.receiver === withdrawal.receiver, 'Original withdrawal evidence must be retained.');
  check(JSON.stringify(returned.receivingSignature) === JSON.stringify(signature), 'Return signature must persist.');
  check(returned.receivingSignature !== signature && returned.receivingSignature![0][0] !== signature[0][0], 'Copy signature points to prevent input mutation.');
  check(JSON.stringify(withdrawal) === before && JSON.stringify(input) === inputBefore, 'No input changes.');
  check(JSON.parse(JSON.stringify(returned)).receivingSignatureAt === at, 'Signature survives local JSON persistence.');
});
Deno.test('invalid signatures, missing fields and inactive transactions never complete a return', () => {
  const before = JSON.stringify(withdrawal);
  rejects(() => buildEquipmentReturn(withdrawal, { ...input, receivingSignature: [] }, at));
  rejects(() => buildEquipmentReturn(withdrawal, { ...input, receivingSignature: [[{ x: 2, y: 3 }]] }, at));
  rejects(() => buildEquipmentReturn(withdrawal, { ...input, receivingSignature: [[{ x: NaN, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }]] }, at));
  rejects(() => buildEquipmentReturn(withdrawal, { ...input, receivingSignature: [[{ x: 501, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }]] }, at));
  rejects(() => buildEquipmentReturn(withdrawal, { ...input, receiving: ' ' }, at));
  rejects(() => buildEquipmentReturn(withdrawal, { ...input, returning: ' ' }, at));
  rejects(() => buildEquipmentReturn(withdrawal, { ...input, condition: ' ' }, at));
  rejects(() => buildEquipmentReturn({ ...withdrawal, returnedAt: at }, input, at));
  rejects(() => buildEquipmentReturn({ ...withdrawal, deletedAt: at }, input, at));
  rejects(() => buildEquipmentReturn(undefined, input, at));
  check(JSON.stringify(withdrawal) === before, 'Failed validation must leave existing record intact.');
});
