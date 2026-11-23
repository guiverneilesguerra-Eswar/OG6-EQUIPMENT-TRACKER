import { useCallback, useRef, useState } from 'react';
import { useTracker } from './useTracker';
import type { Withdrawal } from '@/services/tracker';
import { dueItemSnapshot } from '@/services/dueItemEdits';
import type { DueItemChanges } from '@/services/dueItemEdits';
import type { DueEditApproval } from '@/services/dueItemAuthorization';
const emptyChanges: DueItemChanges = { name: '', serial: '', description: '', receiver: '', releaser: '', dueAt: '', notes: '' };
export function useDueItemEditor() {
  const tracker = useTracker(); const [recordId, setRecordId] = useState(''); const [actor, setActor] = useState(''); const [password, setPassword] = useState('');
  const [approval, setApproval] = useState<DueEditApproval | null>(null); const [changes, setChanges] = useState<DueItemChanges>(emptyChanges); const [error, setError] = useState(''); const [working, setWorking] = useState(false); const lock = useRef(false);
  const begin = useCallback((w: Withdrawal) => {
    if (lock.current || tracker.busy || !tracker.canOperate || !tracker.loaded) return;
    try { const before = dueItemSnapshot(tracker.data, w.id); setChanges({ name: before.name, serial: before.serial, description: before.description, receiver: before.receiver, releaser: before.releaser, dueAt: before.dueAt, notes: before.notes }); setRecordId(w.id); setApproval(null); setPassword(''); setActor(''); setError(''); } catch (e) { setError(e instanceof Error ? e.message : 'Item cannot be edited.'); }
  }, [tracker.busy, tracker.canOperate, tracker.loaded, tracker.data]);
  const close = useCallback(() => { if (lock.current || tracker.busy) return; setRecordId(''); setPassword(''); setApproval(null); setError(''); }, [tracker.busy]);
  const change = useCallback((key: keyof DueItemChanges, value: string) => { if (!lock.current && approval) setChanges(c => ({ ...c, [key]: value })); }, [approval]);
  const verify = useCallback(async () => {
    if (lock.current || tracker.busy || !recordId) return;
    lock.current = true; setWorking(true); setError('');
    try { const a = await tracker.prepareDueItemEdit(recordId, actor, password); setApproval(a); setChanges({ name: a.before.name, serial: a.before.serial, description: a.before.description, receiver: a.before.receiver, releaser: a.before.releaser, dueAt: a.before.dueAt, notes: a.before.notes }); }
    catch (e) { setApproval(null); setError(e instanceof Error ? e.message : 'Password verification failed.'); }
    finally { setPassword(''); lock.current = false; setWorking(false); }
  }, [tracker, recordId, actor, password]);
  const save = useCallback(async () => {
    if (lock.current || tracker.busy || !approval) return;
    lock.current = true; setWorking(true); setError('');
    try { await tracker.editDueItem(approval, changes); setRecordId(''); setApproval(null); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to save due item.'); if (Date.parse(approval.expiresAt) <= Date.now()) setApproval(null); }
    finally { setPassword(''); lock.current = false; setWorking(false); }
  }, [tracker, approval, changes]);
  return { recordId, actor, setActor, password, setPassword, approval, changes, change, error, working, begin, close, verify, save, colors: tracker.colors, busy: tracker.busy };
}
