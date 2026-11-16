import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { PDFFont } from 'pdf-lib';
import type { Signature } from './tracker';
import { palettes } from '../constants/theme';
import { a4Layout as a4 } from '../constants/pdfLayout';

export interface A4Signature { label: string; person: string; signature: Signature; note?: string }
export type A4Block =
  | { kind: 'text'; text: string; heading?: boolean }
  | { kind: 'table'; headers: string[]; weights: number[]; rows: string[][] }
  | { kind: 'signatures'; entries: A4Signature[] };
interface TextCommand { kind: 'text'; text: string; x: number; y: number; size: number; bold: boolean }
interface LineCommand { kind: 'line'; x: number; y: number; endX: number; endY: number; thickness: number }
type Command = TextCommand | LineCommand;
export interface SingleA4File { bytes: Uint8Array; base64: string; html: string; scale: number }
const color = (hex: string) => rgb(parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255);
const htmlEntities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escape = (value: string) => value.replace(/[&<>"']/g, ch => htmlEntities[ch] || ch);
function safeText(value: string, font: PDFFont): string {
  return Array.from(value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/\r/g, '').replace(/\t/g, ' ')).map(ch => {
    if (ch === '\n') return ch;
    try { font.encodeText(ch); return ch; } catch { return '?'; }
  }).join('');
}
function wrap(value: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of safeText(value, font).split('\n')) {
    let row = ''; let rowWidth = 0;
    for (const ch of paragraph) {
      const characterWidth = font.widthOfTextAtSize(ch, size);
      if (row && rowWidth + characterWidth > width) { lines.push(row); row = ''; rowWidth = 0; }
      row += ch; rowWidth += characterWidth;
    }
    lines.push(row || ' ');
  }
  return lines;
}

// No truncation, pagination, hidden rows or giant intermediate PDF pages.
// Each command is measured first, then uniformly fitted inside one A4 body.
export async function createSingleA4Document(title: string, blocks: A4Block[]): Promise<SingleA4File> {
  const doc = await PDFDocument.create(); const normal = await doc.embedFont(StandardFonts.Helvetica); const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const width = a4.width - a4.margin * 2; const commands: Command[] = []; let y = 0;
  const text = (value: string, x: number, top: number, size: number, heavy = false) => commands.push({ kind: 'text', text: value, x, y: top + size, size, bold: heavy });
  const line = (x: number, top: number, endX: number, endY = top, thickness = 0.4) => commands.push({ kind: 'line', x, y: top, endX, endY, thickness });
  for (const block of blocks) {
    if (block.kind === 'text') {
      const size = block.heading ? a4.heading : a4.font; const face = block.heading ? bold : normal;
      if (block.heading) y += a4.sectionGap / 2;
      for (const row of wrap(block.text, face, size, width)) { text(row, 0, y, size, Boolean(block.heading)); y += a4.lineHeight; }
      y += block.heading ? a4.sectionGap / 2 : 2;
    } else if (block.kind === 'table') {
      if (block.headers.length !== block.weights.length || block.weights.some(weight => !Number.isFinite(weight) || weight <= 0)) throw new Error('Invalid PDF table layout.');
      const total = block.weights.reduce((sum, weight) => sum + weight, 0); const widths = block.weights.map(weight => width * weight / total);
      const drawRow = (cells: string[], header: boolean) => {
        const face = header ? bold : normal;
        const rows = widths.map((columnWidth, index) => wrap(cells[index] || '-', face, a4.tableFont, Math.max(1, columnWidth - a4.cellPadding * 2)));
        const height = Math.max(1, ...rows.map(rows => rows.length)) * a4.tableLeading + a4.cellPadding * 2;
        let x = 0;
        line(0, y, width); line(0, y + height, width);
        for (let column = 0; column < widths.length; column++) {
          line(x, y, x, y + height);
          rows[column].forEach((row, index) => text(row, x + a4.cellPadding, y + a4.cellPadding + index * a4.tableLeading, a4.tableFont, header));
          x += widths[column];
        }
        line(width, y, width, y + height); y += height;
      };
      drawRow(block.headers, true); block.rows.forEach(row => drawRow(row, false)); y += a4.sectionGap;
    } else {
      const cellWidth = (width - a4.signatureGap) / 2;
      for (let index = 0; index < block.entries.length; index += 2) {
        const entries = block.entries.slice(index, index + 2); let rowHeight = 0;
        entries.forEach((entry, offset) => {
          const x = offset * (cellWidth + a4.signatureGap); let top = y;
          for (const row of wrap(entry.label, bold, a4.font, cellWidth)) { text(row, x, top, a4.font, true); top += a4.lineHeight; }
          const signatureTop = top; const signatureWidth = Math.min(156, cellWidth);
          for (const stroke of entry.signature) for (let pointIndex = 1; pointIndex < stroke.length; pointIndex++) {
            const from = stroke[pointIndex - 1], to = stroke[pointIndex];
            if (![from.x, from.y, to.x, to.y].every(Number.isFinite)) continue;
            const point = (p: { x: number; y: number }) => ({ x: x + Math.max(0, Math.min(500, p.x)) * signatureWidth / 500, y: signatureTop + Math.max(0, Math.min(180, p.y)) * a4.signatureHeight / 180 });
            const start = point(from), end = point(to); line(start.x, start.y, end.x, end.y, 0.8);
          }
          top += a4.signatureHeight; line(x, top, x + signatureWidth, top);
          for (const row of wrap([entry.person || '-', entry.note || ''].filter(Boolean).join('\n'), normal, a4.font, cellWidth)) { text(row, x, top + 2, a4.font); top += a4.lineHeight; }
          rowHeight = Math.max(rowHeight, top - y + a4.sectionGap);
        });
        y += rowHeight;
      }
    }
  }
  const availableHeight = a4.height - a4.bodyTop - a4.footerHeight;
  const scale = Math.min(1, availableHeight / Math.max(1, y));
  const page = doc.addPage([a4.width, a4.height]); const ink = color(palettes.light.text); const brand = color(palettes.light.primary);
  const svg: string[] = [];
  const drawText = (value: string, x: number, top: number, size: number, heavy: boolean, accent = false) => {
    const face = heavy ? bold : normal; const safe = safeText(value, face);
    page.drawText(safe, { x, y: a4.height - top, size, font: face, color: accent ? brand : ink });
    svg.push(`<text x="${x}" y="${top}" xml:space="preserve" font-family="Helvetica,Arial,sans-serif" font-size="${size}" font-weight="${heavy ? 700 : 400}" fill="${accent ? palettes.light.primary : palettes.light.text}">${escape(safe)}</text>`);
  };
  drawText('OG6 EQUIPMENT TRACKER', a4.margin, 48, 17, true);
  const titleRows = wrap(title, bold, 11, width);
  titleRows.forEach((row, index) => drawText(row, a4.margin, 68 + index * 13, 11, true, true));
  for (const command of commands) {
    if (command.kind === 'text') drawText(command.text, a4.margin + command.x * scale, a4.bodyTop + command.y * scale, command.size * scale, command.bold);
    else {
      const x = a4.margin + command.x * scale; const top = a4.bodyTop + command.y * scale;
      const endX = a4.margin + command.endX * scale; const endTop = a4.bodyTop + command.endY * scale;
      page.drawLine({ start: { x, y: a4.height - top }, end: { x: endX, y: a4.height - endTop }, thickness: command.thickness * scale, color: ink });
      svg.push(`<line x1="${x}" y1="${top}" x2="${endX}" y2="${endTop}" stroke="${palettes.light.text}" stroke-width="${command.thickness * scale}" />`);
    }
  }
  drawText('Personnel record - authorized recipients only.', a4.margin, a4.height - 25, 8, false);
  drawText('A4 | 1 / 1', a4.width - a4.margin - 48, a4.height - 25, 8, false);
  doc.setTitle(title); doc.setAuthor('OG6 EQUIPMENT TRACKER'); doc.setCreator('OG6 EQUIPMENT TRACKER');
  // The printed SVG uses the same measured commands as the downloaded vector PDF.
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4 portrait;margin:0}html,body{margin:0;padding:0;width:210mm;height:297mm}svg{display:block;width:210mm;height:297mm}*{box-sizing:border-box}</style></head><body><svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="297mm" viewBox="0 0 ${a4.width} ${a4.height}">${svg.join('')}</svg></body></html>`;
  return { bytes: await doc.save(), base64: await doc.saveAsBase64(), html, scale };
}
