import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { extractApiError } from "@/lib/api-errors";
export interface Row extends Record<string, unknown> {
  id: string;
  updatedAt?: string;
  createdAt?: string;
  revision?: number;
  status?: string;
  state?: string;
  name?: string;
  payload?: Record<string, unknown>;
}
export interface PolicyCatalogEntry {
  key: string;
  column: string;
  aliases: string[];
  group: "BASIC_INFORMATION" | "LEGACY_132";
  label?: string;
}
export const basicPolicyLabels: Record<string, string> = {
  name: "Tên hồ sơ",
  crime: "Tội danh",
  caseCode: "Mã hồ sơ",
  deadline: "Thời hạn",
  unit: "Đơn vị",
  investigatorId: "Điều tra viên",
  assignedTeamId: "Đội phụ trách",
  caseType: "Loại hồ sơ",
  status: "Trạng thái pháp lý",
  intakeStage: "Tiếp nhận",
  investigationPhase: "Giai đoạn điều tra",
  sensitivity: "Mức hạn chế hồ sơ",
};
export interface Capabilities {
  actorId?: string;
  enabled?: boolean;
  pendingHandoff?: boolean;
  canEdit?: boolean;
  canWrite?: boolean;
  canDispatch?: boolean;
  canClone?: boolean;
  canExport?: boolean;
  caseAccessMode?: "INTERNAL" | "REPRESENTATION_ONLY";
  operate?: boolean;
  review?: boolean;
  publish?: boolean;
  share?: boolean;
  download?: boolean;
  custody?: boolean;
  dispose?: boolean;
  read_sensitive?: boolean;
  manage_access?: boolean;
}
export interface Snapshot {
  caseId: string;
  updatedAt: string;
  intakeStage?: string | null;
  investigationPhase?: string | null;
  governanceRevision?: number;
  sensitivity?: string;
  governanceRuleVersionId?: string | null;
  fieldDefinitionVersionId?: string | null;
  caseType?: string;
  assignedTeamId?: string | null;
  investigatorId?: string | null;
  handoffs: Row[];
  events: Row[];
}
export interface ReadyAction {
  code: string;
  allowed: boolean;
  ready: boolean;
  reasons: string[];
  requiredFields: string[];
  ruleVersionIds: string[];
}
export interface ActionCatalog {
  code: string;
  label?: string;
  legacyId?: string;
}
export interface WorkspaceData {
  snapshot: Snapshot | null;
  capabilities: Capabilities;
  requests: Row[];
  decisions: Row[];
  actions: ActionCatalog[];
  readiness: ReadyAction[];
  relations: Row[];
  evidence: Record<string, Row[]>;
  rules: Row[];
  errors: string[];
}
export const emptyWorkspace: WorkspaceData = {
  snapshot: null,
  capabilities: {},
  requests: [],
  decisions: [],
  actions: [],
  readiness: [],
  relations: [],
  evidence: {},
  rules: [],
  errors: [],
};
export function label(row: Record<string, unknown>) {
  return String(
    row.title ??
      row.name ??
      row.fullName ??
      ([row.lastName, row.firstName].filter(Boolean).join(" ") ||
        row.username) ??
      row.number ??
      row.code ??
      row.id ??
      "",
  );
}
export function asRows(value: unknown): Row[] {
  if (Array.isArray(value)) return value as Row[];
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (Array.isArray(obj.items)) return obj.items as Row[];
  }
  return [];
}
export function unwrapData(value: unknown): unknown {
  return value && typeof value === "object" && "data" in value
    ? (value as { data: unknown }).data
    : value;
}
export function fieldValue(value: unknown) {
  return value == null ? "" : String(value);
}
export const statusLabels: Record<string, string> = {
  DRAFT: "Dự thảo",
  SUBMITTED: "Chờ thẩm định",
  APPROVED: "Đã phê duyệt",
  REJECTED: "Đã từ chối",
  EXECUTED: "Đã thực hiện",
  PUBLISHED: "Đã công bố",
  VALIDATED: "Đã kiểm tra",
  REVIEWED: "Đã thẩm định",
  SUPERSEDED: "Đã thay thế",
  PENDING: "Chờ nhận",
  ACCEPTED: "Đã nhận",
  CANCELLED: "Đã hủy",
  RETURNED: "Đã trả lại",
  OPEN: "Mới giao",
  IN_PROGRESS: "Đang thực hiện",
  COMPLETED: "Hoàn thành",
  NORMAL: "Thông thường",
  RESTRICTED: "Hạn chế",
  INITIAL: "Điều tra ban đầu",
  RESTORED: "Phục hồi điều tra",
  SUPPLEMENTARY: "Điều tra bổ sung",
  REINVESTIGATION: "Điều tra lại",
  CHO_NHAN: "Chờ tiếp nhận",
  DA_NHAN: "Đã tiếp nhận",
  PHAN_LOAI: "Đã phân loại",
};
export function useLookup(endpoint: string | null, refreshKey = 0) {
  const [state, setState] = useState<{
    endpoint: string | null;
    rows: Row[];
    error: string;
    loading: boolean;
  }>({ endpoint, rows: [], error: "", loading: !!endpoint });
  useEffect(() => {
    let active = true;
    if (!endpoint) return;
    api
      .get<unknown>(endpoint)
      .then((response) => {
        if (active)
          setState({
            endpoint,
            rows: asRows(unwrapData(response.data)),
            error: "",
            loading: false,
          });
      })
      .catch((error) => {
        if (active)
          setState({
            endpoint,
            rows: [],
            error: extractApiError(error).message,
            loading: false,
          });
      });
    return () => {
      active = false;
    };
  }, [endpoint, refreshKey]);
  return state.endpoint === endpoint
    ? state
    : { endpoint, rows: [], error: "", loading: !!endpoint };
}
export function useCommand(refresh: () => Promise<void>) {
  const attempt = useRef<{ signature: string; key: string } | null>(null);
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const run = async (
    path: string,
    body: Record<string, unknown> = {},
    method: "post" | "patch" = "post",
    withKey = true,
  ): Promise<unknown> => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    const signature = JSON.stringify([
      path,
      method,
      Object.fromEntries(
        Object.entries(body).filter(
          ([key]) =>
            ![
              "expectedUpdatedAt",
              "expectedAggregateUpdatedAt",
              "expectedRevision",
              "expectedUserUpdatedAt",
              "expectedCaseAccessRevision",
            ].includes(key),
        ),
      ),
    ]);
    if (!attempt.current || attempt.current.signature !== signature)
      attempt.current = { signature, key: crypto.randomUUID() };
    try {
      const response = await api[method]<{ data: unknown }>(
        path,
        withKey ? { ...body, requestKey: attempt.current.key } : body,
      );
      await refresh();
      attempt.current = null;
      setNotice("Đã ghi nhận. Thông tin hồ sơ và phiên bản đã được tải lại.");
      return response.data.data;
    } catch (cause) {
      const details = extractApiError(cause);
      setError(details.messages.join(" · "));
      return undefined;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  return { busy, error, notice, run };
}
export type Command = ReturnType<typeof useCommand>;
export function can(
  data: WorkspaceData,
  capability: keyof Capabilities,
  pending = false,
) {
  return (
    data.capabilities.enabled === true &&
    data.capabilities[capability] === true &&
    data.capabilities.canEdit !== false &&
    (pending || data.capabilities.pendingHandoff !== true)
  );
}
export function canHandoff(
  data: WorkspaceData,
  action: "send" | "assign" | "accept" | "return" | "cancel",
  row?: Row,
) {
  const caps = data.capabilities;
  if (
    !data.snapshot?.updatedAt ||
    !caps.actorId ||
    caps.caseAccessMode !== "INTERNAL" ||
    caps.operate !== true
  )
    return false;
  if (action === "send" || action === "assign") {
    return (
      caps.enabled === true &&
      caps.canDispatch === true &&
      caps.pendingHandoff !== true &&
      data.snapshot.intakeStage !== "CHO_NHAN" &&
      !data.snapshot.handoffs.some((item) => item.state === "PENDING")
    );
  }
  if (
    !row?.updatedAt ||
    row.state !== "PENDING" ||
    data.snapshot.intakeStage !== "CHO_NHAN"
  )
    return false;
  if (action === "cancel")
    return row.sentById === caps.actorId || caps.canDispatch === true;
  return (
    (action === "return" || caps.enabled === true) &&
    (!row.recipientId || row.recipientId === caps.actorId)
  );
}
export function versions(data: WorkspaceData, row?: Row) {
  return {
    expectedUpdatedAt: data.snapshot?.updatedAt,
    ...(row && {
      expectedAggregateUpdatedAt: row.updatedAt ?? row.createdAt,
      ...(row.revision !== undefined && { expectedRevision: row.revision }),
    }),
  };
}
export function utc(value: string) {
  return value ? new Date(value).toISOString() : undefined;
}
export function localDateTime(value: unknown) {
  if (typeof value !== "string" || !value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const two = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}T${two(date.getHours())}:${two(date.getMinutes())}:${two(date.getSeconds())}`;
}

export {
  Status,
  Panel,
  Field,
  Button,
  Lookup,
  OfficerLookup,
  CommandFeedback,
} from "./shared-ui";

import type { ReceiptFacts } from "./ReceiptChecklist";
export const blankReceipt = (): ReceiptFacts => ({
  receiptChecklist: [],
  shortcomings: "",
});
export const queueLabels: Record<string, string> = {
  pending: "Chờ tiếp nhận",
  assigned: "Được phân công",
  missing: "Thiếu dữ liệu",
  review: "Chờ thẩm định",
  due: "Sắp đến hạn",
  overdue: "Quá hạn",
};
export function downloadArtifact(
  value: unknown,
  filename: string,
  type = "application/json",
) {
  const blob = new Blob(
    [typeof value === "string" ? value : JSON.stringify(value, null, 2)],
    { type },
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function useClock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

export function stripRuntimeFlags(value: object) {
  return Object.fromEntries(
    Object.entries(value).filter(
      ([key]) => !["readable", "writable"].includes(key),
    ),
  );
}
