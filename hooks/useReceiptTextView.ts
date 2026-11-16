import { useMemo } from 'react';
import type { ReceiptTextDocument } from '@/services/receiptText';
import { receiptTextViewportHeight } from '@/services/receiptText';
import { useResponsive } from './useResponsive';

export function useReceiptTextView(document: ReceiptTextDocument) {
  const responsive = useResponsive();
  const viewportHeight = useMemo(() => receiptTextViewportHeight(responsive.height), [responsive.height]);
  return { entries: document.entries, viewportHeight };
}
