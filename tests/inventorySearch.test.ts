import { inventorySerialMatches, readScannedInventorySerial, searchInventoryAssets } from '../services/inventorySearch.ts';

function equal(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
}
function rejects(value: unknown) {
  let rejected = false;
  try { readScannedInventorySerial(value); } catch { rejected = true; }
  if (!rejected) throw new Error('Expected invalid scan payload to be rejected.');
}
const assets = [
  { id: 'a', name: 'Radio', serial: '000123', notes: 'Available' },
  { id: 'b', name: '000123 label printer', serial: '123', notes: '000123 reference' },
  { id: 'c', name: 'Handset', serial: 'AbC-09', notes: 'Assigned' },
  { id: 'd', name: 'Archived radio', serial: '000123', notes: 'History preserved', archivedAt: '2026-11-14T00:00:00Z' },
];

Deno.test('scan payloads stay text and preserve leading zeros', () => {
  equal(readScannedInventorySerial(' 000123 '), '000123');
  equal(readScannedInventorySerial('00123456789012345678901234567890'), '00123456789012345678901234567890');
  equal(inventorySerialMatches('000123', '123'), false);
  equal(inventorySerialMatches(' AbC-09 ', 'abc-09'), true);
});
Deno.test('scanned search matches complete serial only, not equipment names or notes', () => {
  equal(searchInventoryAssets(assets, '000123', true).map(asset => asset.id), ['a']);
  equal(searchInventoryAssets(assets, '123', true).map(asset => asset.id), ['b']);
  equal(searchInventoryAssets(assets, 'ABC-09', true).map(asset => asset.id), ['c']);
  equal(searchInventoryAssets(assets, '000', true), []);
});
Deno.test('unmatched scans do not fall back to fuzzy lookup or register equipment', () => {
  const snapshot = JSON.stringify(assets);
  equal(searchInventoryAssets(assets, 'UNKNOWN', true), []);
  equal(searchInventoryAssets(assets, 'Radio', true), []);
  equal(JSON.stringify(assets), snapshot);
});
Deno.test('normal typed search still searches names, serials and notes and omits archives', () => {
  equal(searchInventoryAssets(assets, '000123').map(asset => asset.id), ['a', 'b']);
  equal(searchInventoryAssets(assets, 'assigned').map(asset => asset.id), ['c']);
  equal(searchInventoryAssets(assets, '').map(asset => asset.id), ['a', 'b', 'c']);
});
Deno.test('empty, numeric, oversized and control-character payloads are rejected', () => {
  for (const value of ['', '  ', null, undefined, 123, {}, 'x'.repeat(4097), 'ABC\u0000DEF', 'AB\nCD']) rejects(value);
});
Deno.test('international and punctuation-heavy serials stay literal text', () => {
  const international = [{ id: 'unicode', name: 'Radio', serial: 'ÉQ/001-通信', notes: 'Existing record' }];
  equal(readScannedInventorySerial(' ÉQ/001-通信 '), 'ÉQ/001-通信');
  equal(searchInventoryAssets(international, 'éq/001-通信', true).map(asset => asset.id), ['unicode']);
  equal(searchInventoryAssets(international, '001', true), []);
});
Deno.test('archived-only matches stay hidden without altering historical records', () => {
  const archived = assets.filter(asset => Boolean(asset.archivedAt));
  const snapshot = JSON.stringify(archived);
  equal(searchInventoryAssets(archived, '000123', true), []);
  equal(JSON.stringify(archived), snapshot);
});
Deno.test('QR URLs, JSON and command-like content remain literal serial text', () => {
  for (const value of ['https://example.org/000123', '{"serial":"000123"}', '=1+1', 'onspaceapp://inventory/000123']) {
    equal(readScannedInventorySerial(value), value);
    equal(searchInventoryAssets(assets, value, true), []);
  }
});
