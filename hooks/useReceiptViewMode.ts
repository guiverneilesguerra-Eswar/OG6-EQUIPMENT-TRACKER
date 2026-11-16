import { useCallback, useEffect, useState } from 'react';
import type { ReceiptFile } from '@/services/receipts';
import type { ReceiptViewMode } from '@/services/receiptText';

export function useReceiptViewMode(file: ReceiptFile | null) {
  const [mode, setMode] = useState<ReceiptViewMode>('a4');
  // A different receipt/event opens in its original A4 preview mode.
  useEffect(() => { setMode('a4'); }, [file]);
  const selectMode = useCallback((next: ReceiptViewMode) => {
    if (next === 'text' && !file?.readable) return;
    setMode(next);
  }, [file]);
  return { mode, selectMode };
}
