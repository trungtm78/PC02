import { createContext, useContext } from 'react';
import type { AssignResourceType } from '@/components/AssignModal';

export interface AssignModalArgs {
  resourceType: AssignResourceType;
  recordId: string;
  currentTeamId?: string | null;
  currentInvestigatorId?: string | null;
  currentUpdatedAt?: string;
  onSuccess?: () => void;
}

export interface AssignModalApi {
  open: (args: AssignModalArgs) => void;
}

export const AssignModalContext = createContext<AssignModalApi | null>(null);

export function useAssignModal(): AssignModalApi {
  const context = useContext(AssignModalContext);
  if (!context) throw new Error('useAssignModal must be used inside <AssignModalProvider>');
  return context;
}
