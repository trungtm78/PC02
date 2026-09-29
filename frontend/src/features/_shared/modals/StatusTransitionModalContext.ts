import { createContext, useContext } from 'react';

export interface StatusTransitionArgs {
  recordId: string;
  currentStatus: string;
  currentUpdatedAt?: string;
  onSuccess?: () => void;
}

export interface StatusTransitionModalApi {
  open: (args: StatusTransitionArgs) => void;
}

export const StatusTransitionContext = createContext<StatusTransitionModalApi | null>(null);

export function useStatusTransitionModal(): StatusTransitionModalApi {
  const context = useContext(StatusTransitionContext);
  if (!context) {
    throw new Error('useStatusTransitionModal must be used inside <StatusTransitionModalProvider>');
  }
  return context;
}
