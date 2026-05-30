import { Users, Briefcase, FileText, ArrowRightLeft, UserCheck } from 'lucide-react';
import {
  createRowActionRegistry,
  type RowAction,
} from '@/features/_shared/row-actions/registry';
import { commonResourceActions } from '@/features/_shared/row-actions/commonResourceActions';

/**
 * v0.63 PR1b — Cases per-row actions registration.
 *
 * Mirrors legacy CaseListPage.tsx:680-885 (commit 2cbdd90^):
 *   View, Edit (from common), then menu actions:
 *     Phân công (canDispatch), Quản lý bị can, Quản lý luật sư,
 *     Kết luận điều tra, Chuyển xử lý, Xóa (TIEP_NHAN only).
 *
 * See docs/audit/shell-parity-matrix.md Cases section.
 */

export interface CaseRowForActions {
  id: string;
  status: string;
  caseCode?: string | null;
  name?: string;
  updatedAt?: string;
  assignedTeamId?: string | null;
}

const TIEP_NHAN = 'TIEP_NHAN';

const cases = createRowActionRegistry<CaseRowForActions>();

const menuActions: RowAction<CaseRowForActions>[] = [
  {
    key: 'assign',
    label: 'Phân công',
    icon: UserCheck,
    position: 'menu',
    visible: (_row, ctx) => ctx.perms.canDispatch === true,
    execute: (row, ctx) =>
      ctx.assignModal.open({
        resourceType: 'cases',
        recordId: row.id,
        currentTeamId: row.assignedTeamId ?? null,
        currentUpdatedAt: row.updatedAt,
      }),
    testid: 'btn-assign',
  },
  {
    key: 'manage-defendants',
    label: 'Quản lý bị can',
    icon: Users,
    position: 'menu',
    execute: (row, ctx) => ctx.navigate(`/cases/${row.id}?tab=defendants`),
    testid: 'btn-manage-defendants',
  },
  {
    key: 'manage-lawyers',
    label: 'Quản lý luật sư',
    icon: Briefcase,
    position: 'menu',
    execute: (row, ctx) => ctx.navigate(`/cases/${row.id}?tab=lawyers`),
    testid: 'btn-manage-lawyers',
  },
  {
    key: 'conclusion',
    label: 'Kết luận điều tra',
    icon: FileText,
    position: 'menu',
    execute: (row, ctx) => ctx.navigate(`/cases/${row.id}?tab=conclusion`),
    testid: 'btn-conclusion',
  },
  {
    key: 'transfer',
    label: 'Chuyển xử lý',
    icon: ArrowRightLeft,
    position: 'menu',
    execute: (row, ctx) =>
      ctx.navigate(`/transfer-return?caseId=${row.id}`),
    testid: 'btn-transfer',
  },
];

cases.registerMany([
  ...commonResourceActions<CaseRowForActions>({
    basePath: '/cases',
    resourceType: 'cases',
    canDelete: (row) =>
      row.status === TIEP_NHAN ? null : 'Chỉ xóa được khi trạng thái = Tiếp nhận',
  }),
  ...menuActions,
]);

export const casesRowActions = cases;
