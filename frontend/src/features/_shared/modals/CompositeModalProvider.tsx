import type { ReactNode } from 'react';
import { AssignModalProvider } from './AssignModalProvider';
import { DeleteResourceModalProvider } from './DeleteResourceModalProvider';
import { StatusTransitionModalProvider } from './StatusTransitionModalProvider';
import { ProsecuteModalProvider } from './ProsecuteModalProvider';

/**
 * v0.67 PR1 T3 — CompositeModalProvider (Issue I2 from /plan-eng-review).
 *
 * Wraps all modal providers in single mount. App.tsx now mounts 1 component
 * instead of 4 nested. Internal compose is the same (each provider isolated
 * state context), just cleaner tree.
 *
 * Extend slot for PR2 (v0.68) Petitions:
 *   ArchivePetitionModalProvider
 *   ConvertToIncidentModalProvider
 *   ConvertToCaseModalProvider
 */
export function CompositeModalProvider({ children }: { children: ReactNode }) {
  return (
    <AssignModalProvider>
      <DeleteResourceModalProvider>
        <StatusTransitionModalProvider>
          <ProsecuteModalProvider>{children}</ProsecuteModalProvider>
        </StatusTransitionModalProvider>
      </DeleteResourceModalProvider>
    </AssignModalProvider>
  );
}
