import { UserCheck, ArrowRightLeft, Scale } from 'lucide-react';
import {
  createRowActionRegistry,
  type RowAction,
} from '@/features/_shared/row-actions/registry';
import { commonResourceActions } from '@/features/_shared/row-actions/commonResourceActions';
import { INCIDENT_VALID_TRANSITIONS } from '@/shared/enums/incident-transitions.generated';

/**
 * v0.64 PR2 — Incidents per-row actions registration.
 * v0.67 PR1 PR2-bis — Add Chuyển trạng thái (transition) + Khởi tố (prosecute).
 *
 * Mirrors legacy IncidentListPage.tsx:573-700 (commit 2cbdd90^):
 *   View, Edit (from common) + Phân công + Chuyển trạng thái +
 *   Khởi tố + Xóa (TIEP_NHAN-only).
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

const PROSECUTE_STATUSES = new Set(['DANG_XAC_MINH', 'DA_PHAN_CONG']);

function hasValidTransitions(status: string): boolean {
  const map = INCIDENT_VALID_TRANSITIONS as Record<string, readonly string[]>;
  return (map[status]?.length ?? 0) > 0;
}

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
  {
    key: 'transition',
    label: 'Chuyển trạng thái',
    icon: ArrowRightLeft,
    position: 'menu',
    visible: (row, ctx) =>
      Boolean(ctx.statusTransition) && hasValidTransitions(row.status),
    execute: (row, ctx) =>
      ctx.statusTransition?.open({
        recordId: row.id,
        currentStatus: row.status,
        currentUpdatedAt: row.updatedAt,
      }),
    testid: 'btn-transition',
  },
  {
    key: 'prosecute',
    label: 'Khởi tố',
    icon: Scale,
    position: 'menu',
    visible: (row, ctx) =>
      Boolean(ctx.prosecute) && PROSECUTE_STATUSES.has(row.status),
    execute: (row, ctx) =>
      ctx.prosecute?.open({
        recordId: row.id,
        incidentName: row.name ?? '',
        currentUpdatedAt: row.updatedAt,
      }),
    testid: 'btn-prosecute',
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
