import { useState } from "react";
import { X, Save, AlertTriangle } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SuspensionData {
  ngayQuyetDinh: string;
  soQuyetDinh: string;
  lyDo: string;
  laCongNgheCao: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: SuspensionData) => void;
  isLegacyCase: boolean;
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

export function SuspensionModal({ isOpen, onClose, onConfirm, isLegacyCase }: Props) {
  const [form, setForm] = useState<SuspensionData>({
    ngayQuyetDinh: "",
    soQuyetDinh: "",
    lyDo: "",
    laCongNgheCao: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.ngayQuyetDinh) e.ngayQuyetDinh = "Vui lòng chọn ngày ra quyết định";
    if (!form.soQuyetDinh.trim()) e.soQuyetDinh = "Vui lòng nhập số quyết định";
    if (!isLegacyCase && !form.lyDo) e.lyDo = "Vui lòng chọn lý do tạm đình chỉ";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleConfirm = () => {
    if (validate()) {
      onConfirm(form);
    }
  };

  const handleClose = () => {
    setForm({ ngayQuyetDinh: "", soQuyetDinh: "", lyDo: "", laCongNgheCao: false });
    setErrors({});
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" data-testid="suspension-modal">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Tạm đình chỉ điều tra
          </h2>
          <button onClick={handleClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Legacy warning banner */}
          {isLegacyCase && (
            <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-300 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-800">
                Vụ án này chưa có lý do TĐC theo quy định mới. Điền để cải thiện báo cáo thống kê, hoặc bỏ qua.
              </p>
            </div>
          )}

          {/* Ngày ra quyết định */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Ngày ra quyết định <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={form.ngayQuyetDinh}
              onChange={(e) => setForm({ ...form, ngayQuyetDinh: e.target.value })}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-sm ${
                errors.ngayQuyetDinh ? "border-red-300 focus:ring-red-400" : "border-slate-300 focus:ring-blue-500"
              }`}
              data-testid="input-ngay-quyet-dinh"
            />
            {errors.ngayQuyetDinh && <p className="text-xs text-red-600 mt-1">{errors.ngayQuyetDinh}</p>}
          </div>

          {/* Số quyết định */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Số quyết định <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.soQuyetDinh}
              onChange={(e) => setForm({ ...form, soQuyetDinh: e.target.value })}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-sm ${
                errors.soQuyetDinh ? "border-red-300 focus:ring-red-400" : "border-slate-300 focus:ring-blue-500"
              }`}
              placeholder="VD: 01/QĐ-CQĐT"
              data-testid="input-so-quyet-dinh"
            />
            {errors.soQuyetDinh && <p className="text-xs text-red-600 mt-1">{errors.soQuyetDinh}</p>}
          </div>

          {/* Lý do tạm đình chỉ */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Lý do tạm đình chỉ{" "}
              {!isLegacyCase && <span className="text-red-500">*</span>}
              {isLegacyCase && <span className="text-slate-400 font-normal">(không bắt buộc)</span>}
            </label>
            <select
              value={form.lyDo}
              onChange={(e) => setForm({ ...form, lyDo: e.target.value })}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-sm bg-white ${
                errors.lyDo ? "border-red-300 focus:ring-red-400" : "border-slate-300 focus:ring-blue-500"
              }`}
              data-testid="select-ly-do"
            >
              <option value="">-- Chọn lý do --</option>
              {LY_DO_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {errors.lyDo && <p className="text-xs text-red-600 mt-1">{errors.lyDo}</p>}
          </div>

          {/* Checkbox công nghệ cao */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.laCongNgheCao}
              onChange={(e) => setForm({ ...form, laCongNgheCao: e.target.checked })}
              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              data-testid="checkbox-cong-nghe-cao"
            />
            <span className="text-sm text-slate-700">Vụ án công nghệ cao</span>
          </label>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={handleClose}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm"
          >
            Hủy
          </button>
          <button
            onClick={handleConfirm}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm font-medium"
            data-testid="btn-confirm-suspension"
          >
            <Save className="w-4 h-4" />
            Xác nhận TĐC
          </button>
        </div>
      </div>
    </div>
  );
}
