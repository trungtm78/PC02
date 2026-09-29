import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { AssignModal } from '@/components/AssignModal';
import { AssignModalContext, type AssignModalApi, type AssignModalArgs } from './AssignModalContext';
export type { AssignModalApi, AssignModalArgs } from './AssignModalContext';

/**
 * v0.62 PR1a — Singleton AssignModal provider.
 *
 * One <AssignModal> mounted at App root, triggered imperatively via
 * useAssignModal().open(args) from anywhere in the tree (registry actions).
 *
 * Per Claude eng review #2: closure stability + no per-row remount.
 */

export function AssignModalProvider({ children }: { children: ReactNode }) {
  const [args, setArgs] = useState<AssignModalArgs | null>(null);

  const open = useCallback((next: AssignModalArgs) => {
    setArgs(next);
  }, []);

  const close = useCallback(() => setArgs(null), []);

  const handleSuccess = useCallback((response: unknown) => {
    args?.onSuccess?.(response);
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
