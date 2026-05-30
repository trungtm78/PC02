import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { AssignModal, type AssignResourceType } from '@/components/AssignModal';

/**
 * v0.62 PR1a — Singleton AssignModal provider.
 *
 * One <AssignModal> mounted at App root, triggered imperatively via
 * useAssignModal().open(args) from anywhere in the tree (registry actions).
 *
 * Per Claude eng review #2: closure stability + no per-row remount.
 */

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

const AssignModalContext = createContext<AssignModalApi | null>(null);

export function AssignModalProvider({ children }: { children: ReactNode }) {
  const [args, setArgs] = useState<AssignModalArgs | null>(null);

  const open = useCallback((next: AssignModalArgs) => {
    setArgs(next);
  }, []);

  const close = useCallback(() => setArgs(null), []);

  const handleSuccess = useCallback(() => {
    args?.onSuccess?.();
    close();
  }, [args, close]);

  const api = useMemo<AssignModalApi>(() => ({ open }), [open]);

  return (
    <AssignModalContext.Provider value={api}>
      {children}
      {args && (
        <AssignModal
          open
          onClose={close}
          resourceType={args.resourceType}
          recordId={args.recordId}
          currentTeamId={args.currentTeamId ?? null}
          currentInvestigatorId={args.currentInvestigatorId ?? null}
          currentUpdatedAt={args.currentUpdatedAt}
          onSuccess={handleSuccess}
        />
      )}
    </AssignModalContext.Provider>
  );
}

export function useAssignModal(): AssignModalApi {
  const ctx = useContext(AssignModalContext);
  if (!ctx) {
    throw new Error(
      'useAssignModal must be used inside <AssignModalProvider>',
    );
  }
  return ctx;
}
