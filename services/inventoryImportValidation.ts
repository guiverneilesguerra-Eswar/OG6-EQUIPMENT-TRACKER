import type { Asset, TrackerData, InventoryImportAudit } from './tracker';

export const inventoryImportHeaders = ['Item', 'Serial/Product ID', 'Notes'] as const;
export const inventoryImportLimits = { fileBytes: 5 * 1024 * 1024, expandedBytes: 32 * 1024 * 1024, rows: 5000, columns: 32, textCharacters: 2000000, item: 200, serial: 200, notes: 10000 };
export interface InventorySourceRow { rowNumber: number; item: string; serial: string; notes: string; sourceIssues: string[] }
export interface InventoryPreviewRow extends InventorySourceRow { status: 'valid' | 'duplicate' | 'invalid'; reasons: string[] }
export interface InventoryImportCounts { total: number; valid: number; duplicate: number; invalid: number }
export interface InventoryImportPreview { filename: string; rows: InventoryPreviewRow[] }
export interface InventoryImportResult { batchId: string; filename: string; at: string; imported: number; duplicatesSkipped: number; invalidRows: number; totalProcessed: number; rows: InventoryPreviewRow[]; alreadyCompleted: boolean }
export function normalizeInventorySerial(value: string) { return value.trim().toLowerCase(); }
export function inventoryRowIssues(row: InventorySourceRow) {
  const issues = [...row.sourceIssues];
  const fields = [['Item', row.item, inventoryImportLimits.item], ['Serial/Product ID', row.serial, inventoryImportLimits.serial], ['Notes', row.notes, inventoryImportLimits.notes]] as const;
  for (const [label, value, limit] of fields) {
    if (!value.trim()) issues.push(`${label} is required.`);
    if (value.trim().length > limit) issues.push(`${label} must be ${limit.toLocaleString('en-US')} characters or fewer.`);
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) issues.push(`${label} contains unsupported control characters.`);
  }
  return Array.from(new Set(issues));
}
export function validateInventoryRows(rows: readonly InventorySourceRow[], assets: readonly Asset[]): InventoryPreviewRow[] {
  const existing = new Set(assets.map(asset => normalizeInventorySerial(asset.serial)));
  const frequencies = new Map<string, number>();
  for (const row of rows) { const key = normalizeInventorySerial(row.serial); if (key) frequencies.set(key, (frequencies.get(key) || 0) + 1); }
  return rows.map<InventoryPreviewRow>(source => {
    const row = { ...source, item: source.item.trim(), serial: source.serial.trim(), notes: source.notes.trim(), sourceIssues: [...source.sourceIssues] };
    const issues = inventoryRowIssues(row);
    if (issues.length) return { ...row, status: 'invalid', reasons: issues };
    const reasons: string[] = [];
    if ((frequencies.get(normalizeInventorySerial(row.serial)) || 0) > 1) reasons.push('Duplicate Serial/Product ID within this file; all repeated rows are skipped.');
    if (existing.has(normalizeInventorySerial(row.serial))) reasons.push('Serial/Product ID already exists in inventory (including archived equipment).');
    return { ...row, status: reasons.length ? 'duplicate' : 'valid', reasons };
  });
}
export function countInventoryRows(rows: readonly InventoryPreviewRow[]): InventoryImportCounts {
  return rows.reduce((counts, row) => ({ ...counts, total: counts.total + 1, [row.status === 'valid' ? 'valid' : row.status === 'duplicate' ? 'duplicate' : 'invalid']: counts[row.status === 'valid' ? 'valid' : row.status === 'duplicate' ? 'duplicate' : 'invalid'] + 1 }), { total: 0, valid: 0, duplicate: 0, invalid: 0 });
}
export function buildInventoryImport(data: TrackerData, preview: InventoryImportPreview, batchId: string, at: string, makeId: (prefix: string) => string): { next: TrackerData; result: InventoryImportResult } {
  const previous = data.inventoryImports?.find(batch => batch.id === batchId);
  if (previous) return { next: data, result: { batchId, filename: previous.filename, at: previous.at, imported: previous.importedAssetIds.length, duplicatesSkipped: previous.duplicatesSkipped, invalidRows: previous.invalidRows, totalProcessed: previous.totalProcessed, rows: preview.rows, alreadyCompleted: true } };
  if (!batchId || !Number.isFinite(Date.parse(at)) || !preview.rows.length || preview.rows.length > inventoryImportLimits.rows) throw new Error('Invalid import batch. Select the Excel file again.');
  if (new Set(preview.rows.map(row => row.rowNumber)).size !== preview.rows.length) throw new Error('Invalid import row references. Select the Excel file again.');
  // Recheck against the CURRENT inventory while the provider holds its write lock.
  // Never promote a row that was rejected in the confirmed preview.
  const checked = validateInventoryRows(preview.rows, data.assets).map((row, index) => preview.rows[index].status !== 'valid' ? preview.rows[index] : row);
  const counts = countInventoryRows(checked);
  if (!counts.valid) throw new Error('No valid records remain. Inventory may have changed since preview. No records were imported; review the updated preview.');
  const assetIds = new Set(data.assets.map(asset => asset.id));
  const activityIds = new Set(data.activities.map(activity => activity.id));
  const uniqueId = (prefix: string, used: Set<string>) => { const id = makeId(prefix); if (!id || used.has(id)) throw new Error('Unable to assign unique import IDs. No records were changed.'); used.add(id); return id; };
  const assets: Asset[] = checked.filter(row => row.status === 'valid').map(row => ({ id: uniqueId('AST', assetIds), name: row.item, serial: row.serial, notes: row.notes, createdAt: at, updatedAt: at }));
  const activities = assets.map(asset => ({ id: uniqueId('ACT', activityIds), assetId: asset.id, type: 'added' as const, person: 'Local operator', at, description: `Equipment registered via Excel import · ${batchId}` }));
  const audit: InventoryImportAudit = { id: batchId, filename: preview.filename, at, importedAssetIds: assets.map(asset => asset.id), duplicatesSkipped: counts.duplicate, invalidRows: counts.invalid, totalProcessed: counts.total };
  const result: InventoryImportResult = { batchId, filename: preview.filename, at, imported: assets.length, duplicatesSkipped: counts.duplicate, invalidRows: counts.invalid, totalProcessed: counts.total, rows: checked, alreadyCompleted: false };
  return { next: { ...data, assets: [...assets, ...data.assets], activities: [...activities, ...data.activities], inventoryImports: [audit, ...(data.inventoryImports || [])] }, result };
}

// Examine the ZIP central directory BEFORE decompression to bound XLSX resource use.
// ExcelJS only reads cell data; no spreadsheet formulas, links or commands are executed.
export interface InventoryZipEntry { name: string; start: number; compressed: number; uncompressed: number; method: number }
export function assertSafeInventoryArchive(bytes: Uint8Array): InventoryZipEntry[] {
  if (bytes.length < 22 || bytes.length > inventoryImportLimits.fileBytes) throw new Error('Choose a valid .xlsx file no larger than 5 MB.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (offset: number) => view.getUint16(offset, true); const u32 = (offset: number) => view.getUint32(offset, true);
  let end = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65557); offset--) {
    if (u32(offset) === 0x06054b50 && offset + 22 + u16(offset + 20) === bytes.length) { end = offset; break; }
  }
  if (end < 0 || u16(end + 4) !== 0 || u16(end + 6) !== 0 || u16(end + 8) !== u16(end + 10)) throw new Error('The file is not a supported Excel workbook. Save it as a standard .xlsx file.');
  const entries = u16(end + 10), size = u32(end + 12), start = u32(end + 16);
  if (!entries || entries > 256 || start + size !== end) throw new Error('The Excel archive is too complex or invalid. Use the official template.');
  let offset = start, expanded = 0; const names = new Set<string>(); const archiveEntries: InventoryZipEntry[] = [];
  for (let i = 0; i < entries; i++) {
    if (offset + 46 > end || u32(offset) !== 0x02014b50) throw new Error('The Excel archive is damaged.');
    const flags = u16(offset + 8), method = u16(offset + 10), compressed = u32(offset + 20), uncompressed = u32(offset + 24);
    const nameLength = u16(offset + 28), extraLength = u16(offset + 30), commentLength = u16(offset + 32), local = u32(offset + 42);
    const next = offset + 46 + nameLength + extraLength + commentLength;
    if (next > end || flags & 1 || ![0, 8].includes(method) || local + 30 > start || uncompressed === 0xffffffff || compressed === 0xffffffff) throw new Error('Encrypted or unsupported Excel files cannot be imported.');
    let name = ''; for (let j = 0; j < nameLength; j++) name += String.fromCharCode(bytes[offset + 46 + j]);
    const lower = name.toLowerCase();
    if (names.has(lower) || lower.includes('..') || lower.includes('\\') || lower.startsWith('/') || lower.includes('vbaproject') || lower.includes('externallinks/')) throw new Error('Workbooks with macros, external links or unsafe archive entries cannot be imported.');
    names.add(lower);
    if (u32(local) !== 0x04034b50 || u16(local + 8) !== method || (u16(local + 6) & 1)) throw new Error('The Excel archive is damaged.');
    const contentStart = local + 30 + u16(local + 26) + u16(local + 28);
    if (contentStart + compressed > start) throw new Error('The Excel archive is damaged.');
    expanded += uncompressed;
    if (expanded > inventoryImportLimits.expandedBytes || uncompressed > 16 * 1024 * 1024 || (uncompressed > 1024 * 1024 && uncompressed / Math.max(1, compressed) > 250)) throw new Error('The workbook expands beyond the safe import limit. Remove unused sheets and formatting, or split the inventory file.');
    archiveEntries.push({ name: lower, start: contentStart, compressed, uncompressed, method });
    offset = next;
  }
  if (offset !== end || !names.has('[content_types].xml') || !names.has('xl/workbook.xml')) throw new Error('The selected file is not a valid .xlsx workbook.');
  return archiveEntries;
}
