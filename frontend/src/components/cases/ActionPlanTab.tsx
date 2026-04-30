import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, X, Save, ClipboardList } from "lucide-react";
import { api } from "@/lib/api";

// ─── Types ───────────────────────────────────────────────────────────────────

type TienDo = "DANG_THUC_HIEN" | "DAM_BAO" | "CHAM_TRE" | "KHONG_DAT";

interface ActionPlan {
  id: string;
  ngayLap: string;
  bienPhap: string;
  thoiHan: string | null;
  tienDo: TienDo | null;
  ketQua: string | null;
}

interface Props {
  entityId: string;
  entityType: "case" | "incident";
  isReadOnly?: boolean;
}

interface PlanForm {
  ngayLap: string;
  bienPhap: string;
  thoiHan: string;
  tienDo: TienDo | "";
  ketQua: string;
}

const EMPTY_FORM: PlanForm = {
  ngayLap: "",
  bienPhap: "",
  thoiHan: "",
  tienDo: "",
  ketQua: "",
};

const TIEN_DO_CONFIG: Record<TienDo, { label: string; className: string }> = {
  DANG_THUC_HIEN: { label: "Đang thực hiện", className: "bg-blue-100 text-blue-700" },
  DAM_BAO: { label: "Đảm bảo", className: "bg-green-100 text-green-700" },
  CHAM_TRE: { label: "Chậm trễ", className: "bg-yellow-100 text-yellow-700" },
  KHONG_DAT: { label: "Không đạt", className: "bg-red-100 text-red-700" },
};

// ─── Component ───────────────────────────────────────────────────────────────

export function ActionPlanTab({ entityId, entityType, isReadOnly = false }: Props) {
  const [plans, setPlans] = useState<ActionPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<PlanForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const apiBase =
    entityType === "case"
      ? `/cases/${entityId}/action-plans`
      : `/incidents/${entityId}/action-plans`;

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(apiBase);
      setPlans(res.data.data ?? []);
    } catch {
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.ngayLap) e.ngayLap = "Vui lòng chọn ngày lập";
    if (!form.bienPhap.trim()) e.bienPhap = "Vui lòng nhập biện pháp";
    setFormErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    setFormError("");
    try {
      await api.post(apiBase, {
        ngayLap: form.ngayLap,
        bienPhap: form.bienPhap,
        thoiHan: form.thoiHan || null,
        tienDo: form.tienDo || null,
        ketQua: form.ketQua || null,
      });
      setShowModal(false);
      setForm(EMPTY_FORM);
      await fetchPlans();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setFormError(Array.isArray(msg) ? msg.join(", ") : (msg ?? "Lưu thất bại. Vui lòng thử lại."));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Xóa kế hoạch này?")) return;
    try {
      await api.delete(`/action-plans/${id}`);
      await fetchPlans();
    } catch {
      setPlans((prev) => prev.filter((p) => p.id !== id));
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
    <div className="space-y-4" data-testid="action-plan-tab">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">
          Tổng cộng: <span className="font-semibold text-slate-800">{plans.length}</span> kế hoạch
        </p>
        {!isReadOnly && (
          <button
            onClick={handleOpenModal}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            data-testid="btn-add-action-plan"
          >
            <Plus className="w-4 h-4" />
            Thêm kế hoạch
          </button>
        )}
      </div>

      {/* Table */}
      {plans.length === 0 ? (
        <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-lg">
          <ClipboardList className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500 text-sm">Chưa có kế hoạch khắc phục nào</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap">
                  Ngày lập
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Biện pháp
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap">
                  Thời hạn
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap">
                  Tiến độ
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
              {plans.map((p) => {
                const tienDoCfg = p.tienDo ? TIEN_DO_CONFIG[p.tienDo] : null;
                return (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors" data-testid={`plan-row-${p.id}`}>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                      {p.ngayLap ? new Date(p.ngayLap).toLocaleDateString("vi-VN") : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-700 max-w-xs">
                      <p className="line-clamp-2">{p.bienPhap}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                      {p.thoiHan ? new Date(p.thoiHan).toLocaleDateString("vi-VN") : "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {tienDoCfg ? (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tienDoCfg.className}`}>
                          {tienDoCfg.label}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700 max-w-xs">
                      <p className="line-clamp-2">{p.ketQua ?? "—"}</p>
                    </td>
                    {!isReadOnly && (
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Xóa kế hoạch"
                          data-testid={`btn-delete-plan-${p.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" data-testid="action-plan-modal">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-blue-600" />
                Thêm kế hoạch khắc phục
              </h2>
              <button onClick={handleCloseModal} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Ngày lập */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Ngày lập <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={form.ngayLap}
                  onChange={(e) => setForm({ ...form, ngayLap: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-sm ${
                    formErrors.ngayLap ? "border-red-300 focus:ring-red-400" : "border-slate-300 focus:ring-blue-500"
                  }`}
                  data-testid="input-ngay-lap"
                />
                {formErrors.ngayLap && <p className="text-xs text-red-600 mt-1">{formErrors.ngayLap}</p>}
              </div>

              {/* Biện pháp */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Biện pháp <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={form.bienPhap}
                  onChange={(e) => setForm({ ...form, bienPhap: e.target.value })}
                  rows={4}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-sm resize-none ${
                    formErrors.bienPhap ? "border-red-300 focus:ring-red-400" : "border-slate-300 focus:ring-blue-500"
                  }`}
                  placeholder="Mô tả biện pháp khắc phục..."
                  data-testid="textarea-bien-phap"
                />
                {formErrors.bienPhap && <p className="text-xs text-red-600 mt-1">{formErrors.bienPhap}</p>}
              </div>

              {/* Thời hạn */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Thời hạn
                </label>
                <input
                  type="date"
                  value={form.thoiHan}
                  onChange={(e) => setForm({ ...form, thoiHan: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  data-testid="input-thoi-han"
                />
              </div>

              {/* Tiến độ */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Tiến độ
                </label>
                <select
                  value={form.tienDo}
                  onChange={(e) => setForm({ ...form, tienDo: e.target.value as TienDo | "" })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                  data-testid="select-tien-do"
                >
                  <option value="">-- Chọn tiến độ --</option>
                  {(Object.keys(TIEN_DO_CONFIG) as TienDo[]).map((key) => (
                    <option key={key} value={key}>
                      {TIEN_DO_CONFIG[key].label}
                    </option>
                  ))}
                </select>
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
                  placeholder="Kết quả thực hiện (nếu có)..."
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
                data-testid="btn-save-action-plan"
              >
                <Save className="w-4 h-4" />
                {saving ? "Đang lưu..." : "Lưu kế hoạch"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
