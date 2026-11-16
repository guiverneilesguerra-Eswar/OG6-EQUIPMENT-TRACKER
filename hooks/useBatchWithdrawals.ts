import { useCallback, useMemo, useRef, useState } from 'react';
import { randomUUID } from 'expo-crypto';
import { useTracker } from './useTracker';
import type { BatchLine } from '@/services/movements';
import { buildBatch, remainingQuantity, assetCapacity } from '@/services/movements';
import type { Signature } from '@/services/tracker';
import { assetStatus } from '@/services/tracker';
import { exportBatchReceipt } from '@/services/batchReceipts';
export function useBatchWithdrawals() {
  const tracker = useTracker(); const [mode, setMode] = useState<'closed' | 'create' | 'review' | 'receipt' | 'return' | 'return-review'>('closed');
  const [items, setItems] = useState<BatchLine[]>([]); const [query, setQuery] = useState(''); const [requestId, setRequestId] = useState(''); const [batchId, setBatchId] = useState('');
  const [manualName, setManualName] = useState(''); const [manualSerial, setManualSerial] = useState(''); const [manualDescription, setManualDescription] = useState(''); const [manualQuantity, setManualQuantity] = useState('1');
  const [releaser, setReleaser] = useState(''); const [receiver, setReceiverValue] = useState(''); const [signature, setSignatureValue] = useState<Signature>([]); const [saved, setSaved] = useState(false);
  const [withdrawalAt, setWithdrawalAt] = useState(new Date().toISOString()); const [dueAt, setDueAt] = useState(new Date(Date.now() + 86400000).toISOString()); const [remarks, setRemarks] = useState('');
  const [returning, setReturning] = useState(''); const [receiving, setReceiving] = useState(''); const [condition, setCondition] = useState(''); const [returnRemarks, setReturnRemarks] = useState(''); const [returnQuantities, setReturnQuantities] = useState<Record<string, string>>({}); const [returnReference, setReturnReference] = useState('');
  // A separately named, locally constructed callback cannot be shadowed by
  // feedback or a tracker-object spread. Use the authoritative withdrawal data.
  const getEquipmentStatus = useCallback((assetId: string) => assetStatus(assetId, tracker.data.withdrawals, tracker.now), [tracker.data.withdrawals, tracker.now]);
  // Display feedback remains a string and is never invoked by list rows.
  const [error, setError] = useState(''); const [statusMessage, setStatusMessage] = useState(''); const [working, setWorking] = useState(false); const guard = useRef(false);
  const available = useMemo(() => tracker.assets.filter(a => `${a.name} ${a.serial} ${a.notes}`.toLowerCase().includes(query.toLowerCase())), [tracker.assets, query]);
  const batches = tracker.data.batches || []; const batch = batches.find(b => b.id === batchId); const batchItems = tracker.data.withdrawals.filter(w => batch?.withdrawalIds.includes(w.id));
  const begin = useCallback(() => { setItems([]); setQuery(''); setRequestId(`TX-${randomUUID()}`); setReleaser(''); setReceiverValue(''); setSignatureValue([]); setSaved(false); setWithdrawalAt(new Date().toISOString()); setDueAt(new Date(Date.now() + 86400000).toISOString()); setRemarks(''); setError(''); setStatusMessage(''); setReturnReference(''); setMode('create'); }, []);
  const toggle = useCallback((assetId: string) => setItems(current => current.some(i => i.assetId === assetId) ? current.filter(i => i.assetId !== assetId) : [...current, { assetId, quantity: 1 }]), []);
  const changeQuantity = useCallback((assetId: string, value: string) => setItems(current => current.map(i => i.assetId === assetId ? { ...i, quantity: Number(value) } : i)), []);
  const addManual = useCallback(() => { setError(''); if (!manualName.trim() || !manualSerial.trim() || !manualDescription.trim() || !Number.isSafeInteger(Number(manualQuantity)) || Number(manualQuantity) < 1) { setError('Manual equipment requires a name, Serial/Product ID, description and positive whole quantity.'); return; }
    if (items.some(i => i.serial?.trim().toLowerCase() === manualSerial.trim().toLowerCase())) { setError('That manual Serial/Product ID is already selected.'); return; }
    setItems(current => [...current, { assetId: `MAN-${randomUUID()}`, manual: true, name: manualName, serial: manualSerial, description: manualDescription, quantity: Number(manualQuantity) }]); setManualName(''); setManualSerial(''); setManualDescription(''); setManualQuantity('1');
  }, [manualName, manualSerial, manualDescription, manualQuantity, items]);
  const setReceiver = useCallback((value: string) => { setReceiverValue(value); setSignatureValue([]); setSaved(false); }, []);
  const setSignature = useCallback((value: Signature) => { setSignatureValue(value); setSaved(false); }, []);
  const input = { requestId, items, releaser, receiver, signature, withdrawalAt, dueAt, remarks };
  function review() { setError(''); try { if (!saved) throw new Error('Save the receiver signature first.'); buildBatch(tracker.data, input, new Date().toISOString(), p => `${p}-${randomUUID()}`); setMode('review'); } catch (e) { setError(e instanceof Error ? e.message : 'Invalid batch.'); } }
  async function submit() { if (guard.current) return; guard.current = true; setWorking(true); setError(''); try { const recorded = await tracker.withdrawBatch(input); setBatchId(recorded.id); setReturnReference(''); setMode('receipt'); setStatusMessage('Batch withdrawal saved.'); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save batch.'); } finally { guard.current = false; setWorking(false); } }
  const viewBatch = useCallback((id: string) => { setBatchId(id); setReturnReference(''); setError(''); setStatusMessage(''); setMode('receipt'); }, []);
  const beginReturn = useCallback((id: string) => { setBatchId(id); setReturnQuantities({}); setReturning(''); setReceiving(''); setCondition(''); setReturnRemarks(''); setRequestId(`RET-${randomUUID()}`); setReturnReference(''); setError(''); setStatusMessage(''); setMode('return'); }, []);
  const changeReturn = useCallback((id: string, value: string) => setReturnQuantities(current => ({ ...current, [id]: value })), []);
  const selectAllReturns = useCallback(() => setReturnQuantities(Object.fromEntries(batchItems.filter(w => remainingQuantity(w) > 0).map(w => [w.id, String(remainingQuantity(w))]))), [batchItems]);
  function returnLines() { const lines = Object.entries(returnQuantities).filter(([, q]) => q !== '' && Number(q) !== 0).map(([withdrawalId, q]) => ({ withdrawalId, quantity: Number(q) }));
    if (!lines.length) throw new Error('Enter a return quantity for at least one item.');
    for (const line of lines) { const w = batchItems.find(w => w.id === line.withdrawalId); if (!w || !Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > remainingQuantity(w)) throw new Error('Return quantities must be whole numbers within each outstanding balance.'); } return lines;
  }
  function reviewReturn() { setError(''); try { returnLines(); if (!returning.trim() || !receiving.trim() || !condition.trim()) throw new Error('Returning personnel, receiving personnel and condition are required.'); setMode('return-review'); } catch (e) { setError(e instanceof Error ? e.message : 'Invalid return.'); } }
  async function confirmReturn() { if (guard.current) return; guard.current = true; setWorking(true); setError(''); try { await tracker.returnBatch({ requestId, items: returnLines(), returning, receiving, condition, remarks: returnRemarks }); setReturnReference(requestId); setMode('receipt'); setStatusMessage('Return recorded. Unreturned quantities remain OUT and monitored.'); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to record return.'); } finally { guard.current = false; setWorking(false); } }
  async function exportReceipt() { if (guard.current) return; guard.current = true; setWorking(true); setError(''); try { setStatusMessage(await exportBatchReceipt(tracker.data, batchId, returnReference || undefined)); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to export receipt.'); } finally { guard.current = false; setWorking(false); } }
  const close = useCallback(() => { if (!guard.current) setMode('closed'); }, []);
  // Explicit UI contract: do not spread tracker properties into this form model.
  return { colors: tracker.colors, data: tracker.data, busy: tracker.busy, loaded: tracker.loaded, getEquipmentStatus, mode, setMode, items, query, setQuery, requestId, batchId, available, batches, batch, batchItems, begin, toggle, changeQuantity, manualName, setManualName, manualSerial, setManualSerial, manualDescription, setManualDescription, manualQuantity, setManualQuantity, addManual, releaser, setReleaser, receiver, setReceiver, signature, setSignature, saved, setSaved, withdrawalAt, setWithdrawalAt, dueAt, setDueAt, remarks, setRemarks, error, statusMessage, working, review, submit, viewBatch, beginReturn, returning, setReturning, receiving, setReceiving, condition, setCondition, returnRemarks, setReturnRemarks, returnQuantities, changeReturn, selectAllReturns, reviewReturn, confirmReturn, returnReference, setReturnReference, exportReceipt, close, remainingQuantity, assetCapacity };
}
