import { useState } from "react";
import { X, Save, RefreshCw } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ResumeData {
  ngayPhucHoi: string;
  soQuyetDinhPhucHoi: string;
  ketQuaDuKien: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: ResumeData) => void;
}

const KET_QUA_OPTIONS = [
  { value: "DANG_DIEU_TRA_XAC_MINH", label: "Đang điều tra, xác minh (tiếp tục)" },
  { value: "KET_LUAN_DE_NGHI_TRUY_TO", label: "Kết luận đề nghị truy tố" },
  { value: "DINH_CHI_DIEU_TRA", label: "Đình chỉ điều tra" },
  { value: "TAM_DINH_CHI_LAI", label: "Tạm đình chỉ lại" },
  { value: "CHUYEN_CO_QUAN_DIEU_TRA_KHAC", label: "Chuyển cơ quan điều tra khác" },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function ResumeModal({ isOpen, onClose, onConfirm }: Props) {
  const [form, setForm] = useState<ResumeData>({
    ngayPhucHoi: "",
    soQuyetDinhPhucHoi: "",
    ketQuaDuKien: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.ngayPhucHoi) e.ngayPhucHoi = "Vui lòng chọn ngày phục hồi";
    if (!form.soQuyetDinhPhucHoi.trim()) e.soQuyetDinhPhucHoi = "Vui lòng nhập số quyết định phục hồi";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleConfirm = () => {
    if (validate()) {
      onConfirm(form);
    }
  };

  const handleClose = () => {
    setForm({ ngayPhucHoi: "", soQuyetDinhPhucHoi: "", ketQuaDuKien: "" });
    setErrors({});
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" data-testid="resume-modal">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-green-600" />
            Phục hồi điều tra
          </h2>
          <button onClick={handleClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Ngày phục hồi */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Ngày phục hồi <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={form.ngayPhucHoi}
              onChange={(e) => setForm({ ...form, ngayPhucHoi: e.target.value })}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-sm ${
                errors.ngayPhucHoi ? "border-red-300 focus:ring-red-400" : "border-slate-300 focus:ring-blue-500"
              }`}
              data-testid="input-ngay-phuc-hoi"
            />
            {errors.ngayPhucHoi && <p className="text-xs text-red-600 mt-1">{errors.ngayPhucHoi}</p>}
          </div>

          {/* Số quyết định phục hồi */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Số quyết định phục hồi <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.soQuyetDinhPhucHoi}
              onChange={(e) => setForm({ ...form, soQuyetDinhPhucHoi: e.target.value })}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-sm ${
                errors.soQuyetDinhPhucHoi ? "border-red-300 focus:ring-red-400" : "border-slate-300 focus:ring-blue-500"
              }`}
              placeholder="VD: 02/QĐ-CQĐT"
              data-testid="input-so-quyet-dinh-phuc-hoi"
            />
            {errors.soQuyetDinhPhucHoi && <p className="text-xs text-red-600 mt-1">{errors.soQuyetDinhPhucHoi}</p>}
          </div>

          {/* Kết quả dự kiến */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Kết quả dự kiến
            </label>
            <select
              value={form.ketQuaDuKien}
              onChange={(e) => setForm({ ...form, ketQuaDuKien: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
              data-testid="select-ket-qua-du-kien"
            >
              <option value="">-- Chọn kết quả dự kiến --</option>
              {KET_QUA_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
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
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
            data-testid="btn-confirm-resume"
          >
            <Save className="w-4 h-4" />
            Xác nhận phục hồi
          </button>
        </div>
      </div>
    </div>
  );
}
