import ExcelJS from 'exceljs';
import { Inflate } from 'fflate';
import { inventoryImportHeaders, inventoryImportLimits, InventorySourceRow, InventoryImportPreview, InventoryImportResult, InventoryZipEntry, assertSafeInventoryArchive, validateInventoryRows } from './inventoryImportValidation';
import type { Asset } from './tracker';

export type InventoryImportProgress = (fraction: number, label: string) => void;
const yieldToUI = () => new Promise<void>(resolve => setTimeout(resolve, 0));
export function inventoryCellText(cell: ExcelJS.Cell, label: string): { text: string; issues: string[] } {
  const value = cell.value;
  if (value === null || value === undefined) return { text: '', issues: [] };
  if (cell.type === ExcelJS.ValueType.Formula || (typeof value === 'object' && ('formula' in value || 'sharedFormula' in value))) return { text: '', issues: [`${label}: formulas are not allowed; paste values as text.`] };
  if (typeof value === 'string') return { text: value, issues: [] };
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return { text: '', issues: [`${label}: invalid numeric value.`] };
    if (label === 'Serial/Product ID') {
      if (!Number.isSafeInteger(value) || value < 0 || value >= 1000000000000000) return { text: String(value), issues: ['Serial/Product ID: numeric value may have lost precision. Re-enter the original ID as text.'] };
      const format = cell.numFmt || 'General';
      if (/^0+$/.test(format) && format.length <= inventoryImportLimits.serial) return { text: String(value).padStart(format.length, '0'), issues: [] };
      if (!['General', '@'].includes(format)) return { text: String(value), issues: ['Serial/Product ID: unsupported number format. Re-enter the original ID as text.'] };
    }
    return { text: String(value), issues: [] };
  }
  if (typeof value === 'object' && 'richText' in value) return { text: value.richText.map(part => part.text).join(''), issues: [] };
  if (typeof value === 'object' && 'hyperlink' in value) return { text: value.text || '', issues: [`${label}: hyperlinks are not allowed; paste plain text.`] };
  return { text: '', issues: [`${label}: unsupported cell type. Use plain text.`] };
}
export function inventoryWorksheetRows(workbook: ExcelJS.Workbook): InventorySourceRow[] {
  const sheet = workbook.getWorksheet('Inventory Import');
  if (!sheet) throw new Error('Missing worksheet "Inventory Import". Use the official template without renaming the sheet.');
  if (sheet.rowCount > inventoryImportLimits.rows + 1 || sheet.columnCount > inventoryImportLimits.columns) throw new Error('The worksheet exceeds the limit of 5,000 rows or contains excessive unused columns. Remove unused formatting or split the file.');
  for (let column = 1; column <= 3; column++) {
    const header = inventoryCellText(sheet.getCell(1, column), 'Header');
    if (header.issues.length || header.text.trim() !== inventoryImportHeaders[column - 1]) throw new Error('Invalid column headers. Row 1 must contain exactly: Item | Serial/Product ID | Notes, in that order.');
  }
  for (let column = 4; column <= sheet.columnCount; column++) if (sheet.getCell(1, column).value !== null && sheet.getCell(1, column).value !== undefined && sheet.getCell(1, column).value !== '') throw new Error('Extra column headers are not allowed. Use exactly Item, Serial/Product ID, and Notes.');
  const rows: InventorySourceRow[] = []; let characters = 0;
  for (let number = 2; number <= sheet.rowCount; number++) {
    const row = sheet.getRow(number);
    let populated = false;
    for (let column = 1; column <= Math.max(3, sheet.columnCount); column++) {
      const value = row.getCell(column).value;
      if (value !== null && value !== undefined && (typeof value !== 'string' || value.trim() !== '')) { populated = true; break; }
    }
    if (!populated) continue;
    const item = inventoryCellText(row.getCell(1), 'Item'), serial = inventoryCellText(row.getCell(2), 'Serial/Product ID'), notes = inventoryCellText(row.getCell(3), 'Notes');
    const sourceIssues = [...item.issues, ...serial.issues, ...notes.issues];
    if ([1, 2, 3].some(column => row.getCell(column).isMerged)) sourceIssues.push('Merged data cells are not supported. Use one equipment unit per unmerged row.');
    for (let column = 4; column <= sheet.columnCount; column++) { const value = row.getCell(column).value; if (value !== null && value !== undefined && value !== '') { sourceIssues.push('Unexpected data outside the three template columns.'); break; } }
    characters += item.text.length + serial.text.length + notes.text.length;
    if (characters > inventoryImportLimits.textCharacters) throw new Error('The worksheet contains too much text for a safe mobile import. Split it into smaller files.');
    rows.push({ rowNumber: number, item: item.text, serial: serial.text, notes: notes.text, sourceIssues });
  }
  if (!rows.length) throw new Error('The Inventory Import worksheet has no populated equipment rows. Fill all three fields starting at row 2.');
  return rows;
}
export async function verifyInventoryArchiveContents(bytes: Uint8Array, entries: InventoryZipEntry[]) {
  let total = 0;
  for (const entry of entries) {
    let actual = 0;
    const acceptChunk = (chunk: Uint8Array) => {
      actual += chunk.length; total += chunk.length;
      // Validate ACTUAL inflated size, not just untrusted ZIP metadata.
      if (actual > entry.uncompressed || actual > 16 * 1024 * 1024 || total > inventoryImportLimits.expandedBytes) throw new Error('The workbook exceeds its declared or safe expanded size. Use the official template.');
    };
    if (entry.method === 0) acceptChunk(bytes.subarray(entry.start, entry.start + entry.compressed));
    else {
      const inflater = new Inflate(acceptChunk);
      try {
        for (let offset = 0; offset < entry.compressed; offset += 8192) {
          const end = Math.min(entry.compressed, offset + 8192);
          inflater.push(bytes.subarray(entry.start + offset, entry.start + end), end === entry.compressed);
          if (offset > 0 && offset % 65536 === 0) await yieldToUI();
        }
      } catch { throw new Error('The workbook contains damaged or unsafe compressed data. Use a new copy of the official template.'); }
    }
    if (actual !== entry.uncompressed) throw new Error('The workbook archive has invalid size information. Save a new .xlsx copy.');
  }
}
export async function parseInventoryWorkbook(bytes: Uint8Array, filename: string, assets: readonly Asset[], progress?: InventoryImportProgress): Promise<InventoryImportPreview> {
  const entries = assertSafeInventoryArchive(bytes);
  progress?.(0.25, 'Checking workbook file safety'); await yieldToUI();
  await verifyInventoryArchiveContents(bytes, entries);
  progress?.(0.35, 'Reading Inventory Import worksheet'); await yieldToUI();
  const workbook = new ExcelJS.Workbook();
  try { await workbook.xlsx.load(bytes as unknown as Parameters<typeof workbook.xlsx.load>[0]); }
  catch { throw new Error('Unable to read this Excel workbook. It may be damaged or password-protected. Save a new .xlsx copy using the official template.'); }
  progress?.(0.65, 'Validating required fields and Serial/Product IDs'); await yieldToUI();
  const rows = inventoryWorksheetRows(workbook);
  progress?.(0.85, `Checking ${rows.length.toLocaleString('en-US')} inventory rows`); await yieldToUI();
  const checked = validateInventoryRows(rows, assets);
  progress?.(1, 'Preview ready');
  return { filename, rows: checked };
}
const excelColors = { navy: 'FF041C30', blue: 'FF0078D9', white: 'FFFFFFFF', green: 'FF147D43', red: 'FFB42337' };
function styleWorkbookSheet(sheet: ExcelJS.Worksheet, headers: readonly string[]) {
  sheet.addRow([...headers]); sheet.getRow(1).height = 28;
  sheet.getRow(1).eachCell(cell => { cell.font = { bold: true, color: { argb: excelColors.white } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: excelColors.blue } }; cell.alignment = { vertical: 'middle', wrapText: true }; });
  sheet.columns.forEach(column => { column.numFmt = '@'; });
}
export function createInventoryTemplateWorkbook(): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook(); workbook.creator = 'OG6 EQUIPMENT TRACKER'; workbook.created = new Date();
  const sheet = workbook.addWorksheet('Inventory Import', { views: [{ state: 'frozen', ySplit: 1 }] });
  styleWorkbookSheet(sheet, inventoryImportHeaders);
  sheet.getColumn(1).width = 32; sheet.getColumn(2).width = 28; sheet.getColumn(3).width = 58;
  sheet.getColumn(2).numFmt = '@'; sheet.getColumn(3).alignment = { wrapText: true, vertical: 'top' };
  sheet.addRow(['', '', '']); sheet.addRow(['', '', '']);
  sheet.getCell('B1').note = 'Serial/Product IDs must be text. Keep leading zeros and use a unique ID for every unit.';
  sheet.autoFilter = 'A1:C3';
  const instructions = workbook.addWorksheet('Instructions');
  instructions.addRow(['OG6 EQUIPMENT TRACKER — INVENTORY IMPORT GUIDE', '']);
  instructions.getCell('A1').font = { bold: true, color: { argb: excelColors.white } }; instructions.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: excelColors.navy } };
  instructions.addRow(['Step', 'Instructions']);
  const steps = [
    'Open the Inventory Import sheet.',
    'Enter one equipment unit per row, starting at row 2.',
    'Fill all three required fields: Item, Serial/Product ID, and Notes.',
    'Keep Serial/Product ID unique; retain leading zeros. The template formats this column as text.',
    'Do not rename columns or change their order.',
    'Do not enter status; new items start as IN after successful import.',
    'Save as .xlsx and upload using Inventory > Import Excel.',
    'Review validation results before confirming import.',
    'All occurrences of repeated Serial/Product IDs are rejected. Existing and archived inventory IDs are also rejected; matching is case-insensitive and ignores outer spaces.',
    'Paste values only. Formula cells, hyperlinks, macros and external workbook links are not accepted. IDs already rounded by Excel cannot be recovered.',
    'Use at most 5,000 data rows and a file no larger than 5 MB. Item and ID: 200 characters each; Notes: 10,000 characters. Remove unused formatting.',
    'After confirmation, only valid rows are saved to the existing device-local inventory. Existing records are never overwritten. Download the error report to correct and re-upload rejected rows.',
  ];
  steps.forEach((text, index) => instructions.addRow([String(index + 1), text]));
  instructions.getColumn(1).width = 16; instructions.getColumn(2).width = 100;
  instructions.getColumn(2).alignment = { wrapText: true, vertical: 'top' };
  instructions.eachRow((row, number) => { if (number > 2) row.height = number > 10 ? 48 : 32; });
  instructions.getRow(1).height = 30;
  return workbook;
}
export function createInventoryErrorWorkbook(result: InventoryImportResult): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook(); workbook.creator = 'OG6 EQUIPMENT TRACKER'; workbook.created = new Date();
  const sheet = workbook.addWorksheet('Rejected Rows', { views: [{ state: 'frozen', ySplit: 1 }] });
  styleWorkbookSheet(sheet, ['Excel Row', ...inventoryImportHeaders, 'Validation Result', 'Reason']);
  result.rows.filter(row => row.status !== 'valid').forEach(row => {
    // Explicit string values prevent formula injection, including strings beginning with =, +, - or @.
    const added = sheet.addRow([String(row.rowNumber), row.item, row.serial, row.notes, row.status.toUpperCase(), row.reasons.join(' ')]);
    added.eachCell(cell => { cell.numFmt = '@'; cell.alignment = { wrapText: true, vertical: 'top' }; });
    added.getCell(5).font = { bold: true, color: { argb: excelColors.red } };
  });
  [12, 32, 28, 52, 22, 76].forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, sheet.rowCount), column: 6 } };
  const summary = workbook.addWorksheet('Import Summary');
  summary.addRows([['Batch Reference', result.batchId], ['Source File', result.filename], ['Import Timestamp (UTC)', result.at], ['Successfully Imported', String(result.imported)], ['Duplicates Skipped', String(result.duplicatesSkipped)], ['Invalid Rows', String(result.invalidRows)], ['Total Processed', String(result.totalProcessed)], ['Next Step', 'Copy corrected rows into the official Inventory Import template and upload again. Do not upload this error report.']]);
  summary.getColumn(1).width = 28; summary.getColumn(2).width = 86; summary.columns.forEach(column => { column.numFmt = '@'; column.alignment = { wrapText: true, vertical: 'top' }; });
  return workbook;
}
export async function inventoryWorkbookBytes(workbook: ExcelJS.Workbook): Promise<Uint8Array> { return new Uint8Array(await workbook.xlsx.writeBuffer() as unknown as ArrayBuffer); }
