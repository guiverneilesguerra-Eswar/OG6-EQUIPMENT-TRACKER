import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Asset, Withdrawal } from '@/services/tracker';
import { createReceipt, downloadReceipt, ReceiptFile, ReceiptKind, shareReceipt } from '@/services/receipts';
import { printTransactionReceipt } from '@/services/transactionReceipts';
import { useTracker } from './useTracker';
import type { PdfOptions } from '@/constants/pdf';

export function useReceipt(asset: Asset, withdrawal: Withdrawal, kind: ReceiptKind, returnReference?: string) {
  const { data } = useTracker();
  // Notice polling does not repeatedly rebuild a PDF; only receipt records do.
  const receiptData = useMemo(() => ({ ...data }), [data.assets, data.withdrawals, data.batches, data.returnRecords]);
  const [printing, setPrinting] = useState(false);
  const [file, setFile] = useState<ReceiptFile | null>(null);
  const [preparing, setPreparing] = useState(true);
  const [delivering, setDelivering] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [attempt, setAttempt] = useState(0);
  const locked = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let cancelled = false;
    setFile(null); setPreparing(true); setError(''); setMessage('');
    createReceipt(asset, withdrawal, kind, receiptData, returnReference).then(result => { if (!cancelled) setFile(result); }).catch(e => {
      if (!cancelled) setError(e instanceof Error ? e.message : 'Unable to generate the PDF receipt. Please try again.');
    }).finally(() => { if (!cancelled) setPreparing(false); });
    return () => { cancelled = true; };
  }, [asset, withdrawal, kind, attempt, receiptData, returnReference]);
  const deliver = useCallback(async (share: boolean) => {
    if (!file || locked.current) return;
    locked.current = true; setDelivering(true); setError(''); setMessage('');
    try {
      const outcome = await (share ? shareReceipt(file) : downloadReceipt(file));
      if (!mounted.current) return;
      setMessage(outcome === 'download-fallback' ? 'File sharing is unavailable in this browser. Browser download requested; attach the PDF once saved to your email or message.'
        : outcome === 'downloaded' ? 'Browser download requested; the browser controls the destination and completion.'
        : outcome === 'saved' ? 'Android confirmed a file write to the folder you selected.'
        : outcome === 'share-sheet' ? 'Share sheet opened. Delivery is handled by the app you select.'
        : outcome === 'shared' ? 'PDF handed to the selected app for sharing.' : 'Sharing cancelled. Your receipt is still ready.');
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : 'Unable to export the PDF receipt. Please try again.'); }
    finally { locked.current = false; if (mounted.current) setDelivering(false); }
  }, [file]);
  const print = useCallback(async () => {
    if (locked.current) return;
    locked.current = true; setPrinting(true); setError(''); setMessage('');
    try { await printTransactionReceipt(receiptData, withdrawal, kind, returnReference); if (mounted.current) setMessage('Print dialog opened. Printing is handled by your device or browser.'); }
    catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : 'Unable to open printing. Download the PDF and print it from a PDF viewer.'); }
    finally { locked.current = false; if (mounted.current) setPrinting(false); }
  }, [receiptData, withdrawal, kind, returnReference]);
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  const exportFile = useCallback((options: PdfOptions) => createReceipt(asset, withdrawal, kind, receiptData, returnReference, options), [asset, withdrawal, kind, receiptData, returnReference]);
  return { file, preparing, delivering, printing, error, message, retry, deliver, print, exportFile };
}
