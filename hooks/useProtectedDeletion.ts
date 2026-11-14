import { useCallback, useEffect, useRef, useState } from 'react';
import { ArchiveApproval, ArchiveKind } from '@/services/archival';
import { useTracker } from './useTracker';

interface Options { visible: boolean; kind: ArchiveKind; recordId: string; onClose: () => void }
export function useProtectedDeletion({ visible, kind, recordId, onClose }: Options) {
  const tracker = useTracker();
  const [password, setPassword] = useState('');
  const [phase, setPhase] = useState<'password' | 'confirm' | 'done'>('password');
  const [approval, setApproval] = useState<ArchiveApproval | null>(null);
  const [error, setError] = useState(''); const [working, setWorking] = useState(false);
  const running = useRef(false); const generation = useRef(0);
  useEffect(() => { generation.current += 1; setPassword(''); setApproval(null); setPhase('password'); setError(''); setWorking(false);
    return () => { generation.current += 1; };
  }, [visible, kind, recordId]);
  const close = useCallback(() => { if (running.current) return; setPassword(''); setApproval(null); onClose(); }, [onClose]);
  const reset = useCallback(() => { if (running.current) return; setPassword(''); setApproval(null); setPhase('password'); setError(''); }, []);
  const authorize = useCallback(async () => {
    if (!visible || !recordId || running.current || tracker.busy || !tracker.canOperate) return;
    running.current = true; setWorking(true); setError(''); const attempt = generation.current;
    try { const result = await tracker.prepareArchive(kind, recordId, password);
      if (generation.current === attempt) { setApproval(result); setPhase('confirm'); }
    } catch (failure) { if (generation.current === attempt) setError(failure instanceof Error ? failure.message : 'Unable to verify the administrator password. No records were changed.'); }
    finally { running.current = false; if (generation.current === attempt) { setPassword(''); setWorking(false); } }
  }, [visible, recordId, tracker.busy, tracker.canOperate, tracker.prepareArchive, kind, password]);
  const confirm = useCallback(async () => {
    if (!approval || running.current || tracker.busy || !tracker.canOperate) return;
    running.current = true; setWorking(true); setError(''); const attempt = generation.current;
    try { await tracker.archiveRecord(approval); if (generation.current === attempt) { setApproval(null); setPhase('done'); } }
    catch (failure) { if (generation.current === attempt) setError(failure instanceof Error ? failure.message : 'Unable to archive the record. Please retry.'); }
    finally { running.current = false; if (generation.current === attempt) setWorking(false); }
  }, [approval, tracker.archiveRecord, tracker.busy, tracker.canOperate]);
  return { colors: tracker.colors, canOperate: tracker.canOperate, busy: tracker.busy || working, password, setPassword, phase, error, authorize, confirm, close, reset };
}
