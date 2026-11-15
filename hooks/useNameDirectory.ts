import { useMemo, useRef, useState } from 'react';
import { useTracker } from './useTracker';
import { getNameDirectory, NameEntry, NameRole, nameKey } from '@/services/movements';
export function useNameDirectory() {
  const tracker = useTracker(); const [role, setRole] = useState<NameRole>('releasers'); const [query, setQuery] = useState(''); const [selected, setSelected] = useState<NameEntry | null>(null); const [draft, setDraft] = useState(''); const [password, setPassword] = useState(''); const [remove, setRemove] = useState(false); const [working, setWorking] = useState(false); const [error, setError] = useState(''); const [status, setStatus] = useState(''); const guard = useRef(false);
  const entries = useMemo(() => getNameDirectory(tracker.data)[role].filter(n => nameKey(n.name).includes(nameKey(query))).sort((a, b) => a.name.localeCompare(b.name)), [tracker.data.nameDirectory, tracker.data.withdrawals, role, query]);
  function begin(entry: NameEntry) { setSelected(entry); setDraft(entry.name); setPassword(''); setRemove(false); setError(''); setStatus(''); }
  async function save() { if (!selected || guard.current) return; guard.current = true; setWorking(true); setError(''); try { await tracker.manageSavedName(role, selected.id, remove ? null : draft, password); setSelected(null); setPassword(''); setStatus('Name directory updated. Historical transactions were not changed.'); } catch (e) { setPassword(''); setError(e instanceof Error ? e.message : 'Name update failed.'); } finally { guard.current = false; setWorking(false); } }
  function close() { if (!guard.current) { setSelected(null); setPassword(''); } }
  return { ...tracker, role, setRole, query, setQuery, entries, selected, draft, setDraft, password, setPassword, remove, setRemove, working, error, status, begin, save, close };
}
