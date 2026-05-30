import { UserCheck } from 'lucide-react';
import {
  createRowActionRegistry,
  type RowAction,
} from '@/features/_shared/row-actions/registry';
import { commonResourceActions } from '@/features/_shared/row-actions/commonResourceActions';

/**
 * v0.64 PR2 — Incidents per-row actions registration.
 *
 * Mirrors legacy IncidentListPage.tsx:573-700 (commit 2cbdd90^):
 *   View, Edit (from common) + Phân công (canDispatch) + Xóa (TIEP_NHAN-only).
 *
 * Deferred to PR2-bis:
 *   - Chuyển trạng thái (needs StatusTransitionModalProvider).
 *   - Khởi tố (needs ProsecuteModalProvider with form fields).
 *
 * See docs/audit/shell-parity-matrix.md Incidents section.
 */

export interface IncidentRowForActions {
  id: string;
  status: string;
  caseCode?: string | null;
  name?: string;
  updatedAt?: string;
  assignedTeamId?: string | null;
}

const TIEP_NHAN = 'TIEP_NHAN';

const incidents = createRowActionRegistry<IncidentRowForActions>();

const menuActions: RowAction<IncidentRowForActions>[] = [
  {
    key: 'assign',
    label: 'Phân công',
    icon: UserCheck,
    position: 'menu',
    visible: (_row, ctx) => ctx.perms.canDispatch === true,
    execute: (row, ctx) =>
      ctx.assignModal.open({
        resourceType: 'incidents',
        recordId: row.id,
        currentTeamId: row.assignedTeamId ?? null,
        currentUpdatedAt: row.updatedAt,
      }),
    testid: 'btn-assign',
  },
];

incidents.registerMany([
  ...commonResourceActions<IncidentRowForActions>({
    basePath: '/vu-viec',
    resourceType: 'incidents',
    canDelete: (row) =>
      row.status === TIEP_NHAN ? null : 'Chỉ xóa được khi trạng thái = Tiếp nhận',
  }),
  ...menuActions,
]);

export const incidentsRowActions = incidents;
