import { useContext } from 'react';
import { CommandAlertContext } from '@/contexts/CommandAlertContext';

export function useAlert() {
  const value = useContext(CommandAlertContext);
  if (!value) throw new Error('useAlert must be used within CommandAlertProvider');
  return value;
}
