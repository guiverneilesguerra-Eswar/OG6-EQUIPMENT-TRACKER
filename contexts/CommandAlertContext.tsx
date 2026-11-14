import { createContext, ReactNode, useCallback, useState } from 'react';
import { CommandAlert } from '@/components/ui/CommandAlert';

import type { CommandAlertButton, CommandAlertData } from '@/services/alerts';
interface CommandAlertValue { showAlert: (title: string, message?: string, buttons?: CommandAlertButton[]) => void }
export const CommandAlertContext = createContext<CommandAlertValue | undefined>(undefined);
export function CommandAlertProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<CommandAlertData[]>([]);
  const showAlert = useCallback((title: string, message?: string, buttons?: CommandAlertButton[]) => {
    setQueue(current => [...current, { title, message, buttons: buttons?.length ? buttons : [{ text: 'OK' }] }]);
  }, []);
  const choose = useCallback((button?: CommandAlertButton) => {
    setQueue(current => current.slice(1));
    button?.onPress?.();
  }, []);
  return <CommandAlertContext.Provider value={{ showAlert }}>{children}<CommandAlert alert={queue[0] || null} onChoose={choose} /></CommandAlertContext.Provider>;
}
