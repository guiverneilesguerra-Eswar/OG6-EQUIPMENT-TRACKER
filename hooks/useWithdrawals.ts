import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { useTracker } from './useTracker';
import { useSignatureDrafts } from './useSignatureDrafts';
import type { Signature, Withdrawal } from '@/services/tracker';
import { assetStatus, isActive } from '@/services/tracker';
import type { BatchInput, BatchLine, ReturnMovementInput } from '@/services/movements';
import { assetCapacity, remainingQuantity } from '@/services/movements';
import { getTransactionReceiptModel, getTransactionReturns, getWithdrawalItems, validateReturnDraft, validateWithdrawalDraft } from '@/services/withdrawalTransactions';
import type { ReceiptKind } from '@/services/receipts';
import { returnSignatureEntries } from '@/services/returnSignatures';
import { equipmentConditions, filterReturnItems, getOutstandingWithdrawals, selectedReturnLines } from '@/services/returnSelection';

export function useWithdrawals() {
  const tracker = useTracker();
  const { drafts, updateDrafts, persistenceError: draftPersistenceError } = useSignatureDrafts();
  const wd = drafts.withdrawal; const rd = drafts.equipmentReturn;
  const [withdrawalDraftActive, setWithdrawalDraftActive] = useState(Boolean(wd));
  const [returnDraftTarget, setReturnDraftTarget] = useState(rd?.target || '');
  const [signatureInteraction, setSignatureInteraction] = useState(false); const signing = useRef(false);
  const setSignatureInteractionLocked = useCallback((locked: boolean) => { signing.current = locked; setSignatureInteraction(locked); }, []);
  const [query, setQuery] = useState(''); const [filter, setFilter] = useState('ACTIVE');
  const params = useLocalSearchParams<{ status?: string }>();
  useEffect(() => { if (params.status && ['ACTIVE', 'OVERDUE', 'DUE SOON', 'RETURNED', 'ALL'].includes(params.status)) setFilter(params.status); }, [params.status]);
  const [open, setOpen] = useState(false); const [source, setSource] = useState(wd?.source || 'INVENTORY');
  const [equipmentDropdownOpen, setEquipmentDropdownOpen] = useState(false);
  const [assetQuery, setAssetQuery] = useState(''); const [items, setItems] = useState<BatchLine[]>(wd?.items || []);
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>(wd?.quantityDrafts || {});
  const [name, setName] = useState(wd?.name || ''); const [serial, setSerial] = useState(wd?.serial || ''); const [manualNotes, setManualNotes] = useState(wd?.manualNotes || ''); const [manualQuantity, setManualQuantity] = useState(wd?.manualQuantity || '1');
  const [releaser, setReleaser] = useState(wd?.releaser || ''); const [receiver, setReceiverValue] = useState(wd?.receiver || '');
  const [signature, setSignatureValue] = useState<Signature>(wd?.signature || []); const [saved, setSaved] = useState(wd?.saved || false);
  const [withdrawalAt, setWithdrawalAt] = useState(wd?.withdrawalAt || new Date().toISOString()); const [dueAt, setDueAt] = useState(wd?.dueAt || new Date(Date.now() + 86400000).toISOString());
  const [notes, setNotes] = useState(wd?.notes || ''); const [error, setError] = useState(''); const [detail, setDetail] = useState<Withdrawal | null>(null);
  const [requestId, setRequestId] = useState(() => wd?.requestId || `TX-${randomUUID()}`); const [reviewing, setReviewing] = useState(false);
  const [returningWithdrawal, setReturningWithdrawal] = useState<Withdrawal | null>(null);
  const [batchReturn, setBatchReturn] = useState(false); const [returnQuery, setReturnQuery] = useState('');
  const [returnDropdownOpen, setReturnDropdownOpen] = useState(true);
  const [returning, setReturningValue] = useState(rd?.returning || ''); const [receiving, setReceivingValue] = useState(rd?.receiving || ''); const [condition, setCondition] = useState(rd?.condition || ''); const [remarks, setRemarks] = useState(rd?.remarks || '');
  const [receivingSignature, setReceivingSignatureValue] = useState<Signature>(rd?.receivingSignature || []); const [receivingSignatureSaved, setReceivingSignatureSaved] = useState(rd?.receivingSignatureSaved || false);
  const [releasingSignature, setReleasingSignatureValue] = useState<Signature>(rd?.releasingSignature || []); const [releasingSignatureSaved, setReleasingSignatureSaved] = useState(rd?.releasingSignatureSaved || false);
  // Key presence is selection. Blank/zero drafts do not unmount a focused quantity field.
  const [returnQuantities, setReturnQuantities] = useState<Record<string, string>>(rd?.quantities || {}); const [returnRequestId, setReturnRequestId] = useState(rd?.requestId || ''); const [returnReviewing, setReturnReviewing] = useState(false);
  const [returnError, setReturnError] = useState(''); const [deleting, setDeleting] = useState<Withdrawal | null>(null);
  const [receiptId, setReceiptId] = useState(''); const [receiptKind, setReceiptKind] = useState<ReceiptKind>('withdrawal'); const [receiptReturnReference, setReceiptReturnReference] = useState('');
  const [working, setWorking] = useState(false); const saving = useRef(false);
  useEffect(() => {
    updateDrafts({ version: 1,
      withdrawal: withdrawalDraftActive ? { requestId, source, items, quantityDrafts, name, serial, manualNotes, manualQuantity, releaser, receiver, signature, saved, withdrawalAt, dueAt, notes } : null,
      equipmentReturn: returnDraftTarget ? { target: returnDraftTarget, requestId: returnRequestId, quantities: returnQuantities, returning, receiving, condition, remarks, receivingSignature, receivingSignatureSaved, releasingSignature, releasingSignatureSaved } : null,
    });
  }, [withdrawalDraftActive, requestId, source, items, quantityDrafts, name, serial, manualNotes, manualQuantity, releaser, receiver, signature, saved, withdrawalAt, dueAt, notes, returnDraftTarget, returnRequestId, returnQuantities, returning, receiving, condition, remarks, receivingSignature, receivingSignatureSaved, releasingSignature, releasingSignatureSaved, updateDrafts]);
  const getEquipmentStatus = useCallback((assetId: string) => assetStatus(assetId, tracker.data.withdrawals, tracker.now), [tracker.data.withdrawals, tracker.now]);
  const asset = useCallback((id: string) => tracker.data.assets.find(a => a.id === id), [tracker.data.assets]);
  const rows = useMemo(() => tracker.data.withdrawals.filter(w => {
    if (w.deletedAt) return false;
    const a = asset(w.assetId);
    if (!`${w.equipmentSnapshot?.name || a?.name || ''} ${w.equipmentSnapshot?.serial || a?.serial || ''} ${w.assetId} ${w.reference || w.id} ${w.receiver} ${w.withdrawalAt} ${w.dueAt}`.toLowerCase().includes(query.trim().toLowerCase())) return false;
    if (filter === 'ALL') return true;
    if (filter === 'RETURNED') return Boolean(w.returnedAt);
    if (filter === 'OVERDUE') return isActive(w) && Date.parse(w.dueAt) < tracker.now;
    if (filter === 'DUE SOON') { const remaining = Date.parse(w.dueAt) - tracker.now; return isActive(w) && remaining >= 0 && remaining <= tracker.data.settings.warningHours * 3600000; }
    return isActive(w);
  }), [tracker.data.withdrawals, tracker.data.settings.warningHours, tracker.now, asset, query, filter]);
  const available = useMemo(() => tracker.assets.filter(a => `${a.id} ${a.name} ${a.serial} ${a.notes}`.toLowerCase().includes(assetQuery.trim().toLowerCase())), [tracker.assets, assetQuery]);
  const selectedItems = useMemo(() => items.map(item => ({ ...item, quantity: Number(quantityDrafts[item.assetId] ?? '1') })), [items, quantityDrafts]);
  const totalUnits = selectedItems.reduce((sum, item) => sum + (Number.isSafeInteger(item.quantity) && item.quantity > 0 ? item.quantity : 0), 0);
  const receiptWithdrawal = tracker.data.withdrawals.find(w => w.id === receiptId);
  const outstandingItems = useMemo(() => getOutstandingWithdrawals(tracker.data), [tracker.data.withdrawals]);
  const returnItems = useMemo(() => {
    if (batchReturn) return outstandingItems;
    if (!returningWithdrawal) return [];
    try { return getWithdrawalItems(tracker.data, returningWithdrawal).filter(w => remainingQuantity(w) > 0); } catch { return [returningWithdrawal]; }
  }, [tracker.data.withdrawals, tracker.data.batches, returningWithdrawal, batchReturn, outstandingItems]);
  const returnLines = useMemo(() => selectedReturnLines(returnQuantities), [returnQuantities]);
  const returnUnits = returnLines.reduce((sum, line) => sum + (Number.isSafeInteger(line.quantity) && line.quantity > 0 ? line.quantity : 0), 0);
  const visibleReturnItems = useMemo(() => returnReviewing ? returnItems.filter(w => returnLines.some(line => line.withdrawalId === w.id)) : filterReturnItems(tracker.data, returnItems, returnQuery), [tracker.data.assets, returnItems, returnQuery, returnReviewing, returnLines]);
  const selectedReturnItems = useMemo(() => returnItems.filter(w => Object.prototype.hasOwnProperty.call(returnQuantities, w.id)), [returnItems, returnQuantities]);
  const receiptItems = useMemo(() => {
    if (!receiptWithdrawal) return [];
    try { return getTransactionReceiptModel(tracker.data, receiptWithdrawal, receiptKind, receiptReturnReference || undefined).items; } catch { return [receiptWithdrawal]; }
  }, [tracker.data.withdrawals, tracker.data.batches, tracker.data.returnRecords, receiptWithdrawal, receiptKind, receiptReturnReference]);
  const receiptIsBatchReturn = receiptKind === 'return' && new Set(receiptItems.map(w => w.reference || w.batchId || w.id)).size > 1;
  const receiptReturns = useMemo(() => getTransactionReturns(tracker.data, receiptItems), [tracker.data.returnRecords, receiptItems]);
  const receiptReturnOptions = useMemo(() => {
    if (!receiptWithdrawal) return [];
    try {
      const events = getTransactionReturns(tracker.data, getWithdrawalItems(tracker.data, receiptWithdrawal));
      return Array.from(new Map(events.map(r => [r.reference, r])).values());
    } catch { return []; }
  }, [tracker.data.withdrawals, tracker.data.batches, tracker.data.returnRecords, receiptWithdrawal]);
  const receiptReturnSigners = useMemo(() => returnSignatureEntries(receiptReturns.filter(r => r.reference === receiptReturnReference)), [receiptReturns, receiptReturnReference]);
  const setReturning = useCallback((value: string) => { if (saving.current || signing.current) return; setReturningValue(current => { if (current !== value) setReleasingSignatureSaved(false); return value; }); }, []);
  const setReceiving = useCallback((value: string) => { if (saving.current || signing.current) return; setReceivingValue(current => { if (current !== value) setReceivingSignatureSaved(false); return value; }); }, []);
  const setReceivingSignature = useCallback((value: Signature) => { if (saving.current) return; setReceivingSignatureValue(value); setReceivingSignatureSaved(false); }, []);
  const setReleasingSignature = useCallback((value: Signature) => { if (saving.current) return; setReleasingSignatureValue(value); setReleasingSignatureSaved(false); }, []);
  const setReceiver = useCallback((value: string) => { if (saving.current || signing.current) return; setReceiverValue(current => { if (current !== value) setSaved(false); return value; }); }, []);
  const setSignature = useCallback((value: Signature) => { setSignatureValue(value); setSaved(false); }, []);
  const beginWithdrawal = useCallback(() => {
    if (saving.current || signing.current || tracker.busy || !tracker.loaded) return;
    if (withdrawalDraftActive) { setBatchReturn(false); setReturningWithdrawal(null); setReceiptId(''); setOpen(true); setReviewing(false); return; }
    setWithdrawalDraftActive(true); setSignatureValue([]); setSaved(false);
    setBatchReturn(false); setReturningWithdrawal(null); setReceiptId(''); setOpen(true); setReviewing(false); setSource('INVENTORY'); setEquipmentDropdownOpen(true); setAssetQuery(''); setItems([]); setQuantityDrafts({});
    setRequestId(`TX-${randomUUID()}`); setName(''); setSerial(''); setManualNotes(''); setManualQuantity('1'); setReleaser(''); setReceiver(''); setNotes(''); setError('');
    setWithdrawalAt(new Date().toISOString()); setDueAt(new Date(Date.now() + 86400000).toISOString());
  }, [tracker.busy, tracker.loaded, setReceiver, withdrawalDraftActive]);
  const removeItem = useCallback((assetId: string) => { if (saving.current) return; setItems(current => current.filter(i => i.assetId !== assetId)); setQuantityDrafts(current => { const next = { ...current }; delete next[assetId]; return next; }); }, []);
  const toggleEquipment = useCallback((assetId: string) => {
    if (saving.current || tracker.busy) return;
    if (items.some(i => i.assetId === assetId)) { removeItem(assetId); return; }
    const record = asset(assetId);
    if (!record || record.archivedAt || getEquipmentStatus(assetId) !== 'IN' || assetCapacity(record) < 1) { setError('This equipment is OUT or unavailable. It cannot be selected.'); return; }
    if (items.length >= 200) { setError('Select no more than 200 equipment items per transaction.'); return; }
    setItems(current => [...current, { assetId, quantity: 1 }]); setQuantityDrafts(current => ({ ...current, [assetId]: '1' })); setError('');
  }, [tracker.busy, items, asset, getEquipmentStatus, removeItem]);
  const changeQuantity = useCallback((assetId: string, value: string) => { if (!saving.current) setQuantityDrafts(current => ({ ...current, [assetId]: value })); }, []);
  const addManual = useCallback(() => {
    if (saving.current || tracker.busy) return;
    setError('');
    const count = Number(manualQuantity); const normalizedSerial = serial.trim().toLowerCase();
    if (!name.trim() || !serial.trim() || !manualNotes.trim() || !Number.isSafeInteger(count) || count < 1 || count > 1000000) { setError('Manual equipment needs a name, Serial/Product ID, description and a positive whole quantity up to 1,000,000.'); return; }
    if (name.length > 200 || serial.length > 200 || manualNotes.length > 10000) { setError('Name/Serial must be at most 200 characters and description at most 10,000.'); return; }
    if (items.length >= 200) { setError('Select no more than 200 equipment items per transaction.'); return; }
    if (items.some(i => (i.serial || asset(i.assetId)?.serial || '').trim().toLowerCase() === normalizedSerial)) { setError('This equipment is already selected. Edit its quantity in the selected list.'); return; }
    const existing = tracker.data.assets.find(a => a.serial.trim().toLowerCase() === normalizedSerial);
    if (existing && (existing.archivedAt || getEquipmentStatus(existing.id) !== 'IN' || count > assetCapacity(existing) || existing.name.trim().toLowerCase() !== name.trim().toLowerCase())) { setError('This Serial/Product ID belongs to unavailable equipment, a different name, or insufficient inventory quantity.'); return; }
    const assetId = existing?.id || `MAN-${randomUUID()}`;
    setItems(current => [...current, existing ? { assetId, quantity: count } : { assetId, manual: true, name: name.trim(), serial: serial.trim(), description: manualNotes.trim(), quantity: count }]);
    setQuantityDrafts(current => ({ ...current, [assetId]: String(count) })); setName(''); setSerial(''); setManualNotes(''); setManualQuantity('1');
  }, [tracker.busy, tracker.data.assets, manualQuantity, serial, name, manualNotes, items, asset, getEquipmentStatus]);
  const showReceipt = useCallback((w: Pick<Withdrawal, 'id' | 'returnedAt'>, kind: ReceiptKind = w.returnedAt ? 'return' : 'withdrawal', returnReference = '') => {
    let selectedReturn = returnReference;
    if (kind === 'return' && !selectedReturn) {
      const record = tracker.data.withdrawals.find(item => item.id === w.id);
      if (record) {
        try {
          const events = getTransactionReturns(tracker.data, getWithdrawalItems(tracker.data, record));
          selectedReturn = events.find(event => event.withdrawalId === w.id)?.reference || events[0]?.reference || '';
        } catch { selectedReturn = ''; }
      }
    }
    setBatchReturn(false); setOpen(false); setReturningWithdrawal(null); setReviewing(false); setReturnReviewing(false); setReceiptKind(kind); setReceiptReturnReference(selectedReturn); setReceiptId(w.id);
  }, [tracker.data.withdrawals, tracker.data.batches, tracker.data.returnRecords]);
  const closeDialog = useCallback(() => { if (saving.current || signing.current || tracker.busy) return; setBatchReturn(false); setOpen(false); setReturningWithdrawal(null); setReceiptId(''); setReviewing(false); setReturnReviewing(false); setReceiptReturnReference(''); }, [tracker.busy]);
  const draftInput = (): BatchInput => ({ requestId, items: selectedItems, releaser, receiver, signature, withdrawalAt, dueAt, remarks: notes });
  function reviewWithdrawal() {
    if (saving.current || signing.current || tracker.busy) return;
    setError('');
    try {
      if (name.trim() || serial.trim() || manualNotes.trim()) throw new Error('Add the manual equipment to the selected list, or clear the manual fields before review.');
      validateWithdrawalDraft(tracker.data, draftInput(), saved); setEquipmentDropdownOpen(false); setReviewing(true);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to review the withdrawal.'); }
  }
  async function submit() {
    if (!reviewing || saving.current || signing.current || tracker.busy) return;
    saving.current = true; setWorking(true); setError('');
    try {
      const input = draftInput(); validateWithdrawalDraft(tracker.data, input, saved);
      const recorded = await tracker.withdrawTransaction(input);
      showReceipt({ id: recorded.withdrawalIds[0] }, 'withdrawal'); setWithdrawalDraftActive(false); setItems([]); setQuantityDrafts({}); setSignatureValue([]); setSaved(false);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save the withdrawal. Existing records were not changed.'); }
    finally { saving.current = false; setWorking(false); }
  }
  const beginReturn = useCallback((w: Withdrawal) => {
    if (saving.current || signing.current || tracker.busy) return;
    if (returnDraftTarget === w.id) { setBatchReturn(false); setReceiptId(''); setOpen(false); setReturningWithdrawal(w); setReturnReviewing(false); setReturnDropdownOpen(true); return; }
    setReturnDraftTarget(w.id); setReceivingSignatureValue([]); setReceivingSignatureSaved(false); setReleasingSignatureValue([]); setReleasingSignatureSaved(false);
    setBatchReturn(false); setReturnQuery(''); setReturnDropdownOpen(true); setReceiptId(''); setOpen(false); setReturningWithdrawal(w); setReturning(''); setReceiving(''); setCondition(''); setRemarks(''); setReturnError(''); setReturnReviewing(false); setReturnRequestId(`RET-${randomUUID()}`); setReturnQuantities({ [w.id]: String(remainingQuantity(w)) });
  }, [tracker.busy, setReturning, setReceiving, returnDraftTarget]);
  const beginBatchReturn = useCallback(() => {
    if (saving.current || signing.current || tracker.busy || !tracker.loaded || !outstandingItems.length) return;
    if (returnDraftTarget === 'batch') { setOpen(false); setReceiptId(''); setReturningWithdrawal(null); setBatchReturn(true); setReturnReviewing(false); setReturnDropdownOpen(true); return; }
    setReturnDraftTarget('batch'); setReceivingSignatureValue([]); setReceivingSignatureSaved(false); setReleasingSignatureValue([]); setReleasingSignatureSaved(false);
    setOpen(false); setReceiptId(''); setReturningWithdrawal(null); setBatchReturn(true); setReturnQuery(''); setReturnDropdownOpen(true); setReturnQuantities({});
    setReturning(''); setReceiving(''); setCondition(''); setRemarks(''); setReturnError(''); setReturnReviewing(false); setReturnRequestId(`RET-${randomUUID()}`);
  }, [tracker.busy, tracker.loaded, outstandingItems.length, setReturning, setReceiving, returnDraftTarget]);
  const changeReturnQuantity = useCallback((id: string, value: string) => { if (!saving.current) setReturnQuantities(current => ({ ...current, [id]: value })); }, []);
  const selectAllReturns = useCallback(() => { if (!saving.current) setReturnQuantities(Object.fromEntries(returnItems.map(w => [w.id, String(remainingQuantity(w))]))); }, [returnItems]);
  const clearReturnSelection = useCallback(() => { if (!saving.current) setReturnQuantities({}); }, []);
  const toggleReturnItem = useCallback((id: string) => {
    if (saving.current || tracker.busy) return;
    const item = returnItems.find(w => w.id === id); if (!item) return;
    setReturnQuantities(current => {
      const next = { ...current };
      if (Object.prototype.hasOwnProperty.call(next, id)) delete next[id];
      else next[id] = String(remainingQuantity(item));
      return next;
    });
  }, [returnItems, tracker.busy]);
  function returnInput(): ReturnMovementInput {
    if (!receivingSignatureSaved) throw new Error('Receiving personnel signature is required. Please sign and save the signature.');
    const lines = selectedReturnLines(returnQuantities);
    if (selectedReturnItems.some(w => !returnQuantities[w.id]?.trim() || Number(returnQuantities[w.id]) === 0)) throw new Error('Enter a positive whole quantity for each selected item, or remove it from the selected list.');
    if (lines.some(line => !returnItems.some(w => w.id === line.withdrawalId))) throw new Error('An item is no longer outstanding. Reopen the return form.');
    if (releasingSignature.length && !releasingSignatureSaved) throw new Error('Save the releaser signature, or explicitly clear it before reviewing.');
    return { requestId: returnRequestId, items: lines, returning, receiving, condition, remarks, receivingSignature, ...(releasingSignature.length ? { releasingSignature } : {}) };
  }
  function reviewReturn() {
    if (saving.current || signing.current || tracker.busy) return;
    setReturnError(''); try { validateReturnDraft(tracker.data, returnInput()); setReturnDropdownOpen(false); setReturnReviewing(true); } catch (e) { setReturnError(e instanceof Error ? e.message : 'Unable to review the return.'); }
  }
  async function confirmReturn() {
    if ((!returningWithdrawal && !batchReturn) || !returnReviewing || saving.current || signing.current || tracker.busy) return;
    saving.current = true; setWorking(true); setReturnError('');
    try {
      const input = returnInput(); validateReturnDraft(tracker.data, input);
      const anchor = tracker.data.withdrawals.find(w => w.id === input.items[0]?.withdrawalId);
      if (!anchor) throw new Error('Select at least one outstanding equipment item.');
      await tracker.returnItems(input); showReceipt(anchor, 'return', input.requestId); setReturnDraftTarget(''); setReceivingSignatureValue([]); setReceivingSignatureSaved(false); setReleasingSignatureValue([]); setReleasingSignatureSaved(false);
    }
    catch (e) { setReturnError(e instanceof Error ? e.message : 'Unable to save the return. Existing records were not changed.'); }
    finally { saving.current = false; setWorking(false); }
  }
  return { ...tracker, signatureInteraction, setSignatureInteractionLocked, draftPersistenceError, releasingSignature, setReleasingSignature, releasingSignatureSaved, setReleasingSignatureSaved, getEquipmentStatus, query, setQuery, filter, setFilter, rows, open, beginWithdrawal, source, setSource, equipmentDropdownOpen, setEquipmentDropdownOpen, assetQuery, setAssetQuery, items: selectedItems, quantityDrafts, toggleEquipment, removeItem, changeQuantity, totalUnits, name, setName, serial, setSerial, manualNotes, setManualNotes, manualQuantity, setManualQuantity, addManual, releaser, setReleaser, receiver, setReceiver, signature, setSignature, saved, setSaved, withdrawalAt, setWithdrawalAt, dueAt, setDueAt, notes, setNotes, error, detail, setDetail, returningWithdrawal, batchReturn, beginBatchReturn, returnQuery, setReturnQuery, returnDropdownOpen, setReturnDropdownOpen, selectedReturnItems, outstandingItems, visibleReturnItems, returnLines, returnUnits, clearReturnSelection, toggleReturnItem, equipmentConditions, receiptIsBatchReturn, returning, setReturning, receivingSignature, setReceivingSignature, receivingSignatureSaved, setReceivingSignatureSaved, receiving, setReceiving, condition, setCondition, remarks, setRemarks, returnError, deleting, setDeleting, available, asset, assetCapacity, remainingQuantity, requestId, reviewing, setReviewing, reviewWithdrawal, submit, beginReturn, returnItems, returnQuantities, changeReturnQuantity, selectAllReturns, returnRequestId, returnReviewing, setReturnReviewing, reviewReturn, confirmReturn, receiptWithdrawal, receiptItems, receiptReturns, receiptReturnOptions, receiptReturnSigners, receiptKind, setReceiptKind, receiptReturnReference, setReceiptReturnReference, showReceipt, closeDialog, working };
}
