import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useTracker } from './useTracker';
import { Signature, Withdrawal } from '@/services/tracker';
import { randomUUID } from 'expo-crypto';
import { ReceiptKind } from '@/services/receipts';
export function useWithdrawals() {
  const tracker = useTracker();
  const [query, setQuery] = useState(''); const [filter, setFilter] = useState('ACTIVE');
  const params = useLocalSearchParams<{ status?: string }>();
  useEffect(() => { if (params.status && ['ACTIVE', 'OVERDUE', 'DUE SOON', 'RETURNED', 'ALL'].includes(params.status)) setFilter(params.status); }, [params.status]);
  const [open, setOpen] = useState(false); const [source, setSource] = useState('INVENTORY');
  const [assetQuery, setAssetQuery] = useState(''); const [assetId, setAssetId] = useState('');
  const [name, setName] = useState(''); const [serial, setSerial] = useState(''); const [manualNotes, setManualNotes] = useState('');
  const [releaser, setReleaser] = useState(''); const [receiver, setReceiverValue] = useState('');
  const [signature, setSignatureValue] = useState<Signature>([]); const [saved, setSaved] = useState(false);
  const [withdrawalAt, setWithdrawalAt] = useState(new Date().toISOString()); const [dueAt, setDueAt] = useState(new Date(Date.now() + 86400000).toISOString());
  const [notes, setNotes] = useState(''); const [error, setError] = useState(''); const [detail, setDetail] = useState<Withdrawal | null>(null);
  const [returningWithdrawal, setReturningWithdrawal] = useState<Withdrawal | null>(null);
  const [returning, setReturning] = useState(''); const [receiving, setReceiving] = useState(''); const [condition, setCondition] = useState(''); const [remarks, setRemarks] = useState('');
  const [returnError, setReturnError] = useState(''); const [deleting, setDeleting] = useState<Withdrawal | null>(null);
  const [receiptId, setReceiptId] = useState(''); const [receiptKind, setReceiptKind] = useState<ReceiptKind>('withdrawal');
  const saving = useRef(false); const requestId = useRef(`TX-${randomUUID()}`);
  const asset = useCallback((id: string) => tracker.data.assets.find(a => a.id === id), [tracker.data.assets]);
  const rows = useMemo(() => tracker.data.withdrawals.filter(w => {
    if (w.deletedAt) return false;
    const a = asset(w.assetId);
    const matches = `${a?.name} ${a?.serial} ${w.reference || w.id} ${w.receiver} ${w.withdrawalAt} ${w.dueAt}`.toLowerCase().includes(query.toLowerCase());
    if (!matches) return false;
    if (filter === 'ALL') return true;
    if (filter === 'RETURNED') return Boolean(w.returnedAt);
    if (filter === 'OVERDUE') return !w.returnedAt && tracker.status(w.assetId) === 'OVERDUE';
    if (filter === 'DUE SOON') { const remaining = Date.parse(w.dueAt) - tracker.now; return !w.returnedAt && remaining >= 0 && remaining <= tracker.data.settings.warningHours * 3600000; }
    return !w.returnedAt;
  }), [tracker.data.withdrawals, tracker.data.settings.warningHours, tracker.now, tracker.status, asset, query, filter]);
  const available = useMemo(() => tracker.assets.filter(a => `${a.name} ${a.serial}`.toLowerCase().includes(assetQuery.toLowerCase())), [tracker.assets, assetQuery]);
  const receiptWithdrawal = tracker.data.withdrawals.find(w => w.id === receiptId && !w.deletedAt);
  const setReceiver = useCallback((value: string) => { setReceiverValue(value); setSignatureValue([]); setSaved(false); }, []);
  const setSignature = useCallback((value: Signature) => { setSignatureValue(value); setSaved(false); }, []);
  const showReceipt = useCallback((w: Withdrawal, kind: ReceiptKind = w.returnedAt ? 'return' : 'withdrawal') => {
    setOpen(false); setReturningWithdrawal(null); setReceiptKind(kind); setReceiptId(w.id);
  }, []);
  const closeDialog = useCallback(() => { setOpen(false); setReturningWithdrawal(null); setReceiptId(''); }, []);
  async function submit() {
    if (saving.current) return;
    saving.current = true; setError('');
    try {
      if (!saved) throw new Error('Receiver signature is required. Please save the signature.');
      const recorded = await tracker.withdraw({ requestId: requestId.current, assetId, manual: source === 'MANUAL ENTRY', name, serial, manualNotes, releaser, receiver, signature, withdrawalAt, dueAt, notes });
      showReceipt(recorded, 'withdrawal'); requestId.current = `TX-${randomUUID()}`;
      setAssetId(''); setName(''); setSerial(''); setManualNotes(''); setReleaser(''); setReceiver(''); setNotes('');
      setWithdrawalAt(new Date().toISOString()); setDueAt(new Date(Date.now() + 86400000).toISOString());
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save the transaction. Please try again.'); }
    finally { saving.current = false; }
  }
  const beginReturn = useCallback((w: Withdrawal) => {
    setReceiptId(''); setOpen(false); setReturningWithdrawal(w); setReturning(''); setReceiving(''); setCondition(''); setRemarks(''); setReturnError('');
  }, []);
  async function confirmReturn() {
    if (!returningWithdrawal || saving.current) return;
    saving.current = true; setReturnError('');
    try {
      const recorded = await tracker.returnEquipment(returningWithdrawal.id, { returning, receiving, condition, remarks });
      showReceipt(recorded, 'return');
    } catch (e) { setReturnError(e instanceof Error ? e.message : 'Unable to save the return. Please try again.'); }
    finally { saving.current = false; }
  }
  return { ...tracker, query, setQuery, filter, setFilter, rows, open, setOpen, source, setSource, assetQuery, setAssetQuery, assetId, setAssetId, name, setName, serial, setSerial, manualNotes, setManualNotes, releaser, setReleaser, receiver, setReceiver, signature, setSignature, saved, setSaved, withdrawalAt, setWithdrawalAt, dueAt, setDueAt, notes, setNotes, error, detail, setDetail, returningWithdrawal, setReturningWithdrawal, returning, setReturning, receiving, setReceiving, condition, setCondition, remarks, setRemarks, returnError, deleting, setDeleting, available, asset, submit, beginReturn, confirmReturn, receiptWithdrawal, receiptKind, setReceiptKind, showReceipt, closeDialog };
}
