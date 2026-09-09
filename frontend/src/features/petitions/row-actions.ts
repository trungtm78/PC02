import { UserCheck, Printer } from 'lucide-react';
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

const inChungTu: RowAction<PetitionRowForActions> = {
  key: 'print',
  label: 'In chứng từ',
  icon: Printer,
  // INLINE chứ không nấp trong menu ⋮: in là việc cán bộ làm liên tục, mà từ danh sách hiện
  // giờ KHÔNG in được — phải mở hồ sơ ra mới có nút. Chôn vào menu là vẫn tốn hai lần bấm.
  position: 'inline',
  execute: (row, ctx) => ctx.printModal.open({ entity: 'petitions', entityId: row.id }),
  testid: 'btn-print',
};

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
  inChungTu,
  ...menuActions,
]);

export const petitionsRowActions = petitions;
