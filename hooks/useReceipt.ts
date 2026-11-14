import { useCallback, useEffect, useRef, useState } from 'react';
import { Asset, Withdrawal } from '@/services/tracker';
import { createReceipt, downloadReceipt, ReceiptFile, ReceiptKind, shareReceipt } from '@/services/receipts';

export function useReceipt(asset: Asset, withdrawal: Withdrawal, kind: ReceiptKind) {
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
    createReceipt(asset, withdrawal, kind).then(result => { if (!cancelled) setFile(result); }).catch(e => {
      if (!cancelled) setError(e instanceof Error ? e.message : 'Unable to generate the PDF receipt. Please try again.');
    }).finally(() => { if (!cancelled) setPreparing(false); });
    return () => { cancelled = true; };
  }, [asset, withdrawal, kind, attempt]);
  const deliver = useCallback(async (share: boolean) => {
    if (!file || locked.current) return;
    locked.current = true; setDelivering(true); setError(''); setMessage('');
    try {
      const outcome = await (share ? shareReceipt(file) : downloadReceipt(file));
      if (!mounted.current) return;
      setMessage(outcome === 'download-fallback' ? 'File sharing is unavailable in this browser. PDF downloaded; attach it to your email or message.'
        : outcome === 'downloaded' ? 'PDF downloaded. It is ready to attach to an email or message.'
        : outcome === 'saved' ? 'PDF saved in this app’s documents. Use Share / send PDF to send it to another app.'
        : outcome === 'share-sheet' ? 'Share sheet opened. Delivery is handled by the app you select.'
        : outcome === 'shared' ? 'PDF handed to the selected app for sharing.' : 'Sharing cancelled. Your receipt is still ready.');
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : 'Unable to export the PDF receipt. Please try again.'); }
    finally { locked.current = false; if (mounted.current) setDelivering(false); }
  }, [file]);
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  return { file, preparing, delivering, error, message, retry, deliver };
}
