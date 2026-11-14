import { useEffect } from 'react';
import { Platform } from 'react-native';
import { enableAdaptiveOrientation } from '@/services/orientation';

export function useAdaptiveOrientation() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    // Host previews may not expose orientation controls. Dimension-based layouts
    // still work, and installed apps follow the device's auto-rotation setting.
    void enableAdaptiveOrientation().catch(() => undefined);
  }, []);
}
