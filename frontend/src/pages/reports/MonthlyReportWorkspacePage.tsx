import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  FileCheck2,
  Loader2,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { api } from "@/lib/api";

type Status =
  | "DRAFT"
  | "NEEDS_VERIFICATION"
  | "REVIEWING"
  | "APPROVED"
  | "FINALIZED"
  | "REJECTED";
type Issue = {
  code: string;
  severity: "WARNING" | "ERROR";
  message?: string;
  field?: string;
};
type Row = {
  recordId: string;
  recordCode?: string;
  cells: Record<string, unknown>;
  issues?: Issue[];
};
type Metric = {
  key: string;
  value: number;
  contributionIds: string[];
  issues?: Issue[];
};
type Appendix = {
  code: string;
  kind: "DETAIL" | "SUMMARY";
  rows: Row[];
  metrics: Metric[];
  issues?: Issue[];
};
type Report = {
  id: string;
  status: Status;
  version: number;
  periodStart: string;
  periodEnd: string;
  unitName: string;
  teamIds?: string[];
  summary: {
    appendixCount: number;
    detailRowCount: number;
    unresolvedIssueCount: number;
    warningCount?: number;
    failedCheckCount: number;
  };
  snapshot: { appendices: Appendix[] };
  checks: Array<{
    appendix: string;
    key: string;
    formula: string;
    passed: boolean;
    expected: number;
    actual: number;
  }>;
};
type Contribution = {
  id: string;
  entityType: string;
  entityId: string;
  entityCode?: string;
  label: string;
  eventAt?: string;
  value: number;
  ruleCode: string;
  snapshot?: unknown;
};
type ReportIssue = Issue & {
  appendix: string;
  target: string;
  entityId?: string;
  metricKey?: string;
  kind: "APPENDIX" | "ROW" | "METRIC" | "CHECK";
};

const APPENDICES = [
  ["PL01", "Hồ sơ vụ việc hiện hành"],
  ["PL02", "Vụ việc TĐC hết thời hiệu"],
  ["PL03", "Vụ việc TĐC còn thời hiệu"],
  ["PL04", "Hồ sơ vụ án hiện hành"],
  ["PL05", "Vụ án TĐC hết thời hiệu"],
  ["PL06", "Vụ án TĐC còn thời hiệu"],
  ["PL07", "Thống kê TĐC vụ việc"],
  ["PL08", "Thống kê TĐC vụ án"],
] as const;
const STATUS: Record<Status, { label: string; className: string }> = {
  DRAFT: { label: "Nháp", className: "bg-slate-100 text-slate-700" },
  NEEDS_VERIFICATION: {
    label: "Cần xác minh",
    className: "bg-amber-100 text-amber-800",
  },
  REVIEWING: { label: "Đang duyệt", className: "bg-blue-100 text-blue-800" },
  APPROVED: { label: "Đã duyệt", className: "bg-emerald-100 text-emerald-800" },
  FINALIZED: { label: "Đã chốt", className: "bg-[#003973] text-white" },
  REJECTED: { label: "Đã trả lại", className: "bg-red-100 text-red-800" },
};
const METRIC_LABELS: Record<string, string> = {
  "1": "Tồn đầu kỳ",
  "2": "Tạm đình chỉ trong kỳ",
  "3": "Phục hồi trong kỳ",
  "4": "Đình chỉ trong kỳ",
  "5": "Tồn cuối kỳ",
  "1.case": "Tồn đầu kỳ · số vụ",
  "1.subject": "Tồn đầu kỳ · số bị can",
  "2.case": "TĐC trong kỳ · số vụ",
  "2.subject": "TĐC trong kỳ · số bị can",
  "3.case": "Phục hồi · số vụ",
  "3.subject": "Phục hồi · số bị can",
  "4.case": "Đình chỉ · số vụ",
  "4.subject": "Đình chỉ · số bị can",
  "5.case": "Tồn cuối kỳ · số vụ",
  "5.subject": "Tồn cuối kỳ · số bị can",
};

function monthValue(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
function period(month: string) {
  const [year, m] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return {
    start: `${month}-01T00:00:00.000+07:00`,
    end: `${month}-${String(lastDay).padStart(2, "0")}T23:59:59.999+07:00`,
  };
}
function titlePeriod(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  }).formatToParts(new Date(value));
  return `${parts.find((item) => item.type === "month")?.value}/${parts.find((item) => item.type === "year")?.value}`;
}
function display(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Có" : "Không";
  return String(value);
}

export default function MonthlyReportWorkspacePage() {
  const [params, setParams] = useSearchParams();
  const [month, setMonth] = useState(params.get("month") ?? monthValue());
  const [unitName, setUnitName] = useState("PC02");
  const [teamIds, setTeamIds] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [reportList, setReportList] = useState<
    Array<
      Pick<Report, "id" | "periodStart" | "unitName" | "version" | "status">
    >
  >([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [drawer, setDrawer] = useState<{
    appendix: string;
    metric: Metric;
    cellKey?: string;
    entityId?: string;
  } | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<ReportIssue | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [issueAppendix, setIssueAppendix] = useState("ALL");
  const [issueSeverity, setIssueSeverity] = useState("ALL");
  const activeCode = params.get("appendix") ?? "PL01";

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      let id = params.get("reportId");
      if (!id) {
        const list = await api.get("/reports/monthly-packages");
        setReportList(list.data ?? []);
        id = list.data?.[0]?.id;
      } else {
        const list = await api.get("/reports/monthly-packages");
        setReportList(list.data ?? []);
      }
      if (id) {
        const response = await api.get(`/reports/monthly-packages/${id}`);
        setReport(response.data);
        setMonth(
          new Intl.DateTimeFormat("en-CA", {
            year: "numeric",
            month: "2-digit",
            timeZone: "Asia/Ho_Chi_Minh",
          }).format(new Date(response.data.periodStart)),
        );
        setUnitName(response.data.unitName);
        setTeamIds((response.data.teamIds ?? []).join(","));
        if (params.get("reportId") !== id)
          setParams(
            (current) => {
              current.set("reportId", id!);
              return current;
            },
            { replace: true },
          );
      } else setReport(null);
    } catch {
      setError(
        "Không tải được không gian báo cáo. Kiểm tra quyền truy cập và thử lại.",
      );
    } finally {
      setLoading(false);
    }
  }, [params, setParams]);
  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    setWorking(true);
    setError("");
    try {
      const range = period(month);
      const response = await api.post("/reports/monthly-packages", {
        periodStart: range.start,
        periodEnd: range.end,
        unitName,
        teamIds: teamIds
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
        templateVersion: "2026.09",
      });
      setReport(response.data);
      setParams({ reportId: response.data.id, appendix: "PL01", month });
    } catch {
      setError(
        "Không lập được báo cáo. Hãy kiểm tra kỳ, phạm vi tổ và dữ liệu nguồn.",
      );
    } finally {
      setWorking(false);
    }
  };
  const transition = async (action: string) => {
    if (!report) return;
    setWorking(true);
    setError("");
    try {
      const response = await api.post(
        `/reports/monthly-packages/${report.id}/${action}`,
        {},
      );
      setReport((old) => (old ? { ...old, ...response.data } : response.data));
    } catch {
      setError(
        "Không thể chuyển trạng thái. Báo cáo có thể còn dữ liệu cần xác minh hoặc bạn chưa đủ quyền.",
      );
    } finally {
      setWorking(false);
    }
  };
  const openDrill = (metric: Metric, cellKey?: string, entityId?: string) =>
    setDrawer({ appendix: activeCode, metric, cellKey, entityId });
  const download = async (kind: "detail" | "summary" | "verification") => {
    if (!report) return;
    const response = await api.get(
      `/reports/monthly-packages/${report.id}/${kind === "verification" ? "verification" : `export/${kind}`}`,
      { responseType: "blob" },
    );
    const url = URL.createObjectURL(response.data);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download =
      kind === "verification"
        ? "goi-kiem-chung.json"
        : `bao-cao-thang-${kind}.xlsx`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const active = report?.snapshot.appendices.find(
    (item) => item.code === activeCode,
  );
  const issues = useMemo<ReportIssue[]>(
    () =>
      report
        ? [
            ...report.snapshot.appendices.flatMap((appendix) => [
              ...(appendix.issues ?? []).map((issue) => ({
                appendix: appendix.code,
                target: "Phạm vi phụ lục",
                kind: "APPENDIX" as const,
                ...issue,
              })),
              ...appendix.rows.flatMap((row) =>
                (row.issues ?? []).map((issue) => ({
                  appendix: appendix.code,
                  target: row.recordCode ?? row.recordId,
                  entityId: row.recordId,
                  kind: "ROW" as const,
                  ...issue,
                })),
              ),
              ...appendix.metrics.flatMap((metric) =>
                (metric.issues ?? []).map((issue) => ({
                  appendix: appendix.code,
                  target: metric.key,
                  metricKey: metric.key,
                  kind: "METRIC" as const,
                  ...issue,
                })),
              ),
            ]),
            ...report.checks
              .filter((check) => !check.passed)
              .map((check) => ({
                appendix: check.appendix,
                target: check.key,
                metricKey: check.key,
                kind: "CHECK" as const,
                code: "FORMULA_MISMATCH",
                severity: "ERROR" as const,
                message: `${check.formula}: phải bằng ${check.expected}, hiện là ${check.actual}`,
              })),
          ]
        : [],
    [report],
  );
  const filteredIssues = useMemo(
    () =>
      issues.filter(
        (issue) =>
          (issueAppendix === "ALL" || issue.appendix === issueAppendix) &&
          (issueSeverity === "ALL" || issue.severity === issueSeverity),
      ),
    [issueAppendix, issueSeverity, issues],
  );

  if (loading)
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-[#003973]">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Đang mở báo cáo
      </div>
    );
  return (
    <main className="min-h-screen bg-[#F7F6F2] p-3 text-[#172033] md:p-6">
      <div className="mx-auto max-w-[1600px]">
        <header className="border-b-2 border-[#003973] pb-4">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#456477]">
                <FileCheck2 className="h-4 w-4" /> Hồ sơ báo cáo đã lưu phiên
                bản
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-bold tracking-[-0.025em] text-[#172033]">
                  Báo cáo tháng{" "}
                  {report
                    ? titlePeriod(report.periodStart)
                    : month.split("-").reverse().join("/")}
                </h1>
                {report && (
                  <span
                    className={`rounded-full px-3 py-1 text-sm font-semibold ${STATUS[report.status].className}`}
                  >
                    {STATUS[report.status].label}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-[#5C6875]">
                {report
                  ? `${report.unitName} · Phiên bản ${report.version}`
                  : "Chọn kỳ và phạm vi để tạo gói báo cáo 8 phụ lục."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {reportList.length > 0 && (
                <select
                  aria-label="Chọn phiên bản báo cáo"
                  value={report?.id ?? ""}
                  onChange={(e) =>
                    setParams({
                      reportId: e.target.value,
                      appendix: activeCode,
                    })
                  }
                  className="rounded-lg border border-[#9BAFBA] bg-white px-3 py-2 text-sm font-semibold"
                >
                  {reportList.map((item) => (
                    <option key={item.id} value={item.id}>
                      {titlePeriod(item.periodStart)} · v{item.version} ·{" "}
                      {STATUS[item.status].label}
                    </option>
                  ))}
                </select>
              )}
              {report?.status === "DRAFT" && (
                <button
                  onClick={() => transition("submit")}
                  className="rounded-lg bg-[#003973] px-4 py-2.5 text-sm font-semibold text-white"
                >
                  Gửi duyệt
                </button>
              )}
              {report?.status === "REVIEWING" && (
                <button
                  onClick={() => transition("approve")}
                  className="rounded-lg bg-[#003973] px-4 py-2.5 text-sm font-semibold text-white"
                >
                  Phê duyệt
                </button>
              )}
              {(report?.status === "REVIEWING" ||
                report?.status === "APPROVED") && (
                <button
                  onClick={() => setRejectOpen(true)}
                  className="rounded-lg border border-red-300 bg-white px-4 py-2.5 text-sm font-semibold text-red-700"
                >
                  Trả lại
                </button>
              )}
              {report?.status === "APPROVED" && (
                <button
                  onClick={() => transition("finalize")}
                  className="rounded-lg bg-[#003973] px-4 py-2.5 text-sm font-semibold text-white"
                >
                  Chốt báo cáo
                </button>
              )}
              {report?.status === "REJECTED" && (
                <button
                  onClick={() => transition("reopen")}
                  className="rounded-lg bg-[#003973] px-4 py-2.5 text-sm font-semibold text-white"
                >
                  Mở lại bản nháp
                </button>
              )}
              {report && (
                <details className="relative">
                  <summary className="list-none cursor-pointer rounded-lg border border-[#9BAFBA] bg-white px-4 py-2.5 text-sm font-semibold">
                    Tải xuống
                  </summary>
                  <div className="absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-lg border bg-white shadow-xl">
                    <button
                      onClick={() => download("detail")}
                      className="block w-full px-4 py-3 text-left text-sm hover:bg-[#EEF3F6]"
                    >
                      Workbook phụ lục 01–06
                    </button>
                    <button
                      onClick={() => download("summary")}
                      className="block w-full px-4 py-3 text-left text-sm hover:bg-[#EEF3F6]"
                    >
                      Workbook phụ lục 07–08
                    </button>
                    <button
                      onClick={() => download("verification")}
                      className="block w-full px-4 py-3 text-left text-sm hover:bg-[#EEF3F6]"
                    >
                      Gói kiểm chứng dữ liệu
                    </button>
                  </div>
                </details>
              )}
            </div>
          </div>
        </header>

        <section
          aria-label="Kỳ báo cáo"
          className="mt-4 grid gap-3 border border-[#D8DEE2] bg-white p-3 shadow-[0_1px_0_rgba(0,57,115,.05)] sm:grid-cols-2 lg:grid-cols-[180px_1fr_1fr_auto]"
        >
          <label className="text-xs font-semibold text-[#52616B]">
            Tháng
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="mt-1 block w-full rounded-md border border-[#BCC8CE] px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-[#52616B]">
            Đơn vị
            <input
              value={unitName}
              onChange={(e) => setUnitName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-[#BCC8CE] px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-[#52616B]">
            Phạm vi tổ
            <input
              value={teamIds}
              onChange={(e) => setTeamIds(e.target.value)}
              placeholder="Để trống: theo quyền được cấp"
              className="mt-1 block w-full rounded-md border border-[#BCC8CE] px-3 py-2 text-sm"
            />
          </label>
          <button
            disabled={working}
            onClick={create}
            className="self-end rounded-md bg-[#003973] px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {working
              ? "Đang tính…"
              : report
                ? report.status === "FINALIZED"
                  ? "Tạo phiên bản điều chỉnh"
                  : "Tính lại thành phiên bản mới"
                : "Lập báo cáo tháng"}
          </button>
        </section>
        {error && (
          <div
            role="alert"
            className="mt-3 flex items-center gap-2 border-l-4 border-red-600 bg-red-50 p-3 text-sm text-red-800"
          >
            <AlertTriangle className="h-4 w-4" />
            {error}
          </div>
        )}

        {report && (
          <>
            <section className="my-4 grid grid-cols-2 gap-px overflow-hidden border border-[#D4DCE0] bg-[#D4DCE0] lg:grid-cols-4">
              {[
                [
                  "Hồ sơ trong 01–06",
                  report.summary.detailRowCount,
                  "Tập hồ sơ chi tiết",
                ],
                [
                  "Ô cần xác minh",
                  report.summary.unresolvedIssueCount,
                  report.summary.unresolvedIssueCount
                    ? "Cần xử lý trước khi gửi duyệt"
                    : "Đã đủ nguồn",
                ],
                [
                  "Đối soát lỗi",
                  report.summary.failedCheckCount,
                  report.summary.failedCheckCount
                    ? "Phương trình chưa cân"
                    : "Các phương trình đã cân",
                ],
                [
                  "Tiến độ",
                  report.status === "FINALIZED"
                    ? "100%"
                    : report.status === "APPROVED"
                      ? "80%"
                      : report.status === "REVIEWING"
                        ? "60%"
                        : "25%",
                  STATUS[report.status].label,
                ],
              ].map(([label, value, note]) => (
                <div key={label} className="bg-white p-4">
                  <p className="text-sm text-[#5C6875]">{label}</p>
                  <p className="mt-1 text-3xl font-bold tabular-nums text-[#003973]">
                    {value}
                  </p>
                  <p className="mt-1 text-xs text-[#70808A]">{note}</p>
                </div>
              ))}
            </section>

            <nav
              aria-label="Các phụ lục"
              className="overflow-x-auto border-y border-[#CCD6DB] bg-white"
            >
              <div className="flex min-w-max">
                {APPENDICES.map(([code, label], index) => {
                  const appendix = report.snapshot.appendices.find(
                    (item) => item.code === code,
                  );
                  const count =
                    appendix?.kind === "DETAIL"
                      ? appendix.rows.length
                      : appendix?.metrics.length;
                  return (
                    <button
                      key={code}
                      aria-label={`Phụ lục ${code.slice(2)}: ${label}`}
                      onClick={() =>
                        setParams((current) => {
                          current.set("appendix", code);
                          return current;
                        })
                      }
                      className={`min-w-[170px] border-r border-[#E0E5E8] px-4 py-3 text-left ${activeCode === code ? "border-b-4 border-b-[#003973] bg-[#EEF3F6]" : "hover:bg-[#F8FAFB]"}`}
                    >
                      <span className="block text-xs font-bold text-[#4D6877]">
                        {index < 3
                          ? "VỤ VIỆC"
                          : index < 6
                            ? "VỤ ÁN"
                            : code === "PL07"
                              ? "VỤ VIỆC"
                              : "VỤ ÁN"}{" "}
                        · {code}
                      </span>
                      <span className="mt-1 block max-w-[170px] truncate text-sm font-semibold">
                        {label}
                      </span>
                      <span className="mt-1 text-xs text-[#6B7880]">
                        {count ?? 0}{" "}
                        {appendix?.kind === "DETAIL" ? "dòng" : "chỉ tiêu"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </nav>

            <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
              <section
                className="min-w-0 border border-[#CFD8DD] bg-white"
                aria-label={`Nội dung ${activeCode}`}
              >
                <div className="flex items-center justify-between border-b border-[#D7E0E4] px-4 py-3">
                  <div>
                    <h2 className="font-bold">
                      {APPENDICES.find(([code]) => code === activeCode)?.[1]}
                    </h2>
                    <p className="text-xs text-[#6A7880]">
                      Số liệu từ snapshot của phiên bản {report.version}
                    </p>
                  </div>
                  <span className="rounded bg-[#EEF3F6] px-2 py-1 text-xs font-semibold text-[#003973]">
                    {activeCode}
                  </span>
                </div>
                {active?.kind === "DETAIL" ? (
                  <DetailTable
                    rows={active.rows}
                    onOpen={(row, cellKey) =>
                      openDrill(
                        { key: "ROW", value: 1, contributionIds: [] },
                        cellKey,
                        row.recordId,
                      )
                    }
                  />
                ) : (
                  <MetricTable
                    metrics={active?.metrics ?? []}
                    onOpen={openDrill}
                  />
                )}
              </section>
              <aside className="border border-[#D3DCE0] bg-white xl:sticky xl:top-4">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <h2 className="font-bold">Khay vấn đề</h2>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                    {issues.length}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 border-b p-2">
                  <label className="text-[11px] font-semibold text-[#61717A]">
                    Phụ lục
                    <select
                      value={issueAppendix}
                      onChange={(event) => setIssueAppendix(event.target.value)}
                      className="mt-1 w-full rounded border px-2 py-1.5 text-xs font-normal"
                    >
                      <option value="ALL">Tất cả</option>
                      {APPENDICES.map(([code]) => (
                        <option key={code} value={code}>
                          {code}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-[11px] font-semibold text-[#61717A]">
                    Mức độ
                    <select
                      value={issueSeverity}
                      onChange={(event) => setIssueSeverity(event.target.value)}
                      className="mt-1 w-full rounded border px-2 py-1.5 text-xs font-normal"
                    >
                      <option value="ALL">Tất cả</option>
                      <option value="ERROR">Bắt buộc xử lý</option>
                      <option value="WARNING">Cảnh báo</option>
                    </select>
                  </label>
                </div>
                <div className="max-h-[500px] overflow-y-auto p-2">
                  {issues.length === 0 ? (
                    <div className="p-6 text-center text-sm text-[#60717B]">
                      <ShieldCheck className="mx-auto mb-2 h-7 w-7 text-emerald-600" />
                      Không còn vấn đề cần xử lý.
                    </div>
                  ) : filteredIssues.length === 0 ? (
                    <p className="p-6 text-center text-sm text-[#60717B]">
                      Không có vấn đề khớp bộ lọc.
                    </p>
                  ) : (
                    filteredIssues.map((issue, index) => (
                      <button
                        key={`${issue.appendix}-${issue.target}-${index}`}
                        onClick={() => {
                          setParams((current) => {
                            current.set("appendix", issue.appendix);
                            return current;
                          });
                          setSelectedIssue(issue);
                        }}
                        className="mb-2 flex w-full gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-left"
                      >
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                        <span>
                          <strong className="block text-sm">
                            {issue.appendix} · {issue.target}
                          </strong>
                          <span className="text-xs text-amber-900">
                            {issue.message ?? issue.code}
                          </span>
                        </span>
                        <ChevronRight className="ml-auto h-4 w-4" />
                      </button>
                    ))
                  )}
                </div>
              </aside>
            </div>
          </>
        )}
      </div>
      {drawer && report && (
        <DrilldownDrawer
          reportId={report.id}
          appendix={drawer.appendix}
          metric={drawer.metric}
          cellKey={drawer.cellKey}
          entityId={drawer.entityId}
          periodLabel={titlePeriod(report.periodStart)}
          onClose={() => setDrawer(null)}
        />
      )}
      {selectedIssue && report && (
        <VerificationDialog
          issue={selectedIssue}
          working={working}
          onClose={() => setSelectedIssue(null)}
          onSave={async (payload) => {
            setWorking(true);
            setError("");
            try {
              const response = await api.post(
                `/reports/monthly-packages/${report.id}/adjustments`,
                payload,
              );
              setReport(response.data.report);
              setSelectedIssue(null);
            } catch {
              setError(
                "Không lưu được xác minh. Điều chỉnh số lượng phải có hồ sơ nguồn và chứng cứ.",
              );
            } finally {
              setWorking(false);
            }
          }}
        />
      )}
      {rejectOpen && report && (
        <RejectDialog
          working={working}
          onClose={() => setRejectOpen(false)}
          onSave={async (reason) => {
            setWorking(true);
            setError("");
            try {
              const response = await api.post(
                `/reports/monthly-packages/${report.id}/reject`,
                { reason },
              );
              setReport((old) =>
                old ? { ...old, ...response.data } : response.data,
              );
              setRejectOpen(false);
            } catch {
              setError(
                "Không thể trả lại báo cáo. Hãy kiểm tra quyền và trạng thái hiện tại.",
              );
            } finally {
              setWorking(false);
            }
          }}
        />
      )}
    </main>
  );
}

function VerificationDialog({
  issue,
  working,
  onClose,
  onSave,
}: {
  issue: ReportIssue;
  working: boolean;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const numeric = issue.kind === "METRIC" || issue.kind === "CHECK";
  const rebuildRequired = issue.code.startsWith("STATUTORY_EXPIRY_REQUIRED");
  const [operation, setOperation] = useState<"ADD" | "REMOVE" | "CONFIRM">(
    "ADD",
  );
  const [targetKey, setTargetKey] = useState(issue.metricKey ?? issue.target);
  const [entityId, setEntityId] = useState(issue.entityId ?? "");
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState("");
  const [replacement, setReplacement] = useState("");
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-[#172033]/45 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Xác minh số liệu"
        className="w-full max-w-lg bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between border-b p-4">
          <div>
            <p className="text-xs font-bold text-[#527080]">
              {issue.appendix} · {issue.target}
            </p>
            <h2 className="mt-1 text-xl font-bold">Xác minh số liệu</h2>
          </div>
          <button
            aria-label="Đóng xác minh"
            onClick={onClose}
            className="rounded border p-2"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="space-y-4 p-4">
          <p className="rounded bg-amber-50 p-3 text-sm text-amber-900">
            {issue.message ?? issue.code}
          </p>
          {rebuildRequired && (
            <div className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
              <p>
                Thời hiệu quyết định cả phụ lục và chỉ tiêu thống kê. Hãy bổ
                sung trường này tại hồ sơ nguồn, sau đó chọn “Tính lại thành
                phiên bản mới”.
              </p>
              {issue.entityId && (
                <a
                  href={
                    Number(issue.appendix.slice(2)) <= 3
                      ? `/incidents/${issue.entityId}`
                      : `/cases/${issue.entityId}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block font-semibold underline"
                >
                  Mở hồ sơ nguồn
                </a>
              )}
            </div>
          )}
          {numeric && (
            <>
              <label className="block text-sm font-semibold">
                Chỉ tiêu nhận điều chỉnh
                <input
                  value={targetKey}
                  onChange={(e) => setTargetKey(e.target.value)}
                  placeholder="Ví dụ: 2.1 hoặc 5.7.3"
                  className="mt-1 block w-full rounded-md border px-3 py-2 font-normal"
                />
              </label>
              <label className="block text-sm font-semibold">
                Cách xử lý
                <select
                  value={operation}
                  onChange={(e) =>
                    setOperation(e.target.value as "ADD" | "REMOVE" | "CONFIRM")
                  }
                  className="mt-1 block w-full rounded-md border px-3 py-2 font-normal"
                >
                  <option value="ADD">Bổ sung hồ sơ/sự kiện (+1)</option>
                  <option value="REMOVE">Loại hồ sơ/sự kiện (−1)</option>
                  <option value="CONFIRM">
                    Xác nhận tổng hiện tại sau đối chiếu
                  </option>
                </select>
              </label>
            </>
          )}
          {issue.kind === "ROW" && issue.field && !rebuildRequired && (
            <label className="block text-sm font-semibold">
              Giá trị đúng tại kỳ của trường “{issue.field}”
              <input
                value={replacement}
                onChange={(event) => setReplacement(event.target.value)}
                className="mt-1 block w-full rounded-md border px-3 py-2 font-normal"
              />
            </label>
          )}
          {!rebuildRequired && (
            <>
              <label className="block text-sm font-semibold">
                Mã hồ sơ hoặc ID nguồn
                <input
                  value={entityId}
                  onChange={(e) => setEntityId(e.target.value)}
                  className="mt-1 block w-full rounded-md border px-3 py-2 font-normal"
                />
              </label>
              <label className="block text-sm font-semibold">
                Lý do xác minh
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="mt-1 block w-full rounded-md border px-3 py-2 font-normal"
                />
              </label>
              <label className="block text-sm font-semibold">
                Chứng cứ / số văn bản
                <input
                  value={evidence}
                  onChange={(e) => setEvidence(e.target.value)}
                  className="mt-1 block w-full rounded-md border px-3 py-2 font-normal"
                />
              </label>
            </>
          )}
        </div>
        <footer className="flex justify-end gap-2 border-t p-4">
          <button
            onClick={onClose}
            className="rounded-md border px-4 py-2 text-sm font-semibold"
          >
            Đóng
          </button>
          {!rebuildRequired && (
            <button
              disabled={
                working ||
                !entityId.trim() ||
                !targetKey.trim() ||
                (issue.kind === "ROW" &&
                  !!issue.field &&
                  !replacement.trim()) ||
                reason.trim().length < 3 ||
                !evidence.trim()
              }
              onClick={() =>
                onSave({
                  appendix: issue.appendix,
                  targetKey:
                    issue.kind === "APPENDIX"
                      ? "__appendix__"
                      : numeric
                        ? targetKey.trim()
                        : (issue.field ?? "__confirm_snapshot__"),
                  entityId: entityId.trim(),
                  operation:
                    issue.kind === "APPENDIX"
                      ? "CONFIRM"
                      : numeric
                        ? operation
                        : "REPLACE",
                  newValue:
                    issue.kind === "ROW" && issue.field
                      ? replacement.trim()
                      : numeric && operation !== "CONFIRM"
                        ? 1
                        : "Đã xác minh",
                  reason: reason.trim(),
                  evidence: {
                    reference: evidence.trim(),
                    entityCode: entityId.trim(),
                  },
                  issueCode: issue.code,
                })
              }
              className="rounded-md bg-[#003973] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Lưu xác minh
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}

function RejectDialog({
  working,
  onClose,
  onSave,
}: {
  working: boolean;
  onClose: () => void;
  onSave: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-[#172033]/45 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Trả lại báo cáo"
        className="w-full max-w-md bg-white shadow-2xl"
      >
        <header className="flex items-center justify-between border-b p-4">
          <h2 className="text-xl font-bold">Trả lại báo cáo</h2>
          <button
            aria-label="Đóng"
            onClick={onClose}
            className="rounded border p-2"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="p-4">
          <label className="block text-sm font-semibold">
            Lý do trả lại
            <textarea
              autoFocus
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={4}
              placeholder="Nêu rõ nội dung cần bổ sung hoặc sửa"
              className="mt-1 block w-full rounded-md border px-3 py-2 font-normal"
            />
          </label>
        </div>
        <footer className="flex justify-end gap-2 border-t p-4">
          <button
            onClick={onClose}
            className="rounded-md border px-4 py-2 text-sm font-semibold"
          >
            Hủy
          </button>
          <button
            disabled={working || reason.trim().length < 3}
            onClick={() => onSave(reason.trim())}
            className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Xác nhận trả lại
          </button>
        </footer>
      </section>
    </div>
  );
}

function DetailTable({
  rows,
  onOpen,
}: {
  rows: Row[];
  onOpen: (row: Row, cellKey: string) => void;
}) {
  const columns = Array.from(
    new Set(rows.flatMap((row) => Object.keys(row.cells))),
  );
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const visibleRows = rows.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );
  if (!rows.length)
    return (
      <div className="p-12 text-center text-sm text-[#667780]">
        Phụ lục không có hồ sơ trong kỳ này.
      </div>
    );
  return (
    <>
      <div className="hidden overflow-auto md:block">
        <table className="min-w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-[#F1F4F5] text-left text-xs text-[#4F616B]">
            <tr>
              <th className="sticky left-0 z-10 border-b bg-[#F1F4F5] px-3 py-3">
                STT / Mã hồ sơ
              </th>
              {columns.map((column) => (
                <th key={column} className="min-w-[170px] border-b px-3 py-3">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, index) => (
              <tr
                key={row.recordId}
                className="border-b border-[#E6EAEC] hover:bg-[#F7FAFB]"
              >
                <td className="sticky left-0 bg-white px-3 py-3 font-semibold text-[#003973]">
                  {(safePage - 1) * pageSize + index + 1}
                  <span className="ml-2 text-xs font-normal text-[#657680]">
                    {row.recordCode}
                  </span>
                </td>
                {columns.map((column) => (
                  <td key={column} className="p-0 align-top">
                    <button
                      onClick={() => onOpen(row, column)}
                      className="min-h-11 w-full px-3 py-3 text-left hover:bg-[#EAF2F6] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#0072A8]"
                    >
                      {display(row.cells[column])}
                    </button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-2 p-3 md:hidden">
        {visibleRows.map((row, index) => (
          <details
            key={row.recordId}
            className="border-l-4 border-[#003973] bg-[#F8FAFB] p-3"
          >
            <summary className="cursor-pointer font-bold text-[#003973]">
              {(safePage - 1) * pageSize + index + 1}. {row.recordCode}
            </summary>
            {columns.map((column) => (
              <button
                key={column}
                onClick={() => onOpen(row, column)}
                className="mt-2 block w-full text-left text-sm"
              >
                <span className="text-[#64747D]">{column}: </span>
                {display(row.cells[column])}
              </button>
            ))}
          </details>
        ))}
      </div>
      {pageCount > 1 && (
        <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
          <span>
            {rows.length} hồ sơ · Trang {safePage}/{pageCount}
          </span>
          <div className="flex gap-2">
            <button
              disabled={safePage === 1}
              onClick={() => setPage((value) => value - 1)}
              className="rounded border px-3 py-1.5 font-semibold disabled:opacity-40"
            >
              Trước
            </button>
            <button
              disabled={safePage === pageCount}
              onClick={() => setPage((value) => value + 1)}
              className="rounded border px-3 py-1.5 font-semibold disabled:opacity-40"
            >
              Sau
            </button>
          </div>
        </div>
      )}
    </>
  );
}
function MetricTable({
  metrics,
  onOpen,
}: {
  metrics: Metric[];
  onOpen: (metric: Metric) => void;
}) {
  return (
    <div className="divide-y divide-[#E0E6E9]">
      {metrics.map((metric) => (
        <button
          key={metric.key}
          onClick={() => onOpen(metric)}
          aria-label={`${METRIC_LABELS[metric.key] ?? `Chỉ tiêu ${metric.key}`} ${metric.value}`}
          className="grid w-full grid-cols-[90px_1fr_auto] items-center gap-3 px-4 py-3 text-left hover:bg-[#F3F7F9] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#0072A8]"
        >
          <span className="font-bold text-[#486574]">{metric.key}</span>
          <span>
            <strong className="block text-sm">
              {METRIC_LABELS[metric.key] ?? `Chỉ tiêu ${metric.key}`}
            </strong>
            <span className="text-xs text-[#6B7A82]">
              Bấm để xem hồ sơ và phép tính
            </span>
          </span>
          <span className="flex items-center gap-2 text-xl font-bold tabular-nums text-[#003973]">
            {metric.value}
            <ChevronRight className="h-4 w-4" />
          </span>
        </button>
      ))}
    </div>
  );
}
type DrilldownData = {
  value: number;
  total: number;
  page: number;
  limit: number;
  items: Contribution[];
  formula?: string;
};
function DrilldownDrawer({
  reportId,
  appendix,
  metric,
  cellKey,
  entityId,
  periodLabel,
  onClose,
}: {
  reportId: string;
  appendix: string;
  metric: Metric;
  cellKey?: string;
  entityId?: string;
  periodLabel: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<DrilldownData | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [loadError, setLoadError] = useState("");
  useEffect(() => {
    let active = true;
    api
      .get(`/reports/monthly-packages/${reportId}/drilldown`, {
        params: {
          appendix,
          metricKey: metric.key,
          cellKey,
          entityId,
          q: submittedQuery || undefined,
          page,
          limit: 20,
        },
      })
      .then((response) => {
        if (active) setData(response.data);
      })
      .catch(() => {
        if (active) setLoadError("Không tải được nguồn tạo số liệu.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [appendix, cellKey, entityId, metric.key, page, reportId, submittedQuery]);
  const totalPages = Math.max(
    1,
    Math.ceil((data?.total ?? 0) / (data?.limit ?? 20)),
  );
  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[#172033]/35"
      onMouseDown={(e) => {
        if (e.currentTarget === e.target) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Nguồn tạo số liệu"
        className="flex h-full w-full flex-col bg-white shadow-2xl sm:max-w-xl"
      >
        <header className="border-b bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-[#527080]">
                {appendix} / {cellKey ?? metric.key} / Kỳ {periodLabel}
              </p>
              <h2 className="mt-1 text-xl font-bold">Nguồn tạo số liệu</h2>
              <p className="mt-1 text-sm text-[#62727B]">
                {cellKey
                  ? `Trường ${cellKey}`
                  : (METRIC_LABELS[metric.key] ??
                    `Chỉ tiêu ${metric.key}`)}{" "}
                ={" "}
                <strong className="text-[#003973]">
                  {data?.value ?? metric.value}
                </strong>
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Đóng nguồn số liệu"
              className="rounded-md border p-2 hover:bg-slate-50"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {data?.formula && (
            <div className="mt-3 rounded-md bg-[#EEF3F6] p-3 text-sm">
              <strong>Phép tính:</strong> {data.formula}
            </div>
          )}
        </header>
        <div className="flex-1 overflow-y-auto p-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setLoading(true);
              setLoadError("");
              setPage(1);
              setSubmittedQuery(query.trim());
            }}
            className="flex gap-2"
          >
            <label className="relative block flex-1">
              <span className="sr-only">Tìm trong nguồn số liệu</span>
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm mã hoặc tên hồ sơ"
                className="w-full rounded-md border py-2 pl-9 pr-3 text-sm"
              />
            </label>
            <button className="rounded-md bg-[#003973] px-4 text-sm font-semibold text-white">
              Tìm
            </button>
          </form>
          {loadError && (
            <p
              role="alert"
              className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-800"
            >
              {loadError}
            </p>
          )}
          {loading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="h-6 w-6 animate-spin text-[#003973]" />
            </div>
          ) : (
            data && (
              <>
                <div className="mt-4 space-y-2">
                  {data.items.length === 0 ? (
                    <p className="p-8 text-center text-sm text-[#687981]">
                      Không có dòng nguồn phù hợp.
                    </p>
                  ) : (
                    data.items.map((item) => (
                      <ContributionCard key={item.id} item={item} />
                    ))
                  )}
                </div>
                <div className="mt-4 flex items-center justify-between border-t pt-3 text-sm">
                  <span>
                    {data.total} dòng nguồn · Trang {page}/{totalPages}
                  </span>
                  <div className="flex gap-2">
                    <button
                      disabled={page <= 1}
                      onClick={() => {
                        setLoading(true);
                        setLoadError("");
                        setPage((value) => value - 1);
                      }}
                      className="rounded border px-3 py-1.5 font-semibold disabled:opacity-40"
                    >
                      Trước
                    </button>
                    <button
                      disabled={page >= totalPages}
                      onClick={() => {
                        setLoading(true);
                        setLoadError("");
                        setPage((value) => value + 1);
                      }}
                      className="rounded border px-3 py-1.5 font-semibold disabled:opacity-40"
                    >
                      Sau
                    </button>
                  </div>
                </div>
              </>
            )
          )}
          <footer className="mt-5 border-t pt-4 text-xs text-[#647680]">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-600" /> Tổng đóng góp được
              đối chiếu với giá trị của snapshot.
            </div>
          </footer>
        </div>
      </section>
    </div>
  );
}

function ContributionCard({ item }: { item: Contribution }) {
  const snapshot =
    item.snapshot && typeof item.snapshot === "object"
      ? (item.snapshot as Record<string, unknown>)
      : null;
  return (
    <article className="border border-[#D8E0E4] p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <a
            href={
              item.entityType === "CASE"
                ? `/cases/${item.entityId}`
                : item.entityType === "INCIDENT"
                  ? `/incidents/${item.entityId}`
                  : "#"
            }
            target="_blank"
            rel="noreferrer"
            className="font-bold text-[#005C8A] underline-offset-2 hover:underline"
          >
            {item.entityCode ?? item.entityId}
          </a>
          <p className="text-sm">{item.label}</p>
        </div>
        <span
          className={`rounded px-2 py-1 text-sm font-bold ${item.value < 0 ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"}`}
        >
          {item.value > 0 ? "+" : ""}
          {item.value}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-xs text-[#657680]">
        <span>{item.ruleCode}</span>
        {item.eventAt && (
          <span>
            Ngày nghiệp vụ: {new Date(item.eventAt).toLocaleDateString("vi-VN")}
          </span>
        )}
      </div>
      {snapshot &&
        ("valueAtPeriod" in snapshot ||
          "currentValue" in snapshot ||
          "previousValue" in snapshot) && (
          <dl className="mt-3 grid grid-cols-2 gap-2 rounded bg-[#F5F7F8] p-2 text-xs">
            <div>
              <dt className="text-[#687981]">Giá trị tại kỳ</dt>
              <dd className="font-semibold">
                {display(snapshot.valueAtPeriod)}
              </dd>
            </div>
            <div>
              <dt className="text-[#687981]">
                Giá trị trước điều chỉnh / hiện tại
              </dt>
              <dd className="font-semibold">
                {display(snapshot.previousValue ?? snapshot.currentValue)}
              </dd>
            </div>
          </dl>
        )}
    </article>
  );
}
