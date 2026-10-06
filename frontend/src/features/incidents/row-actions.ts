import {
  UserCheck,
  ArrowRightLeft,
  Scale,
  Printer,
  Combine,
} from "lucide-react";
import {
  createRowActionRegistry,
  type RowAction,
} from "@/features/_shared/row-actions/registry";
import { commonResourceActions } from "@/features/_shared/row-actions/commonResourceActions";
import { INCIDENT_VALID_TRANSITIONS } from "@/shared/enums/incident-transitions.generated";
import { canProsecuteIncident } from "./incident-business-readiness";

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
  intakeStage?: string | null;
  caseCode?: string | null;
  name?: string;
  updatedAt?: string;
  assignedTeamId?: string | null;
}

const TIEP_NHAN = "TIEP_NHAN";

const incidents = createRowActionRegistry<IncidentRowForActions>();

function hasValidTransitions(status: string): boolean {
  const map = INCIDENT_VALID_TRANSITIONS as Record<string, readonly string[]>;
  return (map[status]?.length ?? 0) > 0;
}

const inChungTu: RowAction<IncidentRowForActions> = {
  key: "print",
  label: "In chứng từ",
  icon: Printer,
  // INLINE chứ không nấp trong menu ⋮: in là việc cán bộ làm liên tục, mà từ danh sách hiện
  // giờ KHÔNG in được — phải mở hồ sơ ra mới có nút. Chôn vào menu là vẫn tốn hai lần bấm.
  position: "inline",
  execute: (row, ctx) =>
    ctx.printModal.open({ entity: "incidents", entityId: row.id }),
  testid: "btn-print",
};

const menuActions: RowAction<IncidentRowForActions>[] = [
  {
    key: "assign",
    label: "Phân công",
    icon: UserCheck,
    position: "menu",
    visible: (row, ctx) =>
      (!row.intakeStage || row.intakeStage === "DA_NHAN") &&
      ctx.perms.canDispatch === true,
    execute: (row, ctx) =>
      ctx.assignModal.open({
        resourceType: "incidents",
        recordId: row.id,
        currentTeamId: row.assignedTeamId ?? null,
        currentUpdatedAt: row.updatedAt,
      }),
    testid: "btn-assign",
  },
  {
    key: "transition",
    label: "Chuyển trạng thái",
    icon: ArrowRightLeft,
    position: "menu",
    visible: (row, ctx) =>
      (!row.intakeStage || row.intakeStage === "DA_NHAN") &&
      ctx.perms.canEdit === true &&
      Boolean(ctx.statusTransition) &&
      hasValidTransitions(row.status),
    execute: (row, ctx) =>
      ctx.statusTransition?.open({
        recordId: row.id,
        currentStatus: row.status,
        currentUpdatedAt: row.updatedAt,
      }),
    testid: "btn-transition",
  },
  {
    key: "merge",
    label: "Nhập vào vụ việc khác",
    icon: Combine,
    position: "menu",
    visible: (row, ctx) =>
      (!row.intakeStage || row.intakeStage === "DA_NHAN") &&
      Boolean(ctx.mergeIncident) &&
      ctx.perms.canEdit === true &&
      (
        (INCIDENT_VALID_TRANSITIONS as Record<string, readonly string[]>)[
          row.status
        ] ?? []
      ).includes("DA_NHAP_VU_KHAC"),
    execute: (row, ctx) =>
      ctx.mergeIncident?.open({
        recordId: row.id,
        currentUpdatedAt: row.updatedAt,
      }),
    testid: "btn-merge-incident",
  },
  {
    key: "prosecute",
    label: "Khởi tố",
    icon: Scale,
    position: "menu",
    visible: (row, ctx) =>
      ctx.perms.canEdit === true &&
      Boolean(ctx.prosecute) &&
      canProsecuteIncident(row),
    execute: (row, ctx) =>
      ctx.prosecute?.open({
        recordId: row.id,
        incidentName: row.name ?? "",
        currentUpdatedAt: row.updatedAt,
      }),
    testid: "btn-prosecute",
  },
];

incidents.registerMany([
  ...commonResourceActions<IncidentRowForActions>({
    basePath: "/vu-viec",
    resourceType: "incidents",
    canDelete: (row) =>
      row.intakeStage === "CHO_NHAN"
        ? "Hồ sơ đang chờ nhận"
        : row.status === TIEP_NHAN
          ? null
          : "Chỉ xóa được khi trạng thái = Tiếp nhận",
  }).map((action) =>
    action.key === "edit"
      ? {
          ...action,
          disabled: (row: IncidentRowForActions) =>
            row.intakeStage === "CHO_NHAN" ? "Hồ sơ đang chờ nhận" : null,
        }
      : action,
  ),
  inChungTu,
  ...menuActions,
]);

export const incidentsRowActions = incidents;
