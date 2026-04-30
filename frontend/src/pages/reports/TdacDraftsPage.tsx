import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FilePlus, Eye, Download, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type DraftStatus = "DRAFT" | "REVIEWING" | "REJECTED" | "APPROVED" | "FINALIZED";
type LoaiBaoCao = "VU_AN" | "VU_VIEC";

interface DraftItem {
  id: string;
  loaiBaoCao: LoaiBaoCao;
  fromDate: string;
  toDate: string;
  status: DraftStatus;
  createdAt: string;
  createdBy?: {
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_META: Record<DraftStatus, { label: string; className: string }> = {
  DRAFT:      { label: "Bản nháp",     className: "bg-slate-100 text-slate-700" },
  REVIEWING:  { label: "Đang duyệt",   className: "bg-blue-100 text-blue-700" },
  REJECTED:   { label: "Từ chối",      className: "bg-red-100 text-red-700" },
  APPROVED:   { label: "Đã duyệt",     className: "bg-green-100 text-green-700" },
  FINALIZED:  { label: "Đã khóa",      className: "bg-purple-100 text-purple-700" },
};

function StatusBadge({ status }: { status: DraftStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.DRAFT;
  return (
    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${meta.className}`}>
      {meta.label}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TdacDraftsPage() {
  const navigate = useNavigate();

  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterLoai, setFilterLoai] = useState<"" | LoaiBaoCao>("");
  const [filterStatus, setFilterStatus] = useState<"" | DraftStatus>("");

  const fetchDrafts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<DraftItem[]>("/reports/tdac/drafts", {
        params: {
          loaiBaoCao: filterLoai || undefined,
          status: filterStatus || undefined,
        },
      });
      setDrafts(Array.isArray(res.data) ? res.data : (res.data as any)?.data ?? []);
    } catch {
      setError("Không thể tải danh sách bản nháp.");
    } finally {
      setLoading(false);
    }
  }, [filterLoai, filterStatus]);

  useEffect(() => { fetchDrafts(); }, [fetchDrafts]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

  const formatPeriod = (from: string, to: string) =>
    `${formatDate(from)} — ${formatDate(to)}`;

  const getCreatorName = (d: DraftItem) => {
    if (!d.createdBy) return "—";
    const { firstName, lastName, email } = d.createdBy;
    if (firstName || lastName) return [lastName, firstName].filter(Boolean).join(" ");
    return email;
  };

  const downloadDraft = async (id: string) => {
    try {
      const res = await api.get(`/reports/tdac/drafts/${id}/export`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bao-cao-tdc-${id}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Không thể tải xuống tệp.");
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 mb-1">Bản nháp báo cáo TĐC</h1>
          <p className="text-slate-600">Quản lý và theo dõi quy trình duyệt báo cáo tạm đình chỉ</p>
        </div>
        <button
          onClick={() => navigate("/reports/tdac/new")}
          className="flex items-center gap-2 px-4 py-2 bg-[#003973] text-white rounded-lg hover:bg-[#0052a3] transition-colors"
        >
          <FilePlus className="w-4 h-4" />
          Tạo mới
        </button>
      </div>

      {/* Filter bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 mb-5 flex flex-wrap gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Loại báo cáo</label>
          <select
            value={filterLoai}
            onChange={(e) => setFilterLoai(e.target.value as "" | LoaiBaoCao)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003973]"
          >
            <option value="">Tất cả</option>
            <option value="VU_AN">Vụ án TĐC</option>
            <option value="VU_VIEC">Vụ việc TĐC</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Trạng thái</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as "" | DraftStatus)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003973]"
          >
            <option value="">Tất cả</option>
            {(Object.keys(STATUS_META) as DraftStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_META[s].label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left py-3 px-4 font-semibold text-slate-700">Kỳ báo cáo</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-700">Loại</th>
                <th className="text-center py-3 px-4 font-semibold text-slate-700">Trạng thái</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-700">Người tạo</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-700">Ngày tạo</th>
                <th className="text-center py-3 px-4 font-semibold text-slate-700">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    {Array.from({ length: 6 }).map((__, j) => (
                      <td key={j} className="py-3 px-4">
                        <div className="animate-pulse bg-slate-200 rounded h-5 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : drafts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <FilePlus className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    <p>Chưa có bản nháp nào.</p>
                    <button
                      onClick={() => navigate("/reports/tdac/new")}
                      className="mt-3 text-[#003973] hover:underline text-sm"
                    >
                      Tạo bản nháp đầu tiên
                    </button>
                  </td>
                </tr>
              ) : (
                drafts.map((draft) => (
                  <tr key={draft.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4 text-slate-800">
                      {formatPeriod(draft.fromDate, draft.toDate)}
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {draft.loaiBaoCao === "VU_AN" ? "Vụ án TĐC" : "Vụ việc TĐC"}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={draft.status} />
                    </td>
                    <td className="py-3 px-4 text-slate-700">{getCreatorName(draft)}</td>
                    <td className="py-3 px-4 text-slate-600">{formatDate(draft.createdAt)}</td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => navigate(`/reports/tdac/drafts/${draft.id}`)}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg text-slate-700 hover:border-[#003973] hover:text-[#003973] transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Xem
                        </button>
                        {draft.status === "FINALIZED" && (
                          <button
                            onClick={() => downloadDraft(draft.id)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs border border-green-300 rounded-lg text-green-700 hover:bg-green-50 transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Tải về
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
