import { useCallback, useMemo, useRef, useState } from 'react';
import { useTracker } from './useTracker';
import { Asset } from '@/services/tracker';
import { editRequestId, validateEditChanges } from '@/services/authorizedEdits';
import { readScannedInventorySerial, searchInventoryAssets } from '@/services/inventorySearch';

export function useInventory() {
  const tracker = useTracker();
  const [query, setQueryValue] = useState(''); const [sort, setSort] = useState('NAME');
  const [scannedSerial, setScannedSerial] = useState<string | null>(null);
  const setQuery = useCallback((value: string) => { setQueryValue(value); setScannedSerial(null); }, []);
  const applyScannedSerial = useCallback((value: string) => {
    const serial = readScannedInventorySerial(value);
    setQueryValue(serial); setScannedSerial(serial);
  }, []);
  const [formOpen, setFormOpenValue] = useState(false); const [editingId, setEditingId] = useState('');
  const [name, setName] = useState(''); const [serial, setSerial] = useState(''); const [notes, setNotes] = useState('');
  const [editPassword, setEditPassword] = useState(''); const [error, setError] = useState('');
  const [detail, setDetail] = useState<Asset | null>(null); const [deleting, setDeleting] = useState<Asset | null>(null);
  const [submitting, setSubmitting] = useState(false); const saving = useRef(false);
  const pending = useRef<{ fingerprint: string; id: string } | null>(null);
  const rows = useMemo(() => searchInventoryAssets(tracker.assets, query, scannedSerial !== null)
    .sort((a, b) => sort === 'NEWEST' ? b.createdAt.localeCompare(a.createdAt) : sort === 'STATUS' ? tracker.status(a.id).localeCompare(tracker.status(b.id)) : a.name.localeCompare(b.name)),
  [tracker.assets, tracker.data.withdrawals, tracker.now, query, sort, scannedSerial]);
  const setFormOpen = useCallback((visible: boolean) => {
    if (saving.current) return;
    setFormOpenValue(visible);
    if (!visible) setEditPassword('');
  }, []);
  function begin(asset?: Asset) {
    if (!tracker.canOperate || saving.current) return;
    if (asset) {
      setEditingId(asset.id); setName(asset.name); setSerial(asset.serial); setNotes(asset.notes);
    } else if (editingId) {
      setEditingId(''); setName(''); setSerial(''); setNotes('');
    }
    pending.current = null; setEditPassword(''); setError(''); setFormOpenValue(true);
  }
  async function submit() {
    if (saving.current || tracker.busy) return;
    saving.current = true; setSubmitting(true); setError('');
    try {
      if (editingId) {
        validateEditChanges({ name, serial, notes });
        if (!editPassword) throw new Error('Edit password is required.');
        const original = tracker.data.assets.find(asset => asset.id === editingId);
        const fingerprint = JSON.stringify({ original, name: name.trim(), serial: serial.trim(), notes: notes.trim() });
        const request = pending.current?.fingerprint === fingerprint ? pending.current : { fingerprint, id: editRequestId() };
        pending.current = request;
        await tracker.editAsset(editingId, name, serial, notes, editPassword, request.id);
      } else {
        await tracker.addAsset(name, serial, notes);
      }
      setFormOpenValue(false); setEditingId(''); setName(''); setSerial(''); setNotes(''); pending.current = null;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save equipment. Please try again.');
    } finally {
      // The user-entered password is transient and is never saved with device records.
      setEditPassword(''); saving.current = false; setSubmitting(false);
    }
  }
  return { ...tracker, query, setQuery, scannedSerial, applyScannedSerial, sort, setSort, rows, formOpen, setFormOpen, editingId,
    name, setName, serial, setSerial, notes, setNotes, editPassword, setEditPassword,
    submitting, error, detail, setDetail, deleting, setDeleting, begin, submit };
}
