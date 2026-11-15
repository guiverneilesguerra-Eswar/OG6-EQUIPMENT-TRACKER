import ExcelJS from 'exceljs';
import { encode } from 'base64-arraybuffer';
import type { TrackerData } from './tracker';
import { reportTransactions, ReportTransaction, ReportSigner } from './reportTransactions';
import { signaturePng } from './signaturePng';
import { reportStyle as style } from '../constants/report';

export interface ReportFilters { search: string; status: string; from: string; to: string }
export interface ReportWorkbookOptions {
  now: number;
  formatDate: (value: string) => string;
  assetStatus: (assetId: string) => string;
}
const border: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: style.border } }, bottom: { style: 'thin', color: { argb: style.border } },
  left: { style: 'thin', color: { argb: style.border } }, right: { style: 'thin', color: { argb: style.border } },
};
function textHeight(value: string, characters: number, minimum = 28): number {
  if (value.length > 32767) throw new Error('A report field exceeds the Excel cell text limit. Existing records were not changed.');
  const lines = value.split('\n').reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / characters)), 0);
  const height = Math.max(minimum, lines * 15 + 10);
  if (height > 200) throw new Error('A transaction field is too long for a readable A4 signature report. Existing records were not changed.');
  return height;
}
function printSetup(sheet: ExcelJS.Worksheet, landscape = false) {
  sheet.pageSetup = {
    paperSize: 9, orientation: landscape ? 'landscape' : 'portrait',
    fitToPage: true, fitToWidth: 1, fitToHeight: 0,
    horizontalCentered: true,
    margins: { left: 0.35, right: 0.35, top: 0.45, bottom: 0.45, header: 0.2, footer: 0.2 },
  };
  sheet.headerFooter = { oddFooter: '&LOG6 EQUIPMENT TRACKER&CPersonnel record - authorized recipients only&RPage &P / &N' };
}

// Pure workbook construction; save/share happens separately. All signatures and
// worksheet drawings are included inside the XLSX, never linked to local files.
export async function buildReportWorkbook(data: TrackerData, filters: ReportFilters, options: ReportWorkbookOptions): Promise<ExcelJS.Workbook> {
  if (filters.from && filters.to && filters.from > filters.to) throw new Error('Reporting end date must not precede the start date.');
  const workbook = new ExcelJS.Workbook(); workbook.creator = 'OG6 EQUIPMENT TRACKER'; workbook.created = new Date(options.now);
  const { formatDate, assetStatus } = options;
  const equipment = new Map(data.assets.map(asset => [asset.id, asset]));
  const assets = data.assets.filter(asset => !asset.archivedAt);
  const selected = assets.filter(asset => asset.name.toLowerCase().includes(filters.search.toLowerCase()) && (filters.status === 'ALL' || assetStatus(asset.id) === filters.status));
  const from = filters.from ? Date.parse(`${filters.from}T00:00:00+08:00`) : -Infinity;
  const to = filters.to ? Date.parse(`${filters.to}T23:59:59.999+08:00`) : Infinity;
  if (Number.isNaN(from) || Number.isNaN(to)) throw new Error('Choose valid reporting dates.');
  const history = data.withdrawals.filter(record => !record.deletedAt && Date.parse(record.withdrawalAt) >= from && Date.parse(record.withdrawalAt) <= to);
  const summarySheet = (name: string, headers: string[], rows: (string | number)[][]) => {
    const sheet = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1, showGridLines: false }] });
    sheet.addRow(headers); rows.forEach(row => sheet.addRow(row));
    sheet.eachRow((row, number) => {
      row.height = number === 1 ? 32 : 30;
      row.eachCell({ includeEmpty: true }, cell => {
        cell.font = { name: style.fontName, size: style.fontSize, bold: number === 1, color: { argb: number === 1 ? style.white : style.ink } };
        cell.alignment = { vertical: 'middle', wrapText: true }; cell.border = border;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: number === 1 ? style.blue : number % 2 === 0 ? style.tint : style.white } };
        cell.numFmt = '@';
      });
    });
    headers.forEach((header, index) => {
      let width = header.length + 4;
      for (const row of rows) width = Math.max(width, String(row[index] ?? '').length + 2);
      sheet.getColumn(index + 1).width = Math.min(55, width);
    });
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, rows.length + 1), column: headers.length } };
    printSetup(sheet, headers.length > 3); sheet.pageSetup.printTitlesRow = '1:1'; sheet.pageSetup.printArea = `A1:${sheet.getColumn(headers.length).letter}${sheet.rowCount}`;
  };
  summarySheet('EQUIPMENT STATUS', ['Item Name', 'Status'], selected.map(asset => [asset.name, assetStatus(asset.id)]));
  summarySheet('WITHDRAWAL HISTORY', ['Transaction ID', 'Item Name', 'Serial/Product ID', 'Releaser', 'Receiver', 'Withdrawal Date (PHT)', 'Due Date (PHT)', 'Actual Return Date (PHT)', 'Status', 'Notes'], history.map(record => [record.id, equipment.get(record.assetId)?.name || '', equipment.get(record.assetId)?.serial || '', record.releaser, record.receiver, formatDate(record.withdrawalAt), formatDate(record.dueAt), record.returnedAt ? formatDate(record.returnedAt) : '', record.returnedAt ? 'RETURNED' : assetStatus(record.assetId), record.notes]));
  summarySheet('INVENTORY MASTER LIST', ['Item Name', 'Serial/Product ID', 'Notes', 'Current Status', 'Date Added (PHT)'], assets.map(asset => [asset.name, asset.serial, asset.notes, assetStatus(asset.id), formatDate(asset.createdAt)]));
  summarySheet('OVERDUE ITEMS', ['Item Name', 'Serial/Product ID', 'Receiver', 'Withdrawal Date (PHT)', 'Due Date (PHT)', 'Overdue Duration'], data.withdrawals.filter(record => !record.returnedAt && !record.deletedAt && Date.parse(record.dueAt) < options.now).map(record => [equipment.get(record.assetId)?.name || '', equipment.get(record.assetId)?.serial || '', record.receiver, formatDate(record.withdrawalAt), formatDate(record.dueAt), `${Math.floor((options.now - Date.parse(record.dueAt)) / 3600000)} hours`]));
  const images = new Map<string, number>();
  const imageId = (signer: ReportSigner, transactionId: string): number | null => {
    if (signer.signature == null || (Array.isArray(signer.signature) && signer.signature.length === 0)) return null;
    const key = JSON.stringify(signer.signature);
    const cached = images.get(key); if (cached !== undefined) return cached;
    let bytes: Uint8Array | null;
    try { bytes = signaturePng(signer.signature); }
    catch (error) { throw new Error(`Cannot export captured signature for ${transactionId}: ${error instanceof Error ? error.message : 'Invalid signature.'}`); }
    if (!bytes) return null;
    const id = workbook.addImage({ base64: `data:image/png;base64,${encode(bytes.buffer as ArrayBuffer)}`, extension: 'png' });
    images.set(key, id); return id;
  };
  for (const kind of ['withdrawal', 'return'] as const) {
    const transactions = reportTransactions(history, data.assets, kind);
    const sheet = workbook.addWorksheet(kind === 'return' ? 'RETURN SIGNATURES' : 'WITHDRAWAL SIGNATURES', { views: [{ state: 'normal', showGridLines: false }] });
    for (let column = 1; column <= style.columns; column++) sheet.getColumn(column).width = style.columnWidth;
    printSetup(sheet);
    let row = 1;
    const merge = (at: number, first: number, last: number, value: string, heading = false, center = false) => {
      sheet.mergeCells(at, first, at, last);
      const cell = sheet.getCell(at, first); cell.value = value; cell.numFmt = '@'; cell.border = border;
      cell.font = { name: style.fontName, size: style.fontSize, bold: heading, color: { argb: heading ? style.white : style.ink } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: heading ? style.navy : style.white } };
      cell.alignment = { vertical: 'middle', horizontal: center ? 'center' : 'left', wrapText: true, indent: center ? 0 : 1 };
      return cell;
    };
    const fullRow = (value: string, height: number, heading = false) => { merge(row, 1, 8, value, heading, heading); sheet.getRow(row).height = height; row++; };
    const field = (label: string, value: string, height: number) => {
      merge(row, 1, 2, label); sheet.getCell(row, 1).font = { name: style.fontName, size: style.fontSize, bold: true, color: { argb: style.ink } };
      merge(row, 3, 8, value || ''); sheet.getRow(row).height = height; row++;
    };
    const signArea = (transaction: ReportTransaction, nameHeight: number, dateHeight: number) => {
      merge(row, 1, 4, "RELEASER'S SIGNATURE", true, true); merge(row, 5, 8, "RECEIVER'S SIGNATURE", true, true); sheet.getRow(row).height = 24; row++;
      const blankStart = row; const blankEnd = row + style.signatureRows - 1;
      for (const startColumn of [1, 5]) {
        sheet.mergeCells(blankStart, startColumn, blankEnd, startColumn + 3);
        const cell = sheet.getCell(blankStart, startColumn); cell.border = border; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: style.white } };
      }
      for (; row <= blankEnd; row++) sheet.getRow(row).height = style.signatureRowHeight;
      [transaction.releaser, transaction.receiver].forEach((signer, index) => {
        const id = imageId(signer, transaction.id);
        if (id !== null) sheet.addImage(id, { tl: { col: index * 4 + 0.2, row: blankStart - 1 + 0.2 }, ext: { width: style.imageWidth, height: style.imageHeight }, editAs: 'oneCell' });
      });
      merge(row, 1, 4, `Printed Name: ${transaction.releaser.name || '____________________'}`);
      merge(row, 5, 8, `Printed Name: ${transaction.receiver.name || '____________________'}`); sheet.getRow(row).height = nameHeight; row++;
      const signatureDate = (signer: ReportSigner) => {
        if (!signer.capturedAt) return 'Date: ____________________';
        if (!Number.isFinite(Date.parse(signer.capturedAt))) throw new Error(`Invalid captured-signature date for ${transaction.id}.`);
        return `Date: ${formatDate(signer.capturedAt)} (PHT)`;
      };
      merge(row, 1, 4, signatureDate(transaction.releaser)); merge(row, 5, 8, signatureDate(transaction.receiver)); sheet.getRow(row).height = dateHeight; row++;
    };
    if (!transactions.length) {
      fullRow(kind === 'return' ? 'RETURN SIGNATURES' : 'WITHDRAWAL SIGNATURES', 28, true);
      fullRow('No matching transactions in the selected withdrawal-date range.', 36);
    }
    for (const transaction of transactions) {
      const referenceHeight = textHeight(`Reference: ${transaction.id} | Part 9999 / 9999`, 82, 24);
      const releaserHeight = textHeight(transaction.releaser.name, 60);
      const receiverHeight = textHeight(transaction.receiver.name, 60);
      const nameHeight = Math.max(textHeight(`Printed Name: ${transaction.releaser.name}`, 39), textHeight(`Printed Name: ${transaction.receiver.name}`, 39));
      const dateHeight = transaction.releaser.capturedAt || transaction.receiver.capturedAt ? 44 : 28;
      // Fixed-height signature boxes always remain together. Large explicit batches
      // are split into continuation pages with the same verified people/evidence.
      const fixed = 24 + 24 + referenceHeight + 28 + releaserHeight + receiverHeight + 24 + 22 + 24 + 100 + nameHeight + dateHeight + 44;
      const available = style.pageBudgetPoints - fixed;
      const chunks: { items: typeof transaction.items; heights: number[] }[] = [];
      let chunk: typeof chunks[number] = { items: [], heights: [] }; let used = 0;
      for (const item of transaction.items) {
        const height = Math.max(textHeight(item.name, 39, 32), textHeight(item.serial, 29, 32));
        if (height > available) throw new Error(`Transaction ${transaction.id} cannot fit its fields and signature area on A4. Existing records were not changed.`);
        if (used + height > available && chunk.items.length) { chunks.push(chunk); chunk = { items: [], heights: [] }; used = 0; }
        chunk.items.push(item); chunk.heights.push(height); used += height;
      }
      if (chunk.items.length) chunks.push(chunk);
      let itemNumber = 0;
      for (let part = 0; part < chunks.length; part++) {
        if (row > 1) sheet.getRow(row - 1).addPageBreak();
        fullRow('OG6 EQUIPMENT TRACKER', 24, true);
        fullRow(kind === 'return' ? 'RETURN TRANSACTION' : 'WITHDRAWAL TRANSACTION', 24, true);
        fullRow(`Reference: ${transaction.id}${chunks.length > 1 ? ` | Part ${part + 1} / ${chunks.length}` : ''}`, referenceHeight);
        field('Date & Time', `${formatDate(transaction.at)} (PHT)`, 28);
        field('Releaser', transaction.releaser.name, releaserHeight); field('Receiver', transaction.receiver.name, receiverHeight);
        fullRow('Equipment / Item', 24, true);
        const no = sheet.getCell(row, 1); no.value = '#'; no.font = { name: style.fontName, size: style.fontSize, bold: true }; no.border = border; no.alignment = { horizontal: 'center', vertical: 'middle' };
        merge(row, 2, 5, 'Item description', true, true); merge(row, 6, 8, 'Serial / Product ID', true, true); sheet.getRow(row).height = 22; row++;
        chunks[part].items.forEach((item, index) => {
          const number = sheet.getCell(row, 1); number.value = ++itemNumber; number.font = { name: style.fontName, size: style.fontSize }; number.border = border; number.alignment = { vertical: 'middle', horizontal: 'center' };
          merge(row, 2, 5, item.name); merge(row, 6, 8, item.serial); sheet.getRow(row).height = chunks[part].heights[index]; row++;
        });
        signArea(transaction, nameHeight, dateHeight);
        fullRow(kind === 'return' ? 'Return roles: Releaser accepts the equipment; Receiver returns it.' : 'Withdrawal roles: Releaser issues the equipment; Receiver accepts it.', 22);
        fullRow('Captured pen signatures are embedded. Blank areas are for manual signing.', 22);
      }
      // Keep large reports responsive during mobile generation.
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    }
    sheet.pageSetup.printArea = `A1:H${row - 1}`;
  }
  return workbook;
}
