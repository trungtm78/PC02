import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, X, Save, MessageSquare } from "lucide-react";
import { api } from "@/lib/api";

// ─── Types ───────────────────────────────────────────────────────────────────

interface VksMeeting {
  id: string;
  ngayTrao: string;
  soQuyetDinh: string | null;
  noiDung: string;
  ketQua: string | null;
  createdBy?: { id: string; firstName: string | null; lastName: string | null } | null;
}

interface Props {
  entityId: string;
  entityType: "case" | "incident";
  isReadOnly?: boolean;
}

interface MeetingForm {
  ngayTrao: string;
  soQuyetDinh: string;
  noiDung: string;
  ketQua: string;
}

const EMPTY_FORM: MeetingForm = {
  ngayTrao: "",
  soQuyetDinh: "",
  noiDung: "",
  ketQua: "",
};

// ─── Component ───────────────────────────────────────────────────────────────

export function VksMeetingsTab({ entityId, entityType, isReadOnly = false }: Props) {
  const [meetings, setMeetings] = useState<VksMeeting[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<MeetingForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const apiBase =
    entityType === "case"
      ? `/cases/${entityId}/vks-meetings`
      : `/incidents/${entityId}/vks-meetings`;

  const fetchMeetings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(apiBase);
      setMeetings(res.data.data ?? []);
    } catch {
      setMeetings([]);
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.ngayTrao) e.ngayTrao = "Vui lòng chọn ngày trao đổi";
    if (!form.noiDung.trim()) e.noiDung = "Vui lòng nhập nội dung";
    setFormErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    setFormError("");
    try {
      await api.post(apiBase, {
        ngayTrao: form.ngayTrao,
        soQuyetDinh: form.soQuyetDinh || null,
        noiDung: form.noiDung,
        ketQua: form.ketQua || null,
      });
      setShowModal(false);
      setForm(EMPTY_FORM);
      await fetchMeetings();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setFormError(Array.isArray(msg) ? msg.join(", ") : (msg ?? "Lưu thất bại. Vui lòng thử lại."));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Xóa biên bản này?")) return;
    try {
      await api.delete(`/vks-meetings/${id}`);
      await fetchMeetings();
    } catch {
      setMeetings((prev) => prev.filter((m) => m.id !== id));
    }
  };

  const handleOpenModal = () => {
    setForm(EMPTY_FORM);
    setFormError("");
    setFormErrors({});
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setForm(EMPTY_FORM);
    setFormError("");
    setFormErrors({});
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="vks-meetings-tab">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">
          Tổng cộng: <span className="font-semibold text-slate-800">{meetings.length}</span> biên bản
        </p>
        {!isReadOnly && (
          <button
            onClick={handleOpenModal}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            data-testid="btn-add-meeting"
          >
            <Plus className="w-4 h-4" />
            Thêm biên bản
          </button>
        )}
      </div>

      {/* Table */}
      {meetings.length === 0 ? (
        <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-lg">
          <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500 text-sm">Chưa có biên bản trao đổi VKS nào</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap">
                  Ngày trao đổi
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap">
                  Số QĐ liên quan
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Nội dung
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Kết quả
                </th>
                {!isReadOnly && (
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wide w-16">
                    Xóa
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {meetings.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50 transition-colors" data-testid={`meeting-row-${m.id}`}>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                    {m.ngayTrao ? new Date(m.ngayTrao).toLocaleDateString("vi-VN") : "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                    {m.soQuyetDinh ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-700 max-w-xs">
                    <p className="line-clamp-2">{m.noiDung}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700 max-w-xs">
                    <p className="line-clamp-2">{m.ketQua ?? "—"}</p>
                  </td>
                  {!isReadOnly && (
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleDelete(m.id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Xóa biên bản"
                        data-testid={`btn-delete-meeting-${m.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" data-testid="meeting-modal">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-blue-600" />
                Thêm biên bản trao đổi VKS
              </h2>
              <button onClick={handleCloseModal} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Ngày trao đổi */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Ngày trao đổi <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={form.ngayTrao}
                  onChange={(e) => setForm({ ...form, ngayTrao: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-sm ${
                    formErrors.ngayTrao ? "border-red-300 focus:ring-red-400" : "border-slate-300 focus:ring-blue-500"
                  }`}
                  data-testid="input-ngay-trao"
                />
                {formErrors.ngayTrao && <p className="text-xs text-red-600 mt-1">{formErrors.ngayTrao}</p>}
              </div>

              {/* Số QĐ liên quan */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Số QĐ liên quan
                </label>
                <input
                  type="text"
                  value={form.soQuyetDinh}
                  onChange={(e) => setForm({ ...form, soQuyetDinh: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="Số quyết định liên quan (nếu có)"
                  data-testid="input-so-quyet-dinh"
                />
              </div>

              {/* Nội dung */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Nội dung <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={form.noiDung}
                  onChange={(e) => setForm({ ...form, noiDung: e.target.value })}
                  rows={4}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-sm resize-none ${
                    formErrors.noiDung ? "border-red-300 focus:ring-red-400" : "border-slate-300 focus:ring-blue-500"
                  }`}
                  placeholder="Nội dung trao đổi với VKS..."
                  data-testid="textarea-noi-dung"
                />
                {formErrors.noiDung && <p className="text-xs text-red-600 mt-1">{formErrors.noiDung}</p>}
              </div>

              {/* Kết quả */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Kết quả
                </label>
                <textarea
                  value={form.ketQua}
                  onChange={(e) => setForm({ ...form, ketQua: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                  placeholder="Kết quả sau trao đổi (nếu có)..."
                  data-testid="textarea-ket-qua"
                />
              </div>

              {formError && <p className="text-sm text-red-600">{formError}</p>}
            </div>

            <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm"
              >
                Hủy
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-60"
                data-testid="btn-save-meeting"
              >
                <Save className="w-4 h-4" />
                {saving ? "Đang lưu..." : "Lưu biên bản"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
