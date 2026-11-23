import { emptySignatureFormDrafts, loadSignatureFormDrafts, parseSignatureFormDrafts, saveSignatureFormDrafts } from '../services/signatureFormDrafts.ts';
import type { SignatureFormDrafts } from '../services/signatureFormDrafts.ts';
const ink = () => [[{ x: 20, y: 20 }, { x: 40, y: 30 }, { x: 80, y: 50 }], [{ x: 100, y: 60 }, { x: 150, y: 80 }, { x: 180, y: 70 }]];
function equal(actual: unknown, expected: unknown) { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('Draft values differ'); }
Deno.test('closed and remounted signature drafts retain every stroke, save flag, personnel and selected item', async () => {
  const value: SignatureFormDrafts = { version: 1, withdrawal: {
    requestId: 'TX-DRAFT', source: 'INVENTORY', items: [{ assetId: 'A1', quantity: 1 }], quantityDrafts: { A1: '1' },
    name: '', serial: '', manualNotes: '', manualQuantity: '1', releaser: 'John', receiver: 'Jane', signature: ink(), saved: true,
    withdrawalAt: '2026-11-23T08:00:00.000Z', dueAt: '2026-11-24T08:00:00.000Z', notes: 'Field use',
  }, equipmentReturn: {
    target: 'W1', requestId: 'RET-DRAFT', quantities: { W1: '1' }, returning: 'Jane', receiving: 'John', condition: 'Serviceable', remarks: '',
    receivingSignature: ink(), receivingSignatureSaved: true, releasingSignature: ink(), releasingSignatureSaved: true,
  } };
  await saveSignatureFormDrafts(value); equal(await loadSignatureFormDrafts(), value);
  const reopened = parseSignatureFormDrafts(JSON.parse(JSON.stringify(value)));
  reopened.withdrawal!.signature[0][0].x = 490; equal((await loadSignatureFormDrafts()).withdrawal!.signature, ink());
  const oldWrite = saveSignatureFormDrafts({ ...value, withdrawal: { ...value.withdrawal!, saved: false } });
  const latestWrite = saveSignatureFormDrafts(value); await Promise.all([oldWrite, latestWrite]);
  equal((await loadSignatureFormDrafts()).withdrawal!.saved, true);
  await saveSignatureFormDrafts(emptySignatureFormDrafts()); equal(await loadSignatureFormDrafts(), emptySignatureFormDrafts());
});
Deno.test('invalid draft coordinates are rejected instead of silently replacing original ink', () => {
  let rejected = false;
  try { parseSignatureFormDrafts({ version: 1, withdrawal: { signature: [[{ x: Infinity, y: 20 }]] }, equipmentReturn: null }); } catch { rejected = true; }
  if (!rejected) throw new Error('Invalid drafts must not become empty saved signatures');
});
