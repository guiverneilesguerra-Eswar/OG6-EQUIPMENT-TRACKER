import { createContext, ReactNode } from 'react';
import { AlarmPlaybackValue, useAlarmPlayback } from '@/hooks/useAlarmPlayback';
export const AudioContext = createContext<AlarmPlaybackValue | undefined>(undefined);
export function AudioProvider({ children }: { children: ReactNode }) {
  const value = useAlarmPlayback();
  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>;
}
