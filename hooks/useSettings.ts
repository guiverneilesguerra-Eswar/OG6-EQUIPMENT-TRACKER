import { useCallback, useState } from 'react';
import { useTracker } from './useTracker';
import { useAudio } from './useAudio';
import type { Settings } from '@/services/tracker';
import { openAlertSoundReference } from '@/services/authorizedAlertSound';
export function useSettings() {
  const tracker = useTracker(); const audioController = useAudio(); const [error, setError] = useState('');
  const [openingReference, setOpeningReference] = useState(false);
  const save = useCallback(async (patch: Partial<Settings>) => {
    setError('');
    try { await tracker.updateSettings(patch); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to save settings.'); }
  }, [tracker.updateSettings]);
  // Opens the original reference externally; never writes settings, selects a file,
  // resets either gain, or interrupts the application's selected audio.
  const openReference = useCallback(async () => {
    setError(''); setOpeningReference(true);
    try { await openAlertSoundReference(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to open the sound reference. Check your connection and try again.'); }
    finally { setOpeningReference(false); }
  }, []);
  return { ...tracker, error, save, audioController, openReference, openingReference };
}
