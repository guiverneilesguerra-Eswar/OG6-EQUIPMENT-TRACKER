import { assert, assertEquals, assertRejects, assertThrows } from 'jsr:@std/assert';
import ExcelJS from 'exceljs';
import { assertSafeInventoryArchive, buildInventoryImport, countInventoryRows, validateInventoryRows, inventoryImportLimits } from '../services/inventoryImportValidation.ts';
import { createInventoryTemplateWorkbook, createInventoryErrorWorkbook, inventoryCellText, inventoryWorkbookBytes, inventoryWorksheetRows, parseInventoryWorkbook, verifyInventoryArchiveContents } from '../services/inventoryWorkbook.ts';
import type { Asset, TrackerData } from '../services/tracker.ts';

const at = '2026-11-14T10:00:00.000Z';
const asset = (serial: string, archived = false): Asset => ({ id: `AST-${serial}`, name: 'Existing equipment', serial, notes: 'Preserved', createdAt: at, updatedAt: at, ...(archived ? { archivedAt: at } : {}) });
function data(assets: Asset[] = []): TrackerData { return { version: 1, assets, withdrawals: [], activities: [], notices: [], alertKeys: [], settings: { theme: 'dark', notificationVolume: 70, alarmVolume: 80, enabled: true, warningHours: 24, role: 'operator' } }; }
function source(rowNumber: number, serial: string, item = 'Radio', notes = 'Good') { return { rowNumber, item, serial, notes, sourceIssues: [] }; }
function idFactory() { let next = 0; return (prefix: string) => `${prefix}-TEST-${++next}`; }
function preview(rows = [source(2, '000123')], assets: Asset[] = []) { return { filename: 'inventory.xlsx', rows: validateInventoryRows(rows, assets) }; }
function filledWorkbook() { const wb = createInventoryTemplateWorkbook(); wb.getWorksheet('Inventory Import')!.getRow(2).values = ['Radio', '000123', 'Good']; return wb; }

Deno.test('template uses exact worksheet, three headers, two blank rows and text-formatted IDs', async () => {
  const wb = createInventoryTemplateWorkbook(); const bytes = await inventoryWorkbookBytes(wb);
  const loaded = new ExcelJS.Workbook(); await loaded.xlsx.load(bytes);
  const ws = loaded.getWorksheet('Inventory Import')!;
  assert(ws); assert(loaded.getWorksheet('Instructions'));
  assertEquals([1, 2, 3].map(column => ws.getCell(1, column).text), ['Item', 'Serial/Product ID', 'Notes']);
  assertEquals(ws.columnCount, 3); assertEquals(ws.getCell('B2').numFmt, '@'); assertEquals(ws.getCell('B3').numFmt, '@');
  assertEquals(ws.getRow(2).getCell(1).text, '');
  const entries = assertSafeInventoryArchive(bytes); await verifyInventoryArchiveContents(bytes, entries);
});
Deno.test('workbook round-trip preserves text serial leading zeros and ignores wholly empty rows', async () => {
  const result = await parseInventoryWorkbook(await inventoryWorkbookBytes(filledWorkbook()), 'inventory.xlsx', []);
  assertEquals(result.rows.length, 1); assertEquals(result.rows[0].serial, '000123'); assertEquals(result.rows[0].status, 'valid');
});
Deno.test('missing sheet, wrong order, extra headers and empty worksheet fail before saving', () => {
  const missing = new ExcelJS.Workbook(); missing.addWorksheet('Other'); assertThrows(() => inventoryWorksheetRows(missing), Error, 'Missing worksheet');
  const renamed = filledWorkbook(); renamed.getWorksheet('Inventory Import')!.getCell('A1').value = 'Equipment'; assertThrows(() => inventoryWorksheetRows(renamed), Error, 'Invalid column headers');
  const reordered = filledWorkbook(); reordered.getWorksheet('Inventory Import')!.getCell('B1').value = 'Notes'; assertThrows(() => inventoryWorksheetRows(reordered), Error, 'Invalid column headers');
  const extra = filledWorkbook(); extra.getWorksheet('Inventory Import')!.getCell('D1').value = 'Status'; assertThrows(() => inventoryWorksheetRows(extra), Error, 'Extra column');
  assertThrows(() => inventoryWorksheetRows(createInventoryTemplateWorkbook()), Error, 'no populated equipment');
});
Deno.test('mandatory fields, control characters, extra row columns and merged cells are invalid', () => {
  const rows = validateInventoryRows([source(2, '', '', ''), source(3, '001', 'Radio\u0000'), source(4, '002', 'Radio', '')], []);
  assertEquals(countInventoryRows(rows), { total: 3, valid: 0, duplicate: 0, invalid: 3 });
  const wb = filledWorkbook(); wb.getWorksheet('Inventory Import')!.getCell('D2').value = 'OUT';
  assertEquals(validateInventoryRows(inventoryWorksheetRows(wb), [])[0].status, 'invalid');
  const merged = filledWorkbook(); merged.getWorksheet('Inventory Import')!.mergeCells('A2:A3');
  assertEquals(validateInventoryRows(inventoryWorksheetRows(merged), [])[0].status, 'invalid');
});
Deno.test('all in-file repeated IDs and existing/archived IDs are skipped case-insensitively', () => {
  const rows = validateInventoryRows([source(2, ' 00ab '), source(3, '00AB'), source(4, 'OLD'), source(5, 'ARCH'), source(6, '0007')], [asset('old'), asset('arch', true)]);
  assertEquals(countInventoryRows(rows), { total: 5, valid: 1, duplicate: 4, invalid: 0 }); assertEquals(rows[4].serial, '0007');
});
Deno.test('numeric ID zero padding is preserved and unsafe/fractional numeric IDs are rejected', () => {
  const wb = filledWorkbook(); const cell = wb.getWorksheet('Inventory Import')!.getCell('B2'); cell.value = 123; cell.numFmt = '000000';
  assertEquals(inventoryCellText(cell, 'Serial/Product ID').text, '000123');
  cell.value = 1234567890123456; assert(inventoryCellText(cell, 'Serial/Product ID').issues.length > 0);
  cell.value = 1.25; assert(inventoryCellText(cell, 'Serial/Product ID').issues.length > 0);
  cell.value = 123; cell.numFmt = '0.00E+00'; assert(inventoryCellText(cell, 'Serial/Product ID').issues.length > 0);
});
Deno.test('formula, shared formula, hyperlink and Excel error cells are rejected without evaluating', () => {
  const wb = filledWorkbook(); const ws = wb.getWorksheet('Inventory Import')!;
  ws.getCell('A2').value = { formula: '1+1', result: 2 };
  assertEquals(validateInventoryRows(inventoryWorksheetRows(wb), [])[0].status, 'invalid');
  ws.getCell('A2').value = 'Radio'; ws.getCell('B2').value = { sharedFormula: 'B1', result: '123' };
  assert(inventoryCellText(ws.getCell('B2'), 'Serial/Product ID').issues.length > 0);
  ws.getCell('B2').value = { text: '000123', hyperlink: 'https://example.invalid/' }; assert(inventoryCellText(ws.getCell('B2'), 'Serial/Product ID').issues.length > 0);
  ws.getCell('B2').value = { error: '#VALUE!' }; assert(inventoryCellText(ws.getCell('B2'), 'Serial/Product ID').issues.length > 0);
});
Deno.test('error workbook keeps rejected original row numbers and formula-looking strings as text', async () => {
  const rows = validateInventoryRows([source(8, '=HYPERLINK("bad")', '+CMD', '')], []);
  const wb = createInventoryErrorWorkbook({ batchId: 'IMP-test', filename: '=source.xlsx', at, imported: 0, duplicatesSkipped: 0, invalidRows: 1, totalProcessed: 1, rows, alreadyCompleted: false });
  const loaded = new ExcelJS.Workbook(); await loaded.xlsx.load(await inventoryWorkbookBytes(wb)); const ws = loaded.getWorksheet('Rejected Rows')!;
  assertEquals(ws.getCell('A2').value, '8'); assertEquals(ws.getCell('B2').value, '+CMD'); assertEquals(ws.getCell('C2').value, '=HYPERLINK("bad")');
  assertEquals(ws.getCell('C2').type, ExcelJS.ValueType.String); assertEquals(ws.getCell('C2').numFmt, '@');
});
Deno.test('corrupt/oversized XLSX archives, unsafe names and dishonest expanded sizes are rejected', async () => {
  assertThrows(() => assertSafeInventoryArchive(new Uint8Array(100)), Error, 'supported Excel');
  assertThrows(() => assertSafeInventoryArchive(new Uint8Array(inventoryImportLimits.fileBytes + 1)), Error, '5 MB');
  const bytes = await inventoryWorkbookBytes(filledWorkbook()); const entries = assertSafeInventoryArchive(bytes);
  const dishonest = entries.map((entry, index) => index === 0 ? { ...entry, uncompressed: 0 } : entry);
  await assertRejects(() => verifyInventoryArchiveContents(bytes, dishonest), Error);
  const badBytes = bytes.slice(); const marker = Array.from('[Content_Types].xml').map(char => char.charCodeAt(0));
  // Replace an archive entry name in both headers with a same-length traversal name.
  for (let i = 0; i < badBytes.length - marker.length; i++) if (marker.every((byte, index) => badBytes[i + index] === byte)) { badBytes[i] = 46; badBytes[i + 1] = 46; }
  assertThrows(() => assertSafeInventoryArchive(badBytes), Error, 'unsafe archive');
});
Deno.test('500-row batch assigns unique IDs and current timestamps without touching withdrawals/history/settings', async () => {
  const original = data([asset('existing')]);
  original.withdrawals.push({ id: 'WD-existing', assetId: 'AST-existing', releaser: 'A', receiver: 'B', signature: [[{ x: 1, y: 2 }, { x: 2, y: 3 }, { x: 3, y: 4 }]], withdrawalAt: at, dueAt: '2026-12-14T10:00:00.000Z', createdAt: at, notes: 'Preserve me' });
  const before = JSON.stringify(original); const wb = createInventoryTemplateWorkbook();
  for (let index = 0; index < 500; index++) wb.getWorksheet('Inventory Import')!.getRow(index + 2).values = [`Radio ${index}`, String(index).padStart(8, '0'), 'Good'];
  const parsed = await parseInventoryWorkbook(await inventoryWorkbookBytes(wb), 'bulk.xlsx', original.assets);
  const batch = buildInventoryImport(original, parsed, 'IMP-500', at, idFactory());
  assertEquals(batch.result.imported, 500); assertEquals(batch.next.assets.length, 501); assertEquals(new Set(batch.next.assets.map(item => item.id)).size, 501);
  assertEquals(batch.next.withdrawals, original.withdrawals); assertEquals(batch.next.settings, original.settings); assertEquals(batch.next.notices, original.notices); assertEquals(JSON.stringify(original), before);
  assert(batch.next.assets.slice(0, 500).every(item => item.createdAt === at && item.updatedAt === at && !item.archivedAt && !batch.next.withdrawals.some(w => w.assetId === item.id)));
  assertEquals(batch.next.activities.length, 500); assertEquals(batch.next.inventoryImports![0].importedAssetIds.length, 500);
});
Deno.test('confirmation rechecks latest inventory, skips new conflicts and never overwrites', () => {
  const p = preview([source(2, '0001'), source(3, '0002')]); const original = data([asset('0001')]);
  const batch = buildInventoryImport(original, p, 'IMP-race', at, idFactory());
  assertEquals(batch.result.imported, 1); assertEquals(batch.result.duplicatesSkipped, 1); assertEquals(batch.next.assets.find(a => a.serial === '0001'), original.assets[0]);
  assertThrows(() => buildInventoryImport(data([asset('0001'), asset('0002')]), p, 'IMP-none', at, idFactory()), Error, 'No valid records remain');
});
Deno.test('same saved batch is idempotent, even if confirmation is retried', () => {
  const p = preview(); const first = buildInventoryImport(data(), p, 'IMP-retry', at, idFactory());
  const retry = buildInventoryImport(first.next, p, 'IMP-retry', '2026-11-15T00:00:00.000Z', idFactory());
  assertEquals(retry.next, first.next); assertEquals(retry.result.imported, 1); assertEquals(retry.result.alreadyCompleted, true); assertEquals(retry.result.at, at);
});
Deno.test('rejected preview rows never become imports and ID allocation failures leave the original intact', () => {
  const original = data(); const invalid = preview([source(2, '0001', '', ''), source(3, '0002')]);
  const batch = buildInventoryImport(original, invalid, 'IMP-valid-only', at, idFactory()); assertEquals(batch.result.imported, 1); assertEquals(batch.result.invalidRows, 1);
  const collisionData = data([asset('AST-collision')]); const before = JSON.stringify(collisionData);
  assertThrows(() => buildInventoryImport(collisionData, preview(), 'IMP-collision', at, () => 'AST-AST-collision'), Error, 'unique'); assertEquals(JSON.stringify(collisionData), before);
});
Deno.test('excessive worksheet dimensions and field lengths are rejected', () => {
  const workbook = filledWorkbook(); workbook.getWorksheet('Inventory Import')!.getCell('A5002').value = 'Beyond the row limit';
  assertThrows(() => inventoryWorksheetRows(workbook), Error, '5,000 rows');
  const rows = validateInventoryRows([source(2, 'ID', 'X'.repeat(201)), source(3, 'Y'.repeat(201)), source(4, 'OK', 'Radio', 'N'.repeat(10001))], []);
  assertEquals(countInventoryRows(rows).invalid, 3);
});
Deno.test('failed single-snapshot persistence does not publish any batch or mutate existing records', async () => {
  const original = data([asset('existing')]); const before = JSON.stringify(original); let published = original; let writes = 0;
  await assertRejects(async () => {
    const batch = buildInventoryImport(original, preview(), 'IMP-write-failure', at, idFactory());
    const save = (_snapshot: TrackerData) => { writes++; return Promise.reject(new Error('Storage quota exceeded')); };
    await save(batch.next); published = batch.next;
  }, Error, 'Storage quota');
  assertEquals(writes, 1); assertEquals(published, original); assertEquals(JSON.stringify(original), before);
});
