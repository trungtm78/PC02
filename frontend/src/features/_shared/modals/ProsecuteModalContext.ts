import { createContext, useContext } from 'react';

export interface ProsecuteArgs {
  recordId: string;
  incidentName: string;
  currentUpdatedAt?: string;
  onSuccess?: (caseId: string) => void;
}

export interface ProsecuteModalApi {
  open: (args: ProsecuteArgs) => void;
}

export const ProsecuteContext = createContext<ProsecuteModalApi | null>(null);

export function useProsecuteModal(): ProsecuteModalApi {
  const context = useContext(ProsecuteContext);
  if (!context) {
    throw new Error('useProsecuteModal must be used inside <ProsecuteModalProvider>');
  }
  return context;
}
