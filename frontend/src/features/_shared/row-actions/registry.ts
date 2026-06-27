import type { LucideIcon } from 'lucide-react';
import type { NavigateFunction } from 'react-router-dom';

/**
 * v0.62 PR1a — Typed row-action registry primitive.
 *
 * Replaces per-page hooks pattern (rejected at CEO+Eng review).
 * Factory returns a typed registry per resource — preserves TRow type
 * through register/all, no stringly-typed lookup at consumer.
 *
 * See: docs/audit/shell-parity-matrix.md, plan v2 PR1a.
 */

export interface AssignModalOpenArgs {
  resourceType: 'cases' | 'incidents' | 'petitions';
  recordId: string;
  currentTeamId?: string | null;
  // Optimistic-lock: modal đọc args.currentUpdatedAt (trước đây interface đặt sai tên 'updatedAt').
  currentUpdatedAt?: string;
  onSuccess?: () => void;
}

export interface DeleteModalOpenArgs {
  resourceType: 'cases' | 'incidents' | 'petitions' | 'lawyers' | 'subjects';
  recordId: string;
  recordLabel?: string;
  onSuccess?: () => void;
}

/** v0.67 PR1 — incidents-specific modal openers */
export interface StatusTransitionOpenArgs {
  recordId: string;
  currentStatus: string;
  currentUpdatedAt?: string;
  onSuccess?: () => void;
}

export interface ProsecuteOpenArgs {
  recordId: string;
  incidentName: string;
  currentUpdatedAt?: string;
  onSuccess?: (caseId: string) => void;
}

export interface ActionContext {
  navigate: NavigateFunction;
  perms: {
    canDispatch?: boolean;
    canEdit?: boolean;
    canDelete?: boolean;
  };
  assignModal: { open: (args: AssignModalOpenArgs) => void };
  deleteModal: { open: (args: DeleteModalOpenArgs) => void };
  /** v0.67 PR1 — optional Incidents-only modals. Caller must provide
   * if action targets transition/prosecute; otherwise undefined OK. */
  statusTransition?: { open: (args: StatusTransitionOpenArgs) => void };
  prosecute?: { open: (args: ProsecuteOpenArgs) => void };
}

export interface RowAction<TRow> {
  key: string;
  label: string;
  icon: LucideIcon;
  position: 'inline' | 'menu';
  visible?: (row: TRow, ctx: ActionContext) => boolean;
  disabled?: (row: TRow, ctx: ActionContext) => string | null;
  execute: (row: TRow, ctx: ActionContext) => void;
  danger?: boolean;
  testid: string;
}

export interface RowActionRegistry<TRow> {
  register: (action: RowAction<TRow>) => RowActionRegistry<TRow>;
  registerMany: (actions: RowAction<TRow>[]) => RowActionRegistry<TRow>;
  all: () => ReadonlyArray<RowAction<TRow>>;
}

export function createRowActionRegistry<TRow>(): RowActionRegistry<TRow> {
  const actions: RowAction<TRow>[] = [];
  const registry: RowActionRegistry<TRow> = {
    register(action) {
      actions.push(action);
      return registry;
    },
    registerMany(xs) {
      actions.push(...xs);
      return registry;
    },
    all() {
      return actions;
    },
  };
  return registry;
}
