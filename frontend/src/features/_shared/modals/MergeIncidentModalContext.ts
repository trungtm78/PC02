import { createContext, useContext } from 'react';

export interface MergeIncidentArgs {
  recordId: string;
  currentUpdatedAt?: string;
  onSuccess?: () => void;
}

export interface MergeIncidentModalApi {
  open: (args: MergeIncidentArgs) => void;
}

export const MergeIncidentContext = createContext<MergeIncidentModalApi | null>(null);

export function useMergeIncidentModal(): MergeIncidentModalApi {
  const context = useContext(MergeIncidentContext);
  if (!context) throw new Error('useMergeIncidentModal must be used inside <MergeIncidentModalProvider>');
  return context;
}
