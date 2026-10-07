import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { extractApiError } from "@/lib/api-errors";
import { Link, useSearchParams } from "react-router-dom";
import { HandoffPanel } from "./HandoffPanel";
import { LegalActionsPanel } from "./LegalActionsPanel";
import { EvidencePanel } from "./EvidencePanel";
import { PreservationPanel } from "./PreservationPanel";
import { DisclosurePanel } from "./DisclosurePanel";
import { AccessPanel } from "./AccessPanel";
import { TasksPanel } from "./TasksPanel";
import { SchemaAdoptionPanel } from "./SchemaAdoptionPanel";
import {
  emptyWorkspace,
  type WorkspaceData,
  type Snapshot,
  type Capabilities,
  type Row,
  type ReadyAction,
  type ActionCatalog,
  Status,
  Button,
} from "./shared";

export function CaseGovernanceWorkspace({ caseId }: { caseId: string }) {
  const [data, setData] = useState<WorkspaceData>(emptyWorkspace);
  const [loading, setLoading] = useState(true);
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "handoff";
  const setTab = (value: string) => {
    const next = new URLSearchParams(params);
    next.set("tab", value);
    setParams(next);
  };
  const refresh = useCallback(async () => {
    const paths = [
      `/cases/${caseId}/governance`,
      `/cases/${caseId}/capabilities`,
      `/cases/${caseId}/actions`,
      "/cases/governance/catalog",
      `/cases/${caseId}/actions/capabilities`,
      `/cases/${caseId}/relations`,
      `/cases/${caseId}/evidence-governance`,
      "/cases/governance/rules",
    ];
    const results = await Promise.allSettled(
      paths.map((path) =>
        api.get<{ data: unknown }>(path).then((response) => response.data.data),
      ),
    );
    const value = (index: number) =>
      results[index].status === "fulfilled" ? results[index].value : undefined;
    const actionRows = value(2) as
      | { requests?: Row[]; decisions?: Row[] }
      | undefined;
    const catalog = value(3) as
      | {
          actions?: ActionCatalog[];
          additionalActions?: (ActionCatalog | string)[];
        }
      | undefined;
    const extra = (catalog?.additionalActions ?? []).map((action) =>
      typeof action === "string" ? { code: action } : action,
    );
    setData({
      snapshot: (value(0) as Snapshot) ?? null,
      capabilities: value(0) ? ((value(1) as Capabilities) ?? {}) : {},
      requests: actionRows?.requests ?? [],
      decisions: actionRows?.decisions ?? [],
      actions: [...(catalog?.actions ?? []), ...extra],
      readiness: (value(4) as { actions?: ReadyAction[] })?.actions ?? [],
      relations: (value(5) as Row[]) ?? [],
      evidence: (value(6) as Record<string, Row[]>) ?? {},
      rules: (value(7) as Row[]) ?? [],
      errors: results.flatMap((result, index) =>
        result.status === "rejected"
          ? [
              `Không tải được ${["lịch sử và phiên bản hồ sơ", "quyền thao tác hiện tại", "quyết định", "danh mục nghiệp vụ", "điều kiện thực hiện", "quan hệ hồ sơ", "chứng cứ và cung cấp", "phiên bản quy tắc"][index]}: ${extractApiError(result.reason).message}`,
            ]
          : [],
      ),
    });
    setLoading(false);
  }, [caseId]);
  useEffect(() => {
    void Promise.resolve().then(refresh);
  }, [refresh]);
  const tabs = [
    { id: "handoff", label: "Tiếp nhận và phân công" },
    { id: "legal", label: "Quyết định và tiến trình" },
    { id: "evidence", label: "Chứng cứ và giao nhận" },
    { id: "disclosure", label: "Gói cung cấp và kiểm chứng" },
    { id: "preservation", label: "Bảo toàn và lưu giữ" },
    { id: "access", label: "Đại diện và quyền truy cập" },
    { id: "tasks", label: "Công việc và lịch sử" },
    { id: "schema", label: "Phiên bản thông tin" },
  ];
  return (
    <main className="space-y-5 max-w-7xl mx-auto p-4 md:p-6">
      <Link className="text-blue-700" to={`/cases/${caseId}`}>
        ← Trở về hồ sơ
      </Link>
      <header className="space-y-2">
        <h1 className="text-xl font-bold">Quản trị hồ sơ vụ án</h1>
        <Button
          onClick={() => {
            void refresh();
          }}
        >
          Tải lại hồ sơ và quyền hiện tại
        </Button>
        <div className="flex flex-wrap gap-3 text-sm">
          <span>
            Tiếp nhận: <Status value={data.snapshot?.intakeStage} />
          </span>
          <span>
            Giai đoạn: <Status value={data.snapshot?.investigationPhase} />
          </span>
          <span>
            Phân loại: <Status value={data.snapshot?.sensitivity} />
          </span>
          <span>Phiên bản {data.snapshot?.governanceRevision ?? "—"}</span>
          <span>
            Quy tắc ghim:{" "}
            {data.snapshot?.governanceRuleVersionId ?? "Chưa ghim"}
          </span>
          <span>
            Phiên bản thông tin:{" "}
            {data.snapshot?.fieldDefinitionVersionId ?? "Chưa ghim"}
          </span>
        </div>
      </header>
      {loading ? (
        <p role="status">Đang tải quyền và lịch sử…</p>
      ) : (
        <>
          {data.errors.map((error) => (
            <p key={error} role="alert" className="text-sm text-red-700">
              {error}
            </p>
          ))}
          {data.capabilities.enabled !== true && (
            <p className="rounded bg-amber-50 p-3 text-sm">
              Các lệnh quản trị chưa được bật hoặc chưa xác minh được quyền.
              Lịch sử vẫn được giữ.
            </p>
          )}
          <div role="tablist" className="flex gap-2 overflow-x-auto border-b">
            {tabs.map((item) => (
              <button
                role="tab"
                key={item.id}
                aria-selected={tab === item.id}
                onClick={() => setTab(item.id)}
                className={`whitespace-nowrap p-3 text-sm ${tab === item.id ? "border-b-2 border-blue-600 text-blue-800" : "text-slate-600"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div role="tabpanel">
            {tab === "handoff" && (
              <HandoffPanel caseId={caseId} data={data} refresh={refresh} />
            )}
            {tab === "legal" && (
              <LegalActionsPanel
                caseId={caseId}
                data={data}
                refresh={refresh}
              />
            )}
            {tab === "evidence" && (
              <EvidencePanel caseId={caseId} data={data} refresh={refresh} />
            )}
            {tab === "preservation" && (
              <PreservationPanel
                caseId={caseId}
                data={data}
                refresh={refresh}
              />
            )}
            {tab === "disclosure" && (
              <DisclosurePanel caseId={caseId} data={data} refresh={refresh} />
            )}
            {tab === "access" && (
              <AccessPanel caseId={caseId} data={data} refresh={refresh} />
            )}
            {tab === "tasks" && (
              <TasksPanel caseId={caseId} data={data} refresh={refresh} />
            )}
            {tab === "schema" && (
              <SchemaAdoptionPanel
                caseId={caseId}
                data={data}
                refresh={refresh}
              />
            )}
          </div>
        </>
      )}
    </main>
  );
}
export default CaseGovernanceWorkspace;
