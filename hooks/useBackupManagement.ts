import { useCallback, useRef, useState } from 'react';
import { useTracker } from './useTracker';
import { exportBackup, inspectBackup, stageBackupAudio, BackupPreview } from '@/services/backups';
import { pickBackupText } from '@/services/portableFiles';
import { mergeDatabase, backupSummary } from '@/services/backupValidation';
import { discardUncommittedAlertSound } from '@/services/authorizedAlertSound';
import { stopSound } from '@/services/audio';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AuthorizedAlertSound } from '@/services/alertSoundValidation';
export function useBackupManagement() {
  const tracker = useTracker(); const [working, setWorking] = useState(false); const [error, setError] = useState(''); const [status, setStatus] = useState(''); const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [mode, setMode] = useState<'full' | 'merge'>('merge'); const [password, setPassword] = useState(''); const [confirmed, setConfirmed] = useState(false); const [plan, setPlan] = useState(''); const [beforeReview, setBeforeReview] = useState(''); const guard = useRef(false);
  async function exportAll() { if (guard.current) return; guard.current = true; setWorking(true); setError(''); setStatus(''); try { if (!tracker.loaded) throw new Error('Wait for all records to load.'); setStatus(await exportBackup(tracker.data)); } catch (e) { setError(e instanceof Error ? e.message : 'Backup export failed.'); } finally { guard.current = false; setWorking(false); } }
  async function importFile() { if (guard.current) return; guard.current = true; setWorking(true); setError(''); setStatus(''); try { const file = await pickBackupText(); if (!file) return; const parsed = await inspectBackup(file.filename, file.text); setPreview(parsed); setMode('merge'); setPassword(''); setConfirmed(false); setPlan(''); } catch (e) { setError(e instanceof Error ? e.message : 'Backup could not be read.'); } finally { guard.current = false; setWorking(false); } }
  const changeMode = useCallback((value: 'full' | 'merge') => { setMode(value); setConfirmed(false); setPlan(''); setError(''); }, []);
  function reviewPlan() { setError(''); try { if (!preview) return; const next = mode === 'merge' ? mergeDatabase(tracker.data, preview.payload.data) : preview.payload.data; setPlan(backupSummary(next)); setBeforeReview(JSON.stringify(tracker.data)); setConfirmed(true); } catch (e) { setConfirmed(false); setError(e instanceof Error ? e.message : 'Unable to validate restoration plan.'); } }
  async function restore() {
    if (!preview || !confirmed || guard.current) return; guard.current = true; setWorking(true); setError(''); setStatus(''); let staged: AuthorizedAlertSound[] = []; let saved = false;
    try {
      let incoming = preview.payload.data;
      if (mode === 'full') { const result = await stageBackupAudio(preview.payload); incoming = result.data; staged = result.staged; }
      await stopSound(); const result = await tracker.restoreBackup(incoming, mode, password, beforeReview); saved = true; setPreview(null); setPassword(''); setConfirmed(false); setStatus(result);
    } catch (e) { setPassword(''); setConfirmed(false); setPlan(''); setError(e instanceof Error ? e.message : 'Restore failed. Existing records were not changed.'); }
    finally { if (!saved) await Promise.all(staged.map(s => discardUncommittedAlertSound(s).catch(() => {}))); guard.current = false; setWorking(false); }
  }
  async function exportRecovery() {
    if (guard.current) return; guard.current = true; setWorking(true); setError('');
    try { const raw = await AsyncStorage.getItem('og6.recovery.beforeRestore.v1'); if (!raw) throw new Error('No pre-restore recovery snapshot exists on this device.'); setStatus(await exportBackup(JSON.parse(raw))); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to export recovery snapshot.'); } finally { guard.current = false; setWorking(false); }
  }
  const close = useCallback(() => { if (!guard.current) { setPreview(null); setPassword(''); setConfirmed(false); } }, []);
  return { ...tracker, working, error, status, preview, mode, changeMode, password, setPassword, confirmed, plan, reviewPlan, exportAll, importFile, restore, exportRecovery, close };
}
