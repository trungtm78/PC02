import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { extractApiError } from "@/lib/api-errors";
import { useCaseCapabilities } from "../useCaseCapabilities";
import { Field, Button } from "./shared";
import { queueLabels } from "./shared";
import { governanceFilterKeys } from "./governance-filters";

export function CaseGovernanceFilters() {
  const [params, setParams] = useSearchParams();
  const access = useCaseCapabilities();
  const [error, setError] = useState("");
  const [catalog, setCatalog] = useState<{ code: string; label: string }[]>([]);
  // Catalog contains actions rather than rows; load it when the structured filter is opened.
  const loadCatalog = async () => {
    try {
      const response = await api.get<{
        data: {
          actions: { code: string; label: string }[];
          additionalActions: string[];
        };
      }>("/cases/governance/catalog");
      setCatalog([
        ...response.data.data.actions,
        ...response.data.data.additionalActions.map((code) => ({
          code,
          label: code,
        })),
      ]);
    } catch (cause) {
      setError(extractApiError(cause).message);
    }
  };
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.set("cases_page", "1");
    setParams(next);
  };
  const selectQueue = async (queue: string) => {
    if (!queue) {
      const next = new URLSearchParams(params);
      next.delete("governanceQueue");
      next.delete("governanceClock");
      setParams(next);
      return;
    }
    try {
      const response = await api.get<{ data: { clock: string } }>(
        "/cases/governance/dashboard",
      );
      const next = new URLSearchParams(params);
      next.set("governanceQueue", queue);
      next.set("governanceClock", response.data.data.clock);
      next.set("cases_page", "1");
      setParams(next);
      setError("");
    } catch (cause) {
      setError(extractApiError(cause).message);
    }
  };
  if (
    access.capabilities.caseAccessMode !== "INTERNAL" ||
    access.capabilities.enabled !== true
  )
    return null;
  return (
    <details
      className="border rounded-lg p-3"
      onToggle={(event) => {
        if (event.currentTarget.open && !catalog.length) void loadCatalog();
      }}
    >
      <summary className="cursor-pointer text-sm font-semibold">
        Lọc quản trị, quyết định và thời hạn
      </summary>
      <div className="grid md:grid-cols-3 gap-3 py-3">
        <Field
          label="Giai đoạn điều tra"
          value={params.get("investigationPhase")}
          options={[
            ["UNKNOWN", "Chưa xác minh"],
            ["INITIAL", "Điều tra ban đầu"],
            ["RESTORED", "Phục hồi"],
            ["SUPPLEMENTARY", "Điều tra bổ sung"],
            ["REINVESTIGATION", "Điều tra lại"],
          ].map(([value, label]) => ({ value, label }))}
          onChange={(value) => set("investigationPhase", value)}
        />
        <Field
          label="Thao tác đã ghi trong lịch sử"
          value={params.get("actionCode")}
          options={catalog.map((action) => ({
            value: action.code,
            label: action.label,
          }))}
          onChange={(value) => set("actionCode", value)}
        />
        <Field
          label="Số quyết định cần tìm"
          value={params.get("decisionNumber")}
          onChange={(value) => set("decisionNumber", value)}
        />
        <Field
          label="Loại quyết định cần tìm"
          value={params.get("decisionType")}
          onChange={(value) => set("decisionType", value)}
        />
        <Field
          label="Mã tài liệu nguồn quyết định"
          value={params.get("decisionSourceDocumentId")}
          onChange={(value) => set("decisionSourceDocumentId", value)}
        />
        <Field
          label="Ngày quyết định từ"
          type="date"
          value={params.get("decisionDateFrom")}
          onChange={(value) => set("decisionDateFrom", value)}
        />
        <Field
          label="Ngày quyết định đến"
          type="date"
          value={params.get("decisionDateTo")}
          onChange={(value) => set("decisionDateTo", value)}
        />
        <Field
          label="Dữ liệu cần bổ sung"
          value={params.get("missingData")}
          options={[
            { value: "true", label: "Còn thiếu dữ liệu" },
            { value: "false", label: "Đủ dữ liệu tối thiểu" },
          ]}
          onChange={(value) => set("missingData", value)}
        />
        <Field
          label="Hàng đợi quản trị"
          value={params.get("governanceQueue")}
          options={Object.entries(queueLabels).map(([value, label]) => ({
            value,
            label,
          }))}
          onChange={(value) => {
            void selectQueue(value);
          }}
        />
      </div>
      {params.get("governanceClock") && (
        <p className="text-xs text-slate-500">
          Thời điểm hàng đợi: {params.get("governanceClock")}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      <Button
        onClick={() => {
          const next = new URLSearchParams(params);
          governanceFilterKeys.forEach((key) => next.delete(key));
          next.set("cases_page", "1");
          setParams(next);
        }}
      >
        Bỏ bộ lọc quản trị
      </Button>
    </details>
  );
}
