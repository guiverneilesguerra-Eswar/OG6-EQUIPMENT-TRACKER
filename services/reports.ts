import ExcelJS from 'exceljs';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { saveSpreadsheet } from './spreadsheetFiles';
import { remainingQuantity } from './movements';
import { TrackerData, assetStatus, isActive, formatDate, manilaParts } from './tracker';
export interface ReportFilters { search: string; status: string; from: string; to: string }
function toBase64(bytes: Uint8Array) { const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'; let result = ''; for (let i = 0; i < bytes.length; i += 3) { const value = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0); result += alphabet[(value >> 18) & 63] + alphabet[(value >> 12) & 63] + (i + 1 < bytes.length ? alphabet[(value >> 6) & 63] : '=') + (i + 2 < bytes.length ? alphabet[value & 63] : '='); } return result; }
export async function exportReport(data: TrackerData, filters: ReportFilters) {
  const workbook = new ExcelJS.Workbook(); workbook.creator = 'OG6 Equipment Tracker'; workbook.created = new Date();
  function sheet(name: string, headers: string[], rows: (string | number)[][]) { const ws = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] }); ws.addRow(headers); rows.forEach(row => ws.addRow(row)); ws.getRow(1).height = 26; ws.getRow(1).eachCell(cell => { cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF715400' } }; cell.alignment = { vertical: 'middle' }; }); ws.columns.forEach((column, index) => { column.width = Math.min(55, Math.max(headers[index].length + 4, ...rows.map(row => String(row[index] ?? '').length + 2))); }); ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, rows.length + 1), column: headers.length } }; ws.eachRow((row, number) => { if (number > 1 && number % 2 === 0) row.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF6D7' } }; }); }); }
  const assets = data.assets.filter(a => !a.archivedAt); const selected = assets.filter(a => a.name.toLowerCase().includes(filters.search.toLowerCase()) && (filters.status === 'ALL' || assetStatus(a.id, data.withdrawals) === filters.status));
  sheet('EQUIPMENT STATUS', ['Item Name', 'Status'], selected.map(a => [a.name, assetStatus(a.id, data.withdrawals)]));
  const history = data.withdrawals.filter(w => !w.deletedAt && (!filters.from || w.withdrawalAt >= new Date(`${filters.from}T00:00:00+08:00`).toISOString()) && (!filters.to || w.withdrawalAt <= new Date(`${filters.to}T23:59:59+08:00`).toISOString()));
  const name = (id: string) => data.assets.find(a => a.id === id);
  sheet('WITHDRAWAL HISTORY', ['Transaction ID', 'Item Name', 'Serial/Product ID', 'Releaser', 'Receiver', 'Withdrawal Date (PHT)', 'Due Date (PHT)', 'Actual Return Date (PHT)', 'Status', 'Notes', 'Batch Reference', 'Quantity Withdrawn', 'Quantity Outstanding'], history.map(w => [w.id, name(w.assetId)?.name || '', name(w.assetId)?.serial || '', w.releaser, w.receiver, formatDate(w.withdrawalAt), formatDate(w.dueAt), w.returnedAt ? formatDate(w.returnedAt) : '', w.returnedAt ? 'RETURNED' : assetStatus(w.assetId, data.withdrawals), w.notes, w.reference || w.id, w.quantity ?? 1, remainingQuantity(w)]));
  sheet('INVENTORY MASTER LIST', ['Item Name', 'Serial/Product ID', 'Notes', 'Current Status', 'Date Added (PHT)'], assets.map(a => [a.name, a.serial, a.notes, assetStatus(a.id, data.withdrawals), formatDate(a.createdAt)]));
  sheet('OVERDUE ITEMS', ['Item Name', 'Serial/Product ID', 'Receiver', 'Withdrawal Date (PHT)', 'Due Date (PHT)', 'Overdue Duration'], data.withdrawals.filter(w => isActive(w) && new Date(w.dueAt).getTime() < Date.now()).map(w => [name(w.assetId)?.name || '', name(w.assetId)?.serial || '', w.receiver, formatDate(w.withdrawalAt), formatDate(w.dueAt), `${Math.floor((Date.now() - new Date(w.dueAt).getTime()) / 3600000)} hours`]));
  const buffer = await workbook.xlsx.writeBuffer(); const filename = `OG6_Equipment_Report_${manilaParts().date}.xlsx`;
  await saveSpreadsheet(new Uint8Array(buffer as ArrayBuffer), filename);
  return filename;
}
