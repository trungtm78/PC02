import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FileSpreadsheet, Eye, FilePlus, AlertCircle, ChevronDown, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";
import { today } from "@/lib/dates";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Team {
  id: string;
  name: string;
}

interface TdacRowData {
  rowKey: string;
  label: string;
  isSection: boolean;
  isFormula?: boolean;
  tong: number;
  byTeam: Record<string, number>;
}

interface TdacReportData {
  rows: TdacRowData[];
  kpi: {
    row1: number;
    row2: number;
    row3: number;
    row5: number;
  };
}

type LoaiBaoCao = "VU_AN" | "VU_VIEC";

// ─── Table section collapse state ─────────────────────────────────────────────

const SECTION_KEYS = ["row1", "row2", "row3", "row4", "row5"];

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    green: "border-green-200 bg-green-50 text-green-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    purple: "border-purple-200 bg-purple-50 text-purple-700",
  };
  return (
    <div className={`border rounded-lg p-5 ${colorMap[color] ?? colorMap.blue}`}>
      <div className="text-3xl font-bold mb-1">{value}</div>
      <div className="text-sm font-medium opacity-80">{label}</div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-200 rounded ${className ?? ""}`} />;
}

function TableSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 10 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TdacReportPage() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<LoaiBaoCao>("VU_AN");
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => today());
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [reportData, setReportData] = useState<TdacReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [stale, setStale] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  // Track last-fetched params to detect staleness
  const lastParams = useRef<string>("");

  // ── Fetch teams on mount
  useEffect(() => {
    api.get<{ data: Team[] }>("/teams").then((res) => {
      const list = res.data?.data ?? (res.data as unknown as Team[]) ?? [];
      setTeams(list);
    }).catch(() => {});
  }, []);

  // ── Mark stale when params change after a fetch
  useEffect(() => {
    const params = JSON.stringify({ activeTab, fromDate, toDate, selectedTeamIds });
    if (lastParams.current && params !== lastParams.current) {
      setStale(true);
    }
  }, [activeTab, fromDate, toDate, selectedTeamIds]);

  // ── Fetch report preview
  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = JSON.stringify({ activeTab, fromDate, toDate, selectedTeamIds });
    lastParams.current = params;
    setStale(false);
    try {
      const endpoint = activeTab === "VU_AN" ? "/reports/tdac/vu-an" : "/reports/tdac/vu-viec";
      const res = await api.get<TdacReportData>(endpoint, {
        params: {
          fromDate,
          toDate,
          teamIds: selectedTeamIds.join(",") || undefined,
        },
      });
      // Backend /reports/tdac/* returns raw TdacReportData — no envelope wrap.
      // Do NOT add `.data.data` here. See tdac.controller.ts:57+67.
      setReportData(res.data);
    } catch {
      setError("Không thể tải dữ liệu báo cáo. Vui lòng thử lại.");
      setReportData(null);
    } finally {
      setLoading(false);
    }
  }, [activeTab, fromDate, toDate, selectedTeamIds]);

  // ── Create draft
  const createDraft = useCallback(async () => {
    setSubmitting(true);
    try {
      await api.post("/reports/tdac/drafts", {
        loaiBaoCao: activeTab,
        fromDate,
        toDate,
        teamIds: selectedTeamIds,
      });
      navigate("/reports/tdac/drafts");
    } catch {
      setError("Không thể tạo bản nháp. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }, [activeTab, fromDate, toDate, selectedTeamIds, navigate]);

  // ── Toggle team selection
  const toggleTeam = (id: string) => {
    setSelectedTeamIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  // ── Determine which teams to show as columns
  const displayTeams = teams.filter(
    (t) => selectedTeamIds.length === 0 || selectedTeamIds.includes(t.id)
  );

  // ── Toggle section collapse
  const toggleSection = (key: string) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // ── Group rows by section prefix
  const sections: Array<{ key: string; label: string; children: TdacRowData[] }> = [];
  const sectionMap: Record<string, TdacRowData[]> = {};
  (reportData?.rows ?? []).forEach((row) => {
    const sectionKey = row.rowKey.split(".")[0];
    if (!sectionMap[sectionKey]) sectionMap[sectionKey] = [];
    sectionMap[sectionKey].push(row);
  });
  SECTION_KEYS.forEach((key) => {
    if (sectionMap[key]) {
      const headerRow = sectionMap[key].find((r) => r.rowKey === key);
      sections.push({
        key,
        label: headerRow?.label ?? key,
        children: sectionMap[key].filter((r) => r.rowKey !== key),
      });
    }
  });

  const hasData = reportData !== null && !loading;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 mb-1 flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-[#003973]" />
            Báo cáo TĐC
          </h1>
          <p className="text-slate-600">Tạm đình chỉ — báo cáo định kỳ theo tổ</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchReport}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-[#003973] text-white rounded-lg hover:bg-[#0052a3] disabled:opacity-60 transition-colors"
          >
            <Eye className="w-4 h-4" />
            {loading ? "Đang tải..." : "Xem trước"}
          </button>
          <button
            onClick={createDraft}
            disabled={submitting || !hasData}
            className="flex items-center gap-2 px-4 py-2 border border-[#003973] text-[#003973] rounded-lg hover:bg-slate-50 disabled:opacity-60 transition-colors"
          >
            <FilePlus className="w-4 h-4" />
            {submitting ? "Đang tạo..." : "Tạo bản nháp"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex border-b border-slate-200">
        {(["VU_AN", "VU_VIEC"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? "border-[#003973] text-[#003973]"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab === "VU_AN" ? "Vụ án TĐC" : "Vụ việc TĐC"}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 mb-6 flex flex-wrap gap-4 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Từ ngày</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003973]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Đến ngày</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003973]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Tổ / đơn vị</label>
          <div className="flex flex-wrap gap-2">
            {teams.length === 0 ? (
              <span className="text-slate-400 text-sm">Đang tải...</span>
            ) : (
              teams.map((team) => (
                <button
                  key={team.id}
                  onClick={() => toggleTeam(team.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    selectedTeamIds.includes(team.id)
                      ? "bg-[#003973] text-white border-[#003973]"
                      : "bg-white text-slate-600 border-slate-300 hover:border-[#003973]"
                  }`}
                >
                  {team.name}
                </button>
              ))
            )}
            {selectedTeamIds.length > 0 && (
              <button
                onClick={() => setSelectedTeamIds([])}
                className="px-3 py-1.5 rounded-full text-xs font-medium border border-slate-300 text-slate-500 hover:bg-slate-50"
              >
                Xóa bộ lọc
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stale banner */}
      {stale && !loading && (
        <div className="mb-4 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-amber-800 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>Bộ lọc đã thay đổi. Nhấn <strong>Xem trước</strong> để cập nhật dữ liệu.</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* KPI strip */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : hasData && reportData?.kpi ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KpiCard label="Hàng 1 — Tổng thụ lý TĐC" value={reportData.kpi.row1} color="blue" />
          <KpiCard label="Hàng 2 — Số vụ TĐC hết hạn" value={reportData.kpi.row2} color="amber" />
          <KpiCard label="Hàng 3 — Số vụ phục hồi" value={reportData.kpi.row3} color="green" />
          <KpiCard label="Hàng 5 — Kết quả khắc phục" value={reportData.kpi.row5} color="purple" />
        </div>
      ) : null}

      {/* Data table */}
      <div className="bg-white border border-slate-200 rounded-lg">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">
            Chi tiết báo cáo TĐC — {activeTab === "VU_AN" ? "Vụ án" : "Vụ việc"}
          </h3>
          {hasData && (
            <span className="text-xs text-slate-500">
              {fromDate} — {toDate}
            </span>
          )}
        </div>

        {loading ? (
          <TableSkeleton />
        ) : !hasData ? (
          <div className="py-16 text-center text-slate-400">
            <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="font-medium">Chưa có dữ liệu</p>
            <p className="text-sm mt-1">Chọn bộ lọc và nhấn <strong>Xem trước</strong> để tải báo cáo.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-center py-3 px-3 font-semibold text-slate-700 w-12">STT</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700 min-w-64">Danh mục</th>
                  <th className="text-center py-3 px-3 font-semibold text-slate-700">Tổng</th>
                  {displayTeams.map((t) => (
                    <th key={t.id} className="text-center py-3 px-3 font-semibold text-slate-700">
                      {t.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sections.map((section, sIdx) => {
                  const headerRow = (reportData?.rows ?? []).find((r) => r.rowKey === section.key);
                  const isOpen = !collapsed[section.key];
                  return (
                    <>
                      {/* Section header row */}
                      <tr
                        key={section.key}
                        className="bg-slate-100 border-b border-slate-200 cursor-pointer hover:bg-slate-150"
                        onClick={() => toggleSection(section.key)}
                      >
                        <td className="py-3 px-3 text-center font-bold text-slate-700">{sIdx + 1}</td>
                        <td className="py-3 px-4 font-bold text-slate-800 flex items-center gap-2">
                          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          {section.label}
                        </td>
                        <td className="py-3 px-3 text-center font-bold">{headerRow?.tong ?? 0}</td>
                        {displayTeams.map((t) => (
                          <td key={t.id} className="py-3 px-3 text-center font-bold">
                            {headerRow?.byTeam?.[t.id] ?? 0}
                          </td>
                        ))}
                      </tr>

                      {/* Sub-rows */}
                      {isOpen &&
                        section.children.map((row, rIdx) => (
                          <tr
                            key={row.rowKey}
                            className={`border-b border-slate-100 hover:bg-slate-50 ${
                              row.isFormula ? "bg-slate-50 text-slate-500 italic" : ""
                            }`}
                          >
                            <td className="py-2.5 px-3 text-center text-slate-500">
                              {sIdx + 1}.{rIdx + 1}
                            </td>
                            <td className="py-2.5 px-4 pl-8 text-slate-700">{row.label}</td>
                            <td className="py-2.5 px-3 text-center">{row.tong}</td>
                            {displayTeams.map((t) => (
                              <td key={t.id} className="py-2.5 px-3 text-center">
                                {row.byTeam?.[t.id] ?? 0}
                              </td>
                            ))}
                          </tr>
                        ))}
                    </>
                  );
                })}

                {sections.length === 0 && (
                  <tr>
                    <td colSpan={3 + displayTeams.length} className="py-10 text-center text-slate-400">
                      Không có dữ liệu trong kỳ báo cáo này.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
