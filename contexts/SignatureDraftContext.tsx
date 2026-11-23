import { createContext, useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { emptySignatureFormDrafts, loadSignatureFormDrafts, saveSignatureFormDrafts } from '@/services/signatureFormDrafts';
import type { SignatureFormDrafts } from '@/services/signatureFormDrafts';
interface SignatureDraftValue {
  drafts: SignatureFormDrafts; updateDrafts: (value: SignatureFormDrafts) => void; persistenceError: string;
}
export const SignatureDraftContext = createContext<SignatureDraftValue | undefined>(undefined);
export function SignatureDraftProvider({ children }: { children: ReactNode }) {
  const [drafts, setDrafts] = useState<SignatureFormDrafts>(emptySignatureFormDrafts);
  const [ready, setReady] = useState(false); const [persistenceError, setPersistenceError] = useState('');
  const writable = useRef(false); const mounted = useRef(true); const serialized = useRef('');
  useEffect(() => {
    mounted.current = true;
    loadSignatureFormDrafts().then(value => {
      if (!mounted.current) return;
      serialized.current = JSON.stringify(value); setDrafts(value); writable.current = true;
    }).catch(() => { if (mounted.current) setPersistenceError('Signature draft recovery is unavailable. Existing saved records are unchanged; draft changes cannot be saved until recovery succeeds.'); })
      .finally(() => { if (mounted.current) setReady(true); });
    return () => { mounted.current = false; };
  }, []);
  const updateDrafts = useCallback((value: SignatureFormDrafts) => {
    const raw = JSON.stringify(value); if (raw === serialized.current) return;
    serialized.current = raw; setDrafts(value);
    if (!writable.current) return;
    void saveSignatureFormDrafts(value).then(() => { if (mounted.current) setPersistenceError(''); })
      .catch(() => { if (mounted.current) setPersistenceError('Signature draft could not be saved on this device. Keep the form open and save the completed transaction before leaving.'); });
  }, []);
  // Hydrate before screens mount so empty defaults never erase a recovered draft.
  return <SignatureDraftContext.Provider value={{ drafts, updateDrafts, persistenceError }}>{ready ? children : null}</SignatureDraftContext.Provider>;
}
