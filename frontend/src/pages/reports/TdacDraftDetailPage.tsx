import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Save,
  Send,
  CheckCircle,
  XCircle,
  Unlock,
  Download,
  Lock,
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { api } from "@/lib/api";
import { authStore } from "@/stores/auth.store";

// ─── Types ────────────────────────────────────────────────────────────────────

type DraftStatus = "DRAFT" | "REVIEWING" | "REJECTED" | "APPROVED" | "FINALIZED";

interface TimelineEvent {
  id: string;
  action: string;
  note?: string;
  createdAt: string;
  actor?: { firstName: string | null; lastName: string | null; email: string };
}

interface DraftRow {
  rowKey: string;
  label: string;
  isSection: boolean;
  isFormula?: boolean;
  tong: number;
  dieuChinh?: number;
  byTeam: Record<string, number>;
}

interface DraftDetail {
  id: string;
  loaiBaoCao: "VU_AN" | "VU_VIEC";
  fromDate: string;
  toDate: string;
  status: DraftStatus;
  rejectedReason?: string;
  createdAt: string;
  createdBy?: { firstName: string | null; lastName: string | null; email: string };
  rows: DraftRow[];
  teams: Array<{ id: string; name: string }>;
  timeline: TimelineEvent[];
}

// ─── Status meta ─────────────────────────────────────────────────────────────

const STATUS_META: Record<DraftStatus, { label: string; className: string }> = {
  DRAFT:     { label: "Bản nháp",   className: "bg-slate-100 text-slate-700" },
  REVIEWING: { label: "Đang duyệt", className: "bg-blue-100 text-blue-700" },
  REJECTED:  { label: "Từ chối",    className: "bg-red-100 text-red-700" },
  APPROVED:  { label: "Đã duyệt",   className: "bg-green-100 text-green-700" },
  FINALIZED: { label: "Đã khóa",    className: "bg-purple-100 text-purple-700" },
};

// ─── Reject reason modal ──────────────────────────────────────────────────────

function RejectModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-bold text-slate-800 mb-4">Lý do từ chối</h3>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          placeholder="Nhập lý do từ chối bản nháp..."
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
        />
        <div className="flex gap-3 mt-4 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
          >
            Hủy
          </button>
          <button
            onClick={() => reason.trim() && onConfirm(reason.trim())}
            disabled={!reason.trim()}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60"
          >
            Xác nhận từ chối
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Timeline tab ─────────────────────────────────────────────────────────────

function TimelineTab({ events }: { events: TimelineEvent[] }) {
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const getActorName = (e: TimelineEvent) => {
    if (!e.actor) return "Hệ thống";
    const { firstName, lastName, email } = e.actor;
    if (firstName || lastName) return [lastName, firstName].filter(Boolean).join(" ");
    return email;
  };

  const ACTION_LABELS: Record<string, string> = {
    CREATED: "Tạo bản nháp",
    SUBMITTED: "Gửi xét duyệt",
    APPROVED: "Phê duyệt",
    REJECTED: "Từ chối",
    REOPENED: "Mở lại để sửa",
    FINALIZED: "Khóa & xuất Excel",
  };

  if (events.length === 0) {
    return <p className="text-slate-400 text-sm py-6 text-center">Chưa có lịch sử hoạt động.</p>;
  }

  return (
    <ol className="relative border-l border-slate-200 ml-4 space-y-6 py-4">
      {events.map((ev) => (
        <li key={ev.id} className="ml-6">
          <div className="absolute -left-2.5 w-5 h-5 rounded-full bg-[#003973] flex items-center justify-center">
            <Clock className="w-3 h-3 text-white" />
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-slate-800 text-sm">
                {ACTION_LABELS[ev.action] ?? ev.action}
              </span>
              <span className="text-xs text-slate-500">{formatDate(ev.createdAt)}</span>
            </div>
            <p className="text-xs text-slate-600">{getActorName(ev)}</p>
            {ev.note && (
              <p className="mt-2 text-sm text-slate-700 border-t border-slate-200 pt-2 italic">
                "{ev.note}"
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TdacDraftDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = authStore.getUser();
  const isAdmin = user?.role === "ADMIN" || user?.role === "TRUONG_DON_VI";

  const [draft, setDraft] = useState<DraftDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"table" | "timeline">("table");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const fetchDraft = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<DraftDetail>(`/reports/tdac/drafts/${id}`);
      setDraft(res.data);
      // Initialize edits from existing dieuChinh values
      const initial: Record<string, number> = {};
      (res.data.rows ?? []).forEach((r) => {
        if (r.dieuChinh !== undefined) initial[r.rowKey] = r.dieuChinh;
      });
      setEdits(initial);
    } catch {
      setError("Không thể tải bản nháp.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchDraft(); }, [fetchDraft]);

  const isEditable =
    draft?.status === "DRAFT" || draft?.status === "REVIEWING";

  const canEdit = isEditable;

  // ── Save changes
  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/reports/tdac/drafts/${id}`, { adjustments: edits });
      await fetchDraft();
    } catch {
      setError("Lưu thất bại. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  };

  // ── Submit for review
  const handleSubmit = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await api.post(`/reports/tdac/drafts/${id}/submit-review`);
      await fetchDraft();
    } catch {
      setError("Không thể gửi xét duyệt.");
    } finally {
      setSaving(false);
    }
  };

  // ── Approve
  const handleApprove = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await api.post(`/reports/tdac/drafts/${id}/approve`);
      await fetchDraft();
    } catch {
      setError("Không thể phê duyệt.");
    } finally {
      setSaving(false);
    }
  };

  // ── Reject
  const handleReject = async (reason: string) => {
    if (!id) return;
    setShowRejectModal(false);
    setSaving(true);
    try {
      await api.post(`/reports/tdac/drafts/${id}/reject`, { reason });
      await fetchDraft();
    } catch {
      setError("Không thể từ chối.");
    } finally {
      setSaving(false);
    }
  };

  // ── Reopen
  const handleReopen = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await api.post(`/reports/tdac/drafts/${id}/reopen`);
      await fetchDraft();
    } catch {
      setError("Không thể mở lại.");
    } finally {
      setSaving(false);
    }
  };

  // ── Finalize (lock + export)
  const handleFinalize = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const res = await api.post(
        `/reports/tdac/drafts/${id}/finalize`,
        {},
        { responseType: "blob" }
      );
      await fetchDraft();
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bao-cao-tdc-${id}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Không thể khóa & xuất file.");
    } finally {
      setSaving(false);
    }
  };

  // ── Download finalized
  const handleDownload = async () => {
    if (!id) return;
    try {
      const res = await api.get(`/reports/tdac/drafts/${id}/export`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bao-cao-tdc-${id}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Không thể tải xuống.");
    }
  };

  const toggleSection = (key: string) =>
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));

  // ── Group rows into sections
  const sectionMap: Record<string, DraftRow[]> = {};
  (draft?.rows ?? []).forEach((row) => {
    const sectionKey = row.rowKey.split(".")[0];
    if (!sectionMap[sectionKey]) sectionMap[sectionKey] = [];
    sectionMap[sectionKey].push(row);
  });
  const sectionKeys = Object.keys(sectionMap);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center py-24">
        <div className="w-8 h-8 border-4 border-[#003973] border-t-transparent rounded-full animate-spin" />
        <span className="ml-3 text-slate-600">Đang tải...</span>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-6 text-center text-red-700">
          <AlertCircle className="w-8 h-8 mx-auto mb-2" />
          {error ?? "Không tìm thấy bản nháp."}
        </div>
      </div>
    );
  }

  const statusMeta = STATUS_META[draft.status];

  return (
    <div className="p-6">
      {showRejectModal && (
        <RejectModal onConfirm={handleReject} onCancel={() => setShowRejectModal(false)} />
      )}

      {/* Back + Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 text-sm mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Quay lại danh sách
        </button>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-slate-800">
                Bản nháp báo cáo TĐC —{" "}
                {draft.loaiBaoCao === "VU_AN" ? "Vụ án" : "Vụ việc"}
              </h1>
              <span
                className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${statusMeta.className}`}
              >
                {statusMeta.label}
              </span>
            </div>
            <p className="text-slate-500 text-sm">
              Kỳ: {formatDate(draft.fromDate)} — {formatDate(draft.toDate)}
              {draft.createdBy && (
                <> &nbsp;·&nbsp; Tạo bởi{" "}
                  {[draft.createdBy.lastName, draft.createdBy.firstName]
                    .filter(Boolean)
                    .join(" ") || draft.createdBy.email}
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Rejected reason banner */}
      {draft.status === "REJECTED" && draft.rejectedReason && (
        <div className="mb-5 flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700">
          <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-sm">Bị từ chối</p>
            <p className="text-sm mt-0.5">{draft.rejectedReason}</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-4 flex border-b border-slate-200">
        {([["table", "Dữ liệu báo cáo"], ["timeline", "Lịch sử duyệt"]] as const).map(
          ([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === key
                  ? "border-[#003973] text-[#003973]"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {label}
            </button>
          )
        )}
      </div>

      {/* ── Timeline tab */}
      {activeTab === "timeline" && (
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <TimelineTab events={draft.timeline} />
        </div>
      )}

      {/* ── Table tab */}
      {activeTab === "table" && (
        <div className="bg-white border border-slate-200 rounded-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-center py-3 px-3 font-semibold text-slate-700 w-12">STT</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700 min-w-60">Danh mục</th>
                  <th className="text-center py-3 px-3 font-semibold text-slate-700">Tổng</th>
                  {draft.teams.map((t) => (
                    <th key={t.id} className="text-center py-3 px-3 font-semibold text-slate-700">
                      {t.name}
                    </th>
                  ))}
                  {canEdit && (
                    <th className="text-center py-3 px-3 font-semibold text-[#003973]">Điều chỉnh</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {sectionKeys.map((sectionKey, sIdx) => {
                  const rows = sectionMap[sectionKey];
                  const headerRow = rows.find((r) => r.rowKey === sectionKey);
                  const children = rows.filter((r) => r.rowKey !== sectionKey);
                  const isOpen = !collapsed[sectionKey];

                  return (
                    <>
                      {/* Section header */}
                      <tr
                        key={sectionKey}
                        className="bg-slate-100 border-b border-slate-200 cursor-pointer hover:bg-slate-150"
                        onClick={() => toggleSection(sectionKey)}
                      >
                        <td className="py-3 px-3 text-center font-bold text-slate-700">{sIdx + 1}</td>
                        <td className="py-3 px-4 font-bold text-slate-800">
                          <span className="flex items-center gap-2">
                            {isOpen ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                            {headerRow?.label ?? sectionKey}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-bold">{headerRow?.tong ?? 0}</td>
                        {draft.teams.map((t) => (
                          <td key={t.id} className="py-3 px-3 text-center font-bold">
                            {headerRow?.byTeam?.[t.id] ?? 0}
                          </td>
                        ))}
                        {canEdit && <td />}
                      </tr>

                      {/* Sub-rows */}
                      {isOpen &&
                        children.map((row, rIdx) => {
                          const isFormula = row.isFormula === true;
                          return (
                            <tr
                              key={row.rowKey}
                              className={`border-b border-slate-100 hover:bg-slate-50 ${
                                isFormula ? "bg-slate-50 text-slate-400 italic" : ""
                              }`}
                            >
                              <td className="py-2.5 px-3 text-center text-slate-500">
                                {sIdx + 1}.{rIdx + 1}
                              </td>
                              <td className="py-2.5 px-4 pl-8 text-slate-700">{row.label}</td>
                              <td className="py-2.5 px-3 text-center">{row.tong}</td>
                              {draft.teams.map((t) => (
                                <td key={t.id} className="py-2.5 px-3 text-center">
                                  {row.byTeam?.[t.id] ?? 0}
                                </td>
                              ))}
                              {canEdit && (
                                <td className="py-2 px-3 text-center">
                                  {isFormula ? (
                                    <span className="text-slate-300 text-xs">—</span>
                                  ) : (
                                    <input
                                      type="number"
                                      min={0}
                                      value={edits[row.rowKey] ?? ""}
                                      onChange={(e) =>
                                        setEdits((prev) => ({
                                          ...prev,
                                          [row.rowKey]: Number(e.target.value),
                                        }))
                                      }
                                      placeholder={String(row.tong)}
                                      className="w-20 border border-slate-300 rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#003973]"
                                    />
                                  )}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                    </>
                  );
                })}

                {sectionKeys.length === 0 && (
                  <tr>
                    <td
                      colSpan={3 + draft.teams.length + (canEdit ? 1 : 0)}
                      className="py-10 text-center text-slate-400"
                    >
                      Không có dữ liệu.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Action bar */}
      <div className="mt-6 flex items-center justify-end gap-3 flex-wrap">
        {/* DRAFT: Save + Submit */}
        {draft.status === "DRAFT" && (
          <>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-[#003973] text-white rounded-lg hover:bg-[#0052a3] disabled:opacity-60 transition-colors"
            >
              <Send className="w-4 h-4" />
              Gửi xét duyệt
            </button>
          </>
        )}

        {/* REVIEWING: Approve + Reject (admin only) */}
        {draft.status === "REVIEWING" && isAdmin && (
          <>
            {canEdit && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors"
              >
                <Save className="w-4 h-4" />
                Lưu thay đổi
              </button>
            )}
            <button
              onClick={() => setShowRejectModal(true)}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60 transition-colors"
            >
              <XCircle className="w-4 h-4" />
              Từ chối
            </button>
            <button
              onClick={handleApprove}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-60 transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              Phê duyệt
            </button>
          </>
        )}

        {/* REJECTED: Reopen */}
        {draft.status === "REJECTED" && (
          <button
            onClick={handleReopen}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 border border-amber-400 text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 disabled:opacity-60 transition-colors"
          >
            <Unlock className="w-4 h-4" />
            Mở lại để sửa
          </button>
        )}

        {/* APPROVED: Finalize */}
        {draft.status === "APPROVED" && isAdmin && (
          <button
            onClick={handleFinalize}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-60 transition-colors"
          >
            <Lock className="w-4 h-4" />
            {saving ? "Đang xử lý..." : "Khóa & Xuất Excel"}
          </button>
        )}

        {/* FINALIZED: Download */}
        {draft.status === "FINALIZED" && (
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Tải về Excel
          </button>
        )}
      </div>
    </div>
  );
}
