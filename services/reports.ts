import { assetStatus, formatDate, manilaParts } from './tracker';
import type { TrackerData } from './tracker';
import { buildReportWorkbook } from './reportWorkbook';
import type { ReportFilters } from './reportWorkbook';
import { saveSpreadsheet } from './spreadsheetFiles';

export type { ReportFilters } from './reportWorkbook';
export async function exportReport(data: TrackerData, filters: ReportFilters): Promise<string> {
  const now = Date.now();
  const workbook = await buildReportWorkbook(data, filters, {
    now, formatDate,
    assetStatus: id => assetStatus(id, data.withdrawals, now),
  });
  const buffer = await workbook.xlsx.writeBuffer();
  const bytes = new Uint8Array(buffer as unknown as ArrayBuffer);
  return saveSpreadsheet(bytes, `OG6_Equipment_Report_${manilaParts().date}.xlsx`);
}
