// Spreadsheet-only print and signature tokens. No application theme or data changes.
export const reportStyle = {
  fontName: 'Arial', fontSize: 11,
  ink: 'FF142B3C', navy: 'FF142B3C', blue: 'FF0078D9', white: 'FFFFFFFF',
  border: 'FF8997A1', tint: 'FFF0F5F8',
  columns: 8, columnWidth: 11, pageBudgetPoints: 660,
  signatureRows: 5, signatureRowHeight: 20, imageWidth: 276, imageHeight: 99.36,
} as const;
export const signatureRaster = { sourceWidth: 500, sourceHeight: 180, width: 1000, height: 360, strokeWidth: 2.4, maxPoints: 15000, maxStrokes: 300, maxSamples: 500000 } as const;
