import { useContext } from 'react';
import { SignatureDraftContext } from '@/contexts/SignatureDraftContext';
export function useSignatureDrafts() {
  const context = useContext(SignatureDraftContext);
  if (!context) throw new Error('useSignatureDrafts must be used within SignatureDraftProvider');
  return context;
}
