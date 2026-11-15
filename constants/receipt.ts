// PDF points: A4 portrait. Text is never reduced below the requested 12 points.
export const receiptLayout = {
  width: 595.28, height: 841.89, margin: 40, fontSize: 12, lineHeight: 14,
  fieldGap: 6, labelWidth: 154, signatureTop: 232, signatureHeight: 88,
  signatureGap: 16, footerY: 40,
} as const;
