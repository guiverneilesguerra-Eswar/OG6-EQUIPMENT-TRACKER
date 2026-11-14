import { useCallback, useState } from 'react';
import { useTracker } from './useTracker';
import { useAudio } from './useAudio';
import type { Settings } from '@/services/tracker';
export function useSettings() {
  const tracker = useTracker(); const audioController = useAudio(); const [error, setError] = useState('');
  const save = useCallback(async (patch: Partial<Settings>) => {
    setError('');
    try { await tracker.updateSettings(patch); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to save settings.'); }
  }, [tracker.updateSettings]);
  return { ...tracker, error, save, audioController };
}
