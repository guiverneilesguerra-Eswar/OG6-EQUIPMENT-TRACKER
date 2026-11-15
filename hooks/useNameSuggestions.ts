import { useCallback, useMemo, useState } from 'react';
import { useTracker } from './useTracker';
import { getNameDirectory, nameKey, NameRole } from '@/services/movements';
export function useNameSuggestions(role: NameRole, value: string, onChange: (value: string) => void) {
  const { data, busy } = useTracker(); const [open, setOpen] = useState(false);
  const entries = useMemo(() => getNameDirectory(data)[role].filter(n => nameKey(n.name).includes(nameKey(value))).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 6), [data.nameDirectory, data.withdrawals, data.returnRecords, role, value]);
  const change = useCallback((text: string) => { onChange(text); setOpen(true); }, [onChange]);
  const choose = useCallback((text: string) => { onChange(text); setOpen(false); }, [onChange]);
  const toggle = useCallback(() => setOpen(v => !v), []);
  return { entries, open, change, choose, toggle, disabled: busy };
}
