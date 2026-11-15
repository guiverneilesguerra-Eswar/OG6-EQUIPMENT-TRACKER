import ExcelJS from 'exceljs';
import { unzipSync } from 'fflate';
import { buildReportWorkbook } from '../services/reportWorkbook.ts';
import { signaturePng } from '../services/signaturePng.ts';
import type { ReportWithdrawal } from '../services/reportTransactions.ts';
import type { TrackerData } from '../services/tracker.ts';
const check = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
const at = '2026-11-14T08:00:00Z', returnedAt = '2026-11-15T09:00:00.123Z';
const receiverInk = [[{ x: 10, y: 30 }, { x: 100, y: 65 }, { x: 220, y: 75 }]];
const receivingInk = [[{ x: 35, y: 80 }, { x: 90, y: 20 }, { x: 240, y: 85 }]];
const filters = { search: '', status: 'ALL', from: '', to: '' };
const options = { now: Date.parse(returnedAt), formatDate: (value: string) => value, assetStatus: (_id: string) => 'IN' };
function fixture(count = 1): TrackerData {
  const records: ReportWithdrawal[] = Array.from({ length: count }, (_, index) => ({
    id: `WD-${index + 1}`, transactionId: count > 1 ? 'BATCH-1' : undefined, assetId: `AST-${index + 1}`, releaser: 'Issuer', receiver: 'Borrower', signature: receiverInk,
    withdrawalAt: at, dueAt: returnedAt, createdAt: at, notes: 'Preserve this', returnedAt, returning: 'Returning operator', receiving: 'Storekeeper', receivingSignature: receivingInk, receivingSignatureAt: returnedAt,
  }));
  return { version: 1, assets: records.map((record, index) => ({ id: record.assetId, name: `Radio ${index + 1}`, serial: String(index + 1).padStart(6, '0'), notes: 'Operational', createdAt: at, updatedAt: at })), withdrawals: records,
    activities: [], notices: [], settings: { theme: 'dark', notificationVolume: 100, alarmVolume: 100, enabled: true, warningHours: 24, role: 'operator' } };
}
function findRow(sheet: ExcelJS.Worksheet, text: string): number {
  let found = 0;
  sheet.eachRow(row => row.eachCell(cell => { if (!found && cell.text === text) found = row.number; }));
  check(found > 0, `Missing cell text: ${text}`); return found;
}
async function roundTrip(workbook: ExcelJS.Workbook) {
  const bytes = new Uint8Array(await workbook.xlsx.writeBuffer() as unknown as ArrayBuffer);
  const loaded = new ExcelJS.Workbook(); await loaded.xlsx.load(bytes as unknown as Parameters<typeof loaded.xlsx.load>[0]);
  return { loaded, archive: unzipSync(bytes) };
}
Deno.test('Excel download retains four existing sheets and adds A4 withdrawal/return signature sheets with embedded actual images', async () => {
  const data = fixture(); const before = JSON.stringify(data);
  const workbook = await buildReportWorkbook(data, filters, options); const { loaded, archive } = await roundTrip(workbook);
  check(loaded.worksheets.map(sheet => sheet.name).join('|') === 'EQUIPMENT STATUS|WITHDRAWAL HISTORY|INVENTORY MASTER LIST|OVERDUE ITEMS|WITHDRAWAL SIGNATURES|RETURN SIGNATURES', 'Keep existing report sheets.');
  const withdrawal = loaded.getWorksheet('WITHDRAWAL SIGNATURES')!, returned = loaded.getWorksheet('RETURN SIGNATURES')!;
  for (const sheet of [withdrawal, returned]) {
    check(sheet.pageSetup.paperSize === 9 && sheet.pageSetup.orientation === 'portrait', 'A4 portrait signature sheet.');
    check(sheet.pageSetup.fitToWidth === 1 && sheet.pageSetup.fitToHeight === 0, 'Fit one page wide, allow continuation pages.');
    check(sheet.pageSetup.printArea?.includes('H'), 'Defined print area includes both signature columns.');
    const headingRow = findRow(sheet, "RELEASER'S SIGNATURE");
    check(sheet.getCell(headingRow, 5).text === "RECEIVER'S SIGNATURE", 'Side-by-side role headings.');
    check(sheet.getCell(headingRow + 1, 1).value === null && sheet.getCell(headingRow + 1, 5).value === null, 'Signature cell values remain blank, not typed names.');
    check(sheet.getCell(headingRow + 1, 1).isMerged && sheet.getCell(headingRow + 5, 8).isMerged, 'Five-row merged signing areas.');
    check(sheet.getRow(headingRow + 1).height === 20, '100 points of signing height.');
    check(Boolean(sheet.getCell(headingRow, 1).border.bottom), 'Signature borders survive XLSX round-trip.');
  }
  check(withdrawal.getCell(findRow(withdrawal, 'Date & Time'), 3).text === `${at} (PHT)`, 'Withdrawal event date.');
  check(returned.getCell(findRow(returned, 'Date & Time'), 3).text === `${returnedAt} (PHT)`, 'Actual return event date, not the due date.');
  check(returned.getCell(findRow(returned, 'Releaser'), 3).text === 'Storekeeper' && returned.getCell(findRow(returned, 'Receiver'), 3).text === 'Returning operator', 'Correct return personnel roles.');
  check(findRow(withdrawal, 'Printed Name: Borrower') > 0 && findRow(returned, 'Printed Name: Storekeeper') > 0, 'Auto-populate printed names separately from pen images.');
  check(withdrawal.getImages().length === 1 && withdrawal.getImages()[0].range.tl.col >= 4, 'Withdrawal receiver image is on the right.');
  check(returned.getImages().length === 1 && returned.getImages()[0].range.tl.col < 4, 'Return receiving-personnel image is on the left.');
  const media = Object.entries(archive).filter(([path]) => /^xl\/media\/.*\.png$/.test(path));
  check(media.length === 2, 'Signature PNG files are embedded inside XLSX.');
  for (const signature of [receiverInk, receivingInk]) check(media.some(([, bytes]) => bytes.join(',') === signaturePng(signature)!.join(',')), 'Exact rendered pen-stroke image preserved.');
  const drawings = Object.entries(archive).filter(([path]) => /^xl\/drawings\/drawing\d+\.xml$/.test(path));
  check(drawings.length === 2 && drawings.every(([, bytes]) => new TextDecoder().decode(bytes).includes('r:embed')), 'Embedded image relationships, no remote/local file references.');
  check(JSON.stringify(data) === before, 'Export never changes tracker records, settings or signatures.');
});
Deno.test('uncaptured legacy signatures remain blank and formula-looking personnel/serials remain plain text', async () => {
  const data = fixture(); data.withdrawals[0] = { ...data.withdrawals[0], signature: [], receivingSignature: undefined, receivingSignatureAt: undefined, releaser: '=HYPERLINK("bad")', receiver: '+CMD' }; data.assets[0].serial = '000001';
  const { loaded, archive } = await roundTrip(await buildReportWorkbook(data, filters, options));
  const withdrawal = loaded.getWorksheet('WITHDRAWAL SIGNATURES')!, returned = loaded.getWorksheet('RETURN SIGNATURES')!;
  check(withdrawal.getImages().length === 0 && returned.getImages().length === 0, 'No substitutes for missing captured evidence.');
  check(!Object.keys(archive).some(path => path.startsWith('xl/media/')), 'No fabricated signature files.');
  check(withdrawal.getCell(findRow(withdrawal, 'Releaser'), 3).type === ExcelJS.ValueType.String, 'Never evaluate formula-looking personnel names.');
  check(findRow(withdrawal, '000001') > 0, 'Keep serial leading zeros.');
  check(findRow(returned, 'Date: ____________________') > 0, 'No invented historical signing date.');
});
Deno.test('large explicit multi-item transaction uses continuation sections without dropping items or signatures', async () => {
  const data = fixture(12); const { loaded, archive } = await roundTrip(await buildReportWorkbook(data, filters, options));
  for (const name of ['WITHDRAWAL SIGNATURES', 'RETURN SIGNATURES']) {
    const sheet = loaded.getWorksheet(name)!;
    for (const asset of data.assets) check(findRow(sheet, asset.name) > 0 && findRow(sheet, asset.serial) > 0, 'All equipment items remain in the grouped transaction.');
    check(sheet.getImages().length > 1, 'Repeat actual captured signature on each batch continuation section.');
  }
  const signatureXml = new TextDecoder().decode(archive['xl/worksheets/sheet5.xml']);
  check(signatureXml.includes('rowBreaks') && signatureXml.includes('Part 1'), 'Explicit A4 page breaks and continuation labels.');
});
Deno.test('date filters keep signature sheets aligned with history; source remains unchanged on invalid signature failure', async () => {
  const data = fixture();
  const { loaded } = await roundTrip(await buildReportWorkbook(data, { ...filters, from: '2026-11-15', to: '2026-11-15' }, options));
  check(loaded.getWorksheet('WITHDRAWAL HISTORY')!.rowCount === 1, 'History filtered by withdrawal event date.');
  check(loaded.getWorksheet('RETURN SIGNATURES')!.getImages().length === 0, 'No unrelated return evidence leaks into filtered history.');
  data.withdrawals[0].signature = [[{ x: 501, y: 0 }, { x: 10, y: 10 }]];
  const before = JSON.stringify(data); let rejected = false;
  try { await buildReportWorkbook(data, filters, options); } catch (error) { rejected = error instanceof Error && error.message.includes('WD-1'); }
  check(rejected, 'Malformed captured evidence produces a transaction-specific export error, never a substitute.');
  check(JSON.stringify(data) === before, 'Failed export must not change data.');
});
