import { UserCheck } from 'lucide-react';
import {
  createRowActionRegistry,
  type RowAction,
} from '@/features/_shared/row-actions/registry';
import { commonResourceActions } from '@/features/_shared/row-actions/commonResourceActions';

/**
 * v0.65 PR3 — Petitions per-row actions registration.
 *
 * Mirrors legacy PetitionListPage.tsx:583-720 (commit 2cbdd90^):
 *   View, Edit, Phân công (canDispatch), Xóa.
 *
 * Deferred to PR3-bis (need dedicated modal scaffolding):
 *   - Archive (lưu trữ) action.
 *   - Convert-to-incident action (creates Incident from Petition).
 *   - Convert-to-case action (creates Case from Petition).
 *
 * See docs/audit/shell-parity-matrix.md Petitions section.
 */

export interface PetitionRowForActions {
  id: string;
  status: string;
  stt?: string;
  updatedAt?: string;
  assignedTeamId?: string | null;
  deletedAt?: string | null;
}

const petitions = createRowActionRegistry<PetitionRowForActions>();

const menuActions: RowAction<PetitionRowForActions>[] = [
  {
    key: 'assign',
    label: 'Phân công',
    icon: UserCheck,
    position: 'menu',
    visible: (_row, ctx) => ctx.perms.canDispatch === true,
    execute: (row, ctx) =>
      ctx.assignModal.open({
        resourceType: 'petitions',
        recordId: row.id,
        currentTeamId: row.assignedTeamId ?? null,
        currentUpdatedAt: row.updatedAt,
      }),
    testid: 'btn-assign',
  },
];

petitions.registerMany([
  ...commonResourceActions<PetitionRowForActions>({
    basePath: '/petitions',
    resourceType: 'petitions',
    canDelete: () => null,
  }),
  ...menuActions,
]);

export const petitionsRowActions = petitions;
