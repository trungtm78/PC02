import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, AlertTriangle, Save, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";

// ─── Types ───────────────────────────────────────────────────────────────────

interface BackfillCase {
  id: string;
  name: string;
  investigator?: { firstName: string | null; lastName: string | null; username: string } | null;
  ngayTamDinhChi?: string | null;
  lyDoTamDinhChiVuAn: string | null;
}

const LY_DO_OPTIONS = [
  { value: "CHUA_XAC_DINH_BI_CAN", label: "Chưa xác định được bị can (Điều 229.1.a)" },
  { value: "KHONG_BIET_BI_CAN_O_DAU", label: "Không biết rõ bị can đang ở đâu (Điều 229.1.b)" },
  { value: "BI_CAN_BENH_TAM_THAN", label: "Bị can bị bệnh tâm thần hoặc hiểm nghèo (Điều 229.1.c)" },
  { value: "CHUA_CO_KET_QUA_GIAM_DINH", label: "Chưa có kết quả giám định (Điều 229.1.d-1)" },
  { value: "CHUA_CO_KET_QUA_DINH_GIA", label: "Chưa có kết quả định giá tài sản (Điều 229.1.d-2)" },
  { value: "CHUA_CO_KET_QUA_TUONG_TRO", label: "Chưa có kết quả tương trợ tư pháp (Điều 229.1.d-3)" },
  { value: "YEU_CAU_TAI_LIEU_CHUA_CO", label: "Đã yêu cầu tài liệu nhưng chưa có kết quả (Điều 229.1.đ)" },
  { value: "BAT_KHA_KHANG", label: "Bất khả kháng: thiên tai, dịch bệnh (Điều 229.1.e)" },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function CaseTdcBackfillPage() {
  const navigate = useNavigate();
  const [cases, setCases] = useState<BackfillCase[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingEdits, setPendingEdits] = useState<Record<string, string>>({});
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [errorIds, setErrorIds] = useState<Record<string, string>>({});

  const fetchCases = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/cases?status=TAM_DINH_CHI&filter=tdac-missing-reason&limit=200");
      setCases(res.data.data ?? []);
    } catch {
      setCases([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  const handleLyDoChange = (caseId: string, lyDo: string) => {
    setPendingEdits((prev) => ({ ...prev, [caseId]: lyDo }));
    // Clear any previous error/saved state when user edits
    setErrorIds((prev) => {
      const next = { ...prev };
      delete next[caseId];
      return next;
    });
    setSavedIds((prev) => {
      const next = new Set(prev);
      next.delete(caseId);
      return next;
    });
  };

  const handleSave = async (caseId: string) => {
    const lyDo = pendingEdits[caseId];
    if (!lyDo) return;

    setSavingIds((prev) => new Set(prev).add(caseId));
    setErrorIds((prev) => {
      const next = { ...prev };
      delete next[caseId];
      return next;
    });

    try {
      await api.patch(`/cases/${caseId}/tdc-backfill`, { lyDoTamDinhChiVuAn: lyDo });
      setSavedIds((prev) => new Set(prev).add(caseId));
      // Remove from list after short delay
      setTimeout(() => {
        setCases((prev) => prev.filter((c) => c.id !== caseId));
        setSavedIds((prev) => {
          const next = new Set(prev);
          next.delete(caseId);
          return next;
        });
      }, 1500);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setErrorIds((prev) => ({
        ...prev,
        [caseId]: Array.isArray(msg) ? msg.join(", ") : (msg ?? "Lưu thất bại."),
      }));
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(caseId);
        return next;
      });
    }
  };

  const investigatorName = (c: BackfillCase) => {
    if (!c.investigator) return "Chưa phân công";
    return (
      `${c.investigator.firstName ?? ""} ${c.investigator.lastName ?? ""}`.trim() ||
      c.investigator.username
    );
  };

  return (
    <div className="p-6 space-y-6" data-testid="tdc-backfill-page">
      {/* Back */}
      <button
        onClick={() => navigate("/cases")}
        className="flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm font-medium">Quay lại danh sách</span>
      </button>

      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              Cập nhật lý do TĐC còn thiếu
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Danh sách vụ án đang tạm đình chỉ nhưng chưa có lý do theo quy định mới (Phụ lục 08).
            </p>
          </div>
          <button
            onClick={fetchCases}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Làm mới
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500" />
          </div>
        ) : cases.length === 0 ? (
          <div className="py-16 text-center">
            <AlertTriangle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Không có vụ án nào cần cập nhật</p>
            <p className="text-slate-400 text-sm mt-1">Tất cả vụ án TĐC đã có lý do đầy đủ.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap">
                    Mã HS
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    Tên vụ án
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap">
                    Điều tra viên
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap">
                    Ngày TĐC
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide min-w-64">
                    Lý do TĐC
                  </th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wide w-20">
                    Lưu
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {cases.map((c) => {
                  const isSaving = savingIds.has(c.id);
                  const isSaved = savedIds.has(c.id);
                  const hasError = !!errorIds[c.id];
                  const selectedLyDo = pendingEdits[c.id] ?? "";

                  return (
                    <tr
                      key={c.id}
                      className={`transition-colors ${isSaved ? "bg-green-50" : "hover:bg-slate-50"}`}
                      data-testid={`backfill-row-${c.id}`}
                    >
                      <td className="px-5 py-3 whitespace-nowrap">
                        <button
                          onClick={() => navigate(`/cases/${c.id}`)}
                          className="text-blue-600 hover:underline font-mono text-xs"
                        >
                          {c.id.slice(0, 8)}...
                        </button>
                      </td>
                      <td className="px-5 py-3 text-slate-800 max-w-xs">
                        <p className="line-clamp-2 font-medium">{c.name}</p>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-slate-600">
                        {investigatorName(c)}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-slate-600">
                        {c.ngayTamDinhChi
                          ? new Date(c.ngayTamDinhChi).toLocaleDateString("vi-VN")
                          : "—"}
                      </td>
                      <td className="px-5 py-3">
                        <select
                          value={selectedLyDo}
                          onChange={(e) => handleLyDoChange(c.id, e.target.value)}
                          className={`w-full px-2 py-1.5 border rounded-lg focus:outline-none focus:ring-2 text-sm bg-white ${
                            hasError
                              ? "border-red-300 focus:ring-red-400"
                              : isSaved
                              ? "border-green-300 focus:ring-green-400"
                              : "border-slate-300 focus:ring-blue-500"
                          }`}
                          disabled={isSaving || isSaved}
                          data-testid={`select-ly-do-${c.id}`}
                        >
                          <option value="">-- Chọn lý do --</option>
                          {LY_DO_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        {hasError && (
                          <p className="text-xs text-red-600 mt-1">{errorIds[c.id]}</p>
                        )}
                        {isSaved && (
                          <p className="text-xs text-green-600 mt-1">Đã lưu thành công</p>
                        )}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <button
                          onClick={() => handleSave(c.id)}
                          disabled={!selectedLyDo || isSaving || isSaved}
                          className="flex items-center gap-1 mx-auto px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                          data-testid={`btn-save-${c.id}`}
                        >
                          <Save className="w-3.5 h-3.5" />
                          {isSaving ? "..." : isSaved ? "Đã lưu" : "Lưu"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {cases.length > 0 && !loading && (
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 text-xs text-slate-500">
            Còn {cases.length} vụ án cần cập nhật lý do TĐC
          </div>
        )}
      </div>
    </div>
  );
}
