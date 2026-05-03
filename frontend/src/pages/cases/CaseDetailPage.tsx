import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { api } from "@/lib/api";
import { usePermission } from "@/hooks/usePermission";
import { AssignModal } from "@/components/AssignModal";
import {
  ConclusionStatus,
  CONCLUSION_STATUS_LABEL,
} from "@/shared/enums/conclusion-status";

type ConclusionStatusLabel = (typeof CONCLUSION_STATUS_LABEL)[ConclusionStatus];

import {
  ArrowLeft,
  Calendar,
  User,
  MapPin,
  FileText,
  Users,
  Clock,
  AlertTriangle,
  Scale,
  Plus,
  Edit,
  Trash2,
  X,
  Save,
  AlertCircle,
  Building2,
  Phone,
  Hash,
  Gavel,
  BookOpen,
  Info,
  Briefcase,
  CheckCircle,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Defendant {
  id: string;
  name: string;
  idNumber: string;
  dateOfBirth: string;
  address: string;
  phone: string;
  chargesAgainst: string;      // crimeId (UUID) từ dropdown
  chargesLabel: string;        // tên tội danh để hiển thị
  detentionStatus: "Tự do" | "Tạm giam" | "Đang điều tra";
  detentionLocation?: string;
  detentionDate?: string;
  detentionExpiry?: string;
}

interface CrimeOption {
  id: string;
  name: string;
  code: string;
}

interface Lawyer {
  id: string;
  name: string;
  barNumber: string;
  phone: string;
  email: string;
  lawFirm: string;
  assignedTo: string; // defendant name
}

interface TimelineEvent {
  id: string;
  date: string;
  time: string;
  datetime: string;
  title: string;
  description: string;
  type: "info" | "warning" | "success" | "danger";
  actor: string;
}

interface Conclusion {
  id: string;
  type: string;
  date: string;
  content: string;
  author: string;
  approvedBy: string;
  status: ConclusionStatusLabel;
}

// ─── API helpers ─────────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, Defendant["detentionStatus"]> = {
  INVESTIGATING: "Đang điều tra",
  DETAINED: "Tạm giam",
  RELEASED: "Tự do",
  WANTED: "Tự do",
};

function subjectToDefendant(s: any): Defendant {
  return {
    id: s.id,
    name: s.fullName,
    idNumber: s.idNumber,
    dateOfBirth: s.dateOfBirth ? new Date(s.dateOfBirth).toISOString().slice(0, 10) : "",
    address: s.address,
    phone: s.phone ?? "",
    chargesAgainst: s.crimeId ?? "",
    chargesLabel: s.crime?.name ?? s.crimeId ?? "",
    detentionStatus: STATUS_MAP[s.status] ?? "Đang điều tra",
    detentionLocation: undefined,
    detentionDate: undefined,
    detentionExpiry: undefined,
  };
}

function lawyerApiToLocal(l: any): Lawyer {
  return {
    id: l.id,
    name: l.fullName,
    barNumber: l.barNumber,
    phone: l.phone ?? "",
    email: "",
    lawFirm: l.lawFirm ?? "",
    assignedTo: l.subject?.fullName ?? "",
  };
}

// ─── Timeline constants ───────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  TIEP_NHAN:      "Tiếp nhận",
  DANG_XAC_MINH:  "Đang xác minh",
  DA_XAC_MINH:    "Đã xác minh",
  DANG_DIEU_TRA:  "Đang điều tra",
  TAM_DINH_CHI:   "Tạm đình chỉ",
  DINH_CHI:       "Đình chỉ",
  DA_KET_LUAN:    "Đã kết luận",
  DANG_TRUY_TO:   "Đang truy tố",
  DANG_XET_XU:    "Đang xét xử",
  DA_LUU_TRU:     "Đã lưu trữ",
  KHOI_TO:        "Khởi tố vụ án",
  DA_KET_THUC:    "Đã kết thúc",
};

const STATUS_TO_EVENT_TYPE: Record<string, "info" | "warning" | "success" | "danger"> = {
  TIEP_NHAN:      "info",
  DANG_XAC_MINH:  "info",
  DA_XAC_MINH:    "info",
  DANG_DIEU_TRA:  "info",
  KHOI_TO:        "danger",
  TAM_DINH_CHI:   "danger",
  DINH_CHI:       "danger",
  DA_KET_LUAN:    "success",
  DANG_TRUY_TO:   "warning",
  DANG_XET_XU:    "warning",
  DA_LUU_TRU:     "success",
  DA_KET_THUC:    "success",
};

function historyRowToTimeline(row: any): TimelineEvent {
  const statusName = STATUS_LABEL[row.toStatus as string] ?? row.toStatus ?? "—";
  const eventType = STATUS_TO_EVENT_TYPE[row.toStatus as string] ?? "info";
  const actor = row.changedBy
    ? `${row.changedBy.firstName ?? ""} ${row.changedBy.lastName ?? ""}`.trim() || row.changedBy.username
    : "Hệ thống";
  const dt = new Date(row.changedAt);
  return {
    id: row.id,
    date: dt.toLocaleDateString("vi-VN"),
    time: dt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
    datetime: dt.toLocaleString("vi-VN"),
    title: statusName,
    description: "",
    type: eventType,
    actor,
  };
}

interface InvestigationSupplement {
  id: string;
  type: string;
  decisionNumber: string;
  decisionDate: string | null;
  reason: string;
  deadline: string | null;
  createdAt: string;
  createdBy: { id: string; firstName: string | null; lastName: string | null; username: string } | null;
}

function supplementToTimeline(s: InvestigationSupplement): TimelineEvent {
  const dt = new Date(s.createdAt);
  return {
    id: `supp-${s.id}`,
    date: dt.toLocaleDateString("vi-VN"),
    time: dt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
    datetime: dt.toLocaleString("vi-VN"),
    title: s.type === "Điều tra lại" ? "Quyết định điều tra lại" : "Quyết định điều tra bổ sung",
    description: `Số quyết định: ${s.decisionNumber}. ${s.reason}`,
    type: "warning",
    actor: s.createdBy ? `${s.createdBy.firstName ?? ""} ${s.createdBy.lastName ?? ""}`.trim() || s.createdBy.username : "Hệ thống",
  };
}

function conclusionApiToLocal(c: any): Conclusion {
  return {
    id: c.id,
    type: c.type,
    date: c.createdAt ? new Date(c.createdAt).toISOString().slice(0, 10) : "",
    content: c.content,
    author: c.author ? `${c.author.firstName ?? ""} ${c.author.lastName ?? ""}`.trim() : "",
    approvedBy: c.approvedBy ? `${c.approvedBy.firstName ?? ""} ${c.approvedBy.lastName ?? ""}`.trim() : "",
    status:
      c.status === ConclusionStatus.DA_DUYET
        ? CONCLUSION_STATUS_LABEL[ConclusionStatus.DA_DUYET]
        : c.status === ConclusionStatus.CHO_DUYET
        ? CONCLUSION_STATUS_LABEL[ConclusionStatus.CHO_DUYET]
        : CONCLUSION_STATUS_LABEL[ConclusionStatus.DU_THAO],
  };
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function isOverdue(deadline: string): boolean {
  return new Date(deadline) < new Date(new Date().toDateString());
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function DefendantModal({
  defendant,
  crimes,
  loadingCrimes,
  error,
  onClose,
  onSave,
}: {
  defendant: Defendant | null;
  crimes: CrimeOption[];
  loadingCrimes: boolean;
  error: string;
  onClose: () => void;
  onSave: (d: Defendant) => void;
}) {
  const [form, setForm] = useState<Defendant>(
    defendant ?? {
      id: "",
      name: "",
      idNumber: "",
      dateOfBirth: "",
      address: "",
      phone: "",
      chargesAgainst: "",
      chargesLabel: "",
      detentionStatus: "Đang điều tra",
    }
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Vui lòng nhập họ tên";
    if (!form.idNumber.trim()) {
      e.idNumber = "Vui lòng nhập số CCCD/CMND";
    } else if (!/^\d{9}$|^\d{12}$/.test(form.idNumber.trim())) {
      e.idNumber = "Số CCCD/CMND phải có 9 hoặc 12 chữ số";
    }
    if (!form.dateOfBirth) e.dateOfBirth = "Vui lòng nhập ngày sinh";
    if (!form.address.trim()) e.address = "Vui lòng nhập địa chỉ";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (validate()) onSave({ ...form, id: form.id || `BC-${Date.now()}` });
  };

  const handleCrimeChange = (crimeId: string) => {
    const found = crimes.find((c) => c.id === crimeId);
    setForm({ ...form, chargesAgainst: crimeId, chargesLabel: found?.name ?? "" });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" data-testid="defendant-modal">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            {defendant ? "Chỉnh sửa bị can" : "Thêm bị can mới"}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Họ và tên <span className="text-red-500">*</span>
              </label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${errors.name ? "border-red-300 focus:ring-red-400" : "border-slate-300 focus:ring-blue-500"}`}
                placeholder="Họ và tên đầy đủ"
                data-testid="input-defendant-name"
              />
              {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Số CCCD/CMND <span className="text-red-500">*</span>
              </label>
              <input
                value={form.idNumber}
                onChange={(e) => setForm({ ...form, idNumber: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${errors.idNumber ? "border-red-300 focus:ring-red-400" : "border-slate-300 focus:ring-blue-500"}`}
                placeholder="012345678901"
                data-testid="input-defendant-id"
              />
              {errors.idNumber && <p className="text-xs text-red-600 mt-1">{errors.idNumber}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Ngày sinh <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={form.dateOfBirth}
                onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${errors.dateOfBirth ? "border-red-300 focus:ring-red-400" : "border-slate-300 focus:ring-blue-500"}`}
              />
              {errors.dateOfBirth && <p className="text-xs text-red-600 mt-1">{errors.dateOfBirth}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Số điện thoại</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="09xxxxxxxx"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Tình trạng giam giữ</label>
              <select
                value={form.detentionStatus}
                onChange={(e) => setForm({ ...form, detentionStatus: e.target.value as Defendant["detentionStatus"] })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                data-testid="select-detention-status"
              >
                <option value="Đang điều tra">Đang điều tra</option>
                <option value="Tạm giam">Tạm giam</option>
                <option value="Tự do">Tự do</option>
              </select>
            </div>
            {form.detentionStatus === "Tạm giam" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Ngày tạm giam</label>
                  <input
                    type="date"
                    value={form.detentionDate ?? ""}
                    onChange={(e) => setForm({ ...form, detentionDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Hạn tạm giam</label>
                  <input
                    type="date"
                    value={form.detentionExpiry ?? ""}
                    onChange={(e) => setForm({ ...form, detentionExpiry: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Nơi giam giữ</label>
                  <input
                    value={form.detentionLocation ?? ""}
                    onChange={(e) => setForm({ ...form, detentionLocation: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Trại tạm giam B34..."
                  />
                </div>
              </>
            )}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Địa chỉ thường trú <span className="text-red-500">*</span>
              </label>
              <input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${errors.address ? "border-red-300 focus:ring-red-400" : "border-slate-300 focus:ring-blue-500"}`}
                placeholder="Địa chỉ đầy đủ"
              />
              {errors.address && <p className="text-xs text-red-600 mt-1">{errors.address}</p>}
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Tội danh bị truy tố</label>
              <select
                value={form.chargesAgainst}
                onChange={(e) => handleCrimeChange(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                disabled={loadingCrimes}
                data-testid="select-crime"
              >
                <option value="">{loadingCrimes ? "Đang tải danh mục..." : "-- Chọn tội danh --"}</option>
                {crimes.map((c) => (
                  <option key={c.id} value={c.id}>{c.code ? `[${c.code}] ` : ""}{c.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex-1">
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors">
              Hủy
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              data-testid="btn-save-defendant"
            >
              <Save className="w-4 h-4" />
              {defendant ? "Cập nhật" : "Thêm mới"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LawyerModal({
  lawyer,
  defendants,
  onClose,
  onSave,
}: {
  lawyer: Lawyer | null;
  defendants: Defendant[];
  onClose: () => void;
  onSave: (l: Lawyer) => void;
}) {
  const [form, setForm] = useState<Lawyer>(
    lawyer ?? {
      id: "",
      name: "",
      barNumber: "",
      phone: "",
      email: "",
      lawFirm: "",
      assignedTo: defendants[0]?.name ?? "",
    }
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Vui lòng nhập họ tên";
    if (!form.barNumber.trim()) e.barNumber = "Vui lòng nhập số thẻ luật sư";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" data-testid="lawyer-modal">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Scale className="w-5 h-5 text-purple-600" />
            {lawyer ? "Chỉnh sửa luật sư" : "Gán luật sư"}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Họ và tên luật sư <span className="text-red-500">*</span>
            </label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${errors.name ? "border-red-300 focus:ring-red-400" : "border-slate-300 focus:ring-blue-500"}`}
              placeholder="Họ và tên đầy đủ"
              data-testid="input-lawyer-name"
            />
            {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Số thẻ luật sư <span className="text-red-500">*</span>
            </label>
            <input
              value={form.barNumber}
              onChange={(e) => setForm({ ...form, barNumber: e.target.value })}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${errors.barNumber ? "border-red-300 focus:ring-red-400" : "border-slate-300 focus:ring-blue-500"}`}
              placeholder="LS-HCM-0042"
              data-testid="input-bar-number"
            />
            {errors.barNumber && <p className="text-xs text-red-600 mt-1">{errors.barNumber}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Số điện thoại</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="09xxxxxxxx"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="email@example.com"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Văn phòng luật</label>
            <input
              value={form.lawFirm}
              onChange={(e) => setForm({ ...form, lawFirm: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Tên văn phòng/công ty luật"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Bào chữa cho bị can</label>
            <select
              value={form.assignedTo}
              onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              data-testid="select-assigned-defendant"
            >
              <option value="">-- Chọn bị can --</option>
              {defendants.map((d) => (
                <option key={d.id} value={d.name}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors">Hủy</button>
          <button
            onClick={() => { if (validate()) onSave({ ...form, id: form.id || `LS-${Date.now()}` }); }}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
            data-testid="btn-save-lawyer"
          >
            <Save className="w-4 h-4" />
            {lawyer ? "Cập nhật" : "Gán luật sư"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConclusionModal({
  conclusion,
  onClose,
  onSave,
}: {
  conclusion: Conclusion | null;
  onClose: () => void;
  onSave: (c: Conclusion) => void;
}) {
  const [form, setForm] = useState<Conclusion>(
    conclusion ?? {
      id: "",
      type: "Kết luận điều tra",
      date: new Date().toISOString().split("T")[0],
      content: "",
      author: "",
      approvedBy: "",
      status: CONCLUSION_STATUS_LABEL[ConclusionStatus.DU_THAO],
    }
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" data-testid="conclusion-modal">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Gavel className="w-5 h-5 text-amber-600" />
            {conclusion ? "Chỉnh sửa kết luận" : "Thêm kết luận điều tra"}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Loại kết luận</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="Kết luận điều tra">Kết luận điều tra</option>
                <option value="Kết luận giám định">Kết luận giám định</option>
                <option value="Đề nghị truy tố">Đề nghị truy tố</option>
                <option value="Đình chỉ điều tra">Đình chỉ điều tra</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Ngày ban hành</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Người lập</label>
              <input
                value={form.author}
                onChange={(e) => setForm({ ...form, author: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Tên điều tra viên"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Người duyệt</label>
              <input
                value={form.approvedBy}
                onChange={(e) => setForm({ ...form, approvedBy: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Tên lãnh đạo duyệt"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Trạng thái</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as Conclusion["status"] })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {Object.values(CONCLUSION_STATUS_LABEL).map((label) => (
                  <option key={label} value={label}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Nội dung kết luận</label>
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              rows={6}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Nội dung chi tiết kết luận điều tra..."
              data-testid="textarea-conclusion-content"
            />
          </div>
        </div>
        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors">Hủy</button>
          <button
            onClick={() => onSave({ ...form, id: form.id || `KL-${Date.now()}` })}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium"
            data-testid="btn-save-conclusion"
          >
            <Save className="w-4 h-4" />
            {conclusion ? "Cập nhật" : "Lưu kết luận"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

type DetailTabId = "info" | "defendants" | "lawyers" | "timeline" | "conclusion";

const DETAIL_TABS: { id: DetailTabId; label: string; icon: React.ReactNode }[] = [
  { id: "info", label: "Thông tin chung", icon: <Info className="w-4 h-4" /> },
  { id: "defendants", label: "Bị can", icon: <Users className="w-4 h-4" /> },
  { id: "lawyers", label: "Luật sư", icon: <Briefcase className="w-4 h-4" /> },
  { id: "timeline", label: "Tiến trình điều tra", icon: <Clock className="w-4 h-4" /> },
  { id: "conclusion", label: "Kết luận điều tra", icon: <FileText className="w-4 h-4" /> },
];

export default function CaseDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const { canDispatch } = usePermission();

  // Đọc activeTab từ navigation state (khi navigate từ CaseListPage action menu)
  const initialTab = (() => {
    const stateTab = (location.state as { activeTab?: string } | null)?.activeTab;
    const validTabs: DetailTabId[] = ["info", "defendants", "lawyers", "timeline", "conclusion"];
    return (validTabs.includes(stateTab as DetailTabId) ? stateTab : "info") as DetailTabId;
  })();

  const [activeTab, setActiveTab] = useState<DetailTabId>(initialTab);
  const [showAssignModal, setShowAssignModal] = useState(false);

  // Case data from API
  const [caseData, setCaseData] = useState<any>(null);
  const [loadingCase, setLoadingCase] = useState(true);

  // Defendants state
  const [defendants, setDefendants] = useState<Defendant[]>([]);
  const [loadingDefendants, setLoadingDefendants] = useState(false);
  const [showDefendantModal, setShowDefendantModal] = useState(false);
  const [editingDefendant, setEditingDefendant] = useState<Defendant | null>(null);
  const [defendantError, setDefendantError] = useState<string>("");

  // Crime options for defendant form
  const [crimes, setCrimes] = useState<CrimeOption[]>([]);
  const [loadingCrimes, setLoadingCrimes] = useState(false);

  // Lawyers state
  const [lawyers, setLawyers] = useState<Lawyer[]>([]);
  const [loadingLawyers, setLoadingLawyers] = useState(false);
  const [showLawyerModal, setShowLawyerModal] = useState(false);
  const [editingLawyer, setEditingLawyer] = useState<Lawyer | null>(null);

  // Timeline state (from audit logs)
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  // Conclusion state
  const [conclusions, setConclusions] = useState<Conclusion[]>([]);
  const [loadingConclusions, setLoadingConclusions] = useState(false);
  const [showConclusionModal, setShowConclusionModal] = useState(false);
  const [editingConclusion, setEditingConclusion] = useState<Conclusion | null>(null);

  // Supplementary Investigation state
  const [showSupplementModal, setShowSupplementModal] = useState(false);
  const [supplementSaving, setSupplementSaving] = useState(false);
  const [supplementForm, setSupplementForm] = useState({
    type: "",
    decisionNumber: "",
    decisionDate: "",
    reason: "",
    deadline: "",
  });

  // Cập nhật tiến độ modal state
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressStatus, setProgressStatus] = useState("");
  const [progressDeadline, setProgressDeadline] = useState("");
  const [progressSaving, setProgressSaving] = useState(false);
  const [progressError, setProgressError] = useState("");

  const overdue = caseData?.deadline ? isOverdue(caseData.deadline) : false;
  const caseDeadline = caseData?.deadline
    ? new Date(caseData.deadline).toLocaleDateString("vi-VN")
    : "";

  // ─── API fetchers ──────────────────────────────────────────────────────────

  // Fetch case info
  useEffect(() => {
    if (!id) return;
    setLoadingCase(true);
    api.get(`/cases/${id}`)
      .then((res) => setCaseData(res.data.data))
      .catch(() => setCaseData(null))
      .finally(() => setLoadingCase(false));
  }, [id]);

  // Fetch defendants (subjects type=SUSPECT)
  const fetchDefendants = useCallback(async () => {
    if (!id) return;
    setLoadingDefendants(true);
    try {
      const res = await api.get(`/subjects?caseId=${id}&type=SUSPECT&limit=100`);
      setDefendants((res.data.data ?? []).map(subjectToDefendant));
    } catch {
      setDefendants([]);
    } finally {
      setLoadingDefendants(false);
    }
  }, [id]);

  // Fetch crime options for defendant form
  const fetchCrimes = useCallback(async () => {
    if (crimes.length > 0) return; // already loaded
    setLoadingCrimes(true);
    try {
      const res = await api.get("/directories?type=CRIME&limit=200");
      setCrimes((res.data.data ?? []).map((d: any) => ({ id: d.id, name: d.name, code: d.code ?? "" })));
    } catch {
      setCrimes([]);
    } finally {
      setLoadingCrimes(false);
    }
  }, [crimes.length]);

  // Fetch lawyers
  const fetchLawyers = useCallback(async () => {
    if (!id) return;
    setLoadingLawyers(true);
    try {
      const res = await api.get(`/lawyers?caseId=${id}&limit=100`);
      setLawyers((res.data.data ?? []).map(lawyerApiToLocal));
    } catch {
      setLawyers([]);
    } finally {
      setLoadingLawyers(false);
    }
  }, [id]);

  // Fetch timeline (audit logs for this case) + supplements
  const fetchTimeline = useCallback(async () => {
    if (!id) return;
    setLoadingTimeline(true);
    try {
      const [historyRes, supplementsRes] = await Promise.all([
        api.get(`/cases/${id}/status-history`),
        api.get(`/investigation-supplements?caseId=${id}&limit=50`),
      ]);
      const historyRows: any[] = historyRes.data.data ?? [];
      const supplementRows: InvestigationSupplement[] = supplementsRes.data.data ?? [];
      const historyEvents = Array.isArray(historyRows) ? historyRows.map(historyRowToTimeline) : [];
      const supplementEvents = supplementRows.map(supplementToTimeline);
      const merged = [...historyEvents, ...supplementEvents].sort((a, b) =>
        new Date(b.datetime).getTime() - new Date(a.datetime).getTime()
      );
      setTimeline(merged);
    } catch {
      setTimeline([]);
    } finally {
      setLoadingTimeline(false);
    }
  }, [id]);

  // Fetch conclusions
  const fetchConclusions = useCallback(async () => {
    if (!id) return;
    setLoadingConclusions(true);
    try {
      const res = await api.get(`/conclusions?caseId=${id}&limit=50`);
      setConclusions((res.data.data ?? []).map(conclusionApiToLocal));
    } catch {
      setConclusions([]);
    } finally {
      setLoadingConclusions(false);
    }
  }, [id]);

  // Fetch data based on active tab
  useEffect(() => {
    if (activeTab === "defendants") { fetchDefendants(); fetchCrimes(); }
    if (activeTab === "lawyers") fetchLawyers();
    if (activeTab === "timeline") fetchTimeline();
    if (activeTab === "conclusion") fetchConclusions();
  }, [activeTab, fetchDefendants, fetchCrimes, fetchLawyers, fetchTimeline, fetchConclusions]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleSaveDefendant = async (d: Defendant) => {
    setDefendantError("");
    try {
      const STATUS_REVERSE: Record<string, string> = {
        "Đang điều tra": "INVESTIGATING",
        "Tạm giam": "DETAINED",
        "Tự do": "RELEASED",
      };
      const payload: Record<string, unknown> = {
        fullName: d.name,
        idNumber: d.idNumber,
        dateOfBirth: d.dateOfBirth || undefined,
        address: d.address,
        phone: d.phone || undefined,
        caseId: id!,
        type: "SUSPECT",
        status: STATUS_REVERSE[d.detentionStatus] ?? "INVESTIGATING",
      };
      // chỉ gửi crimeId khi có chọn từ dropdown (là UUID hợp lệ)
      if (d.chargesAgainst) payload.crimeId = d.chargesAgainst;
      if (editingDefendant) {
        await api.put(`/subjects/${d.id}`, payload);
      } else {
        await api.post("/subjects", payload);
      }
      setShowDefendantModal(false);
      setEditingDefendant(null);
      await fetchDefendants();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setDefendantError(
        Array.isArray(msg) ? msg.join(", ") : (msg ?? "Lưu bị can thất bại. Vui lòng thử lại.")
      );
    }
  };

  const handleSaveLawyer = async (l: Lawyer) => {
    try {
      const payload = {
        fullName: l.name,
        barNumber: l.barNumber,
        phone: l.phone,
        lawFirm: l.lawFirm,
        caseId: id!,
      };
      if (editingLawyer) {
        await api.put(`/lawyers/${l.id}`, payload);
      } else {
        await api.post("/lawyers", payload);
      }
      setShowLawyerModal(false);
      setEditingLawyer(null);
      await fetchLawyers();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      alert(Array.isArray(msg) ? msg.join(", ") : (msg ?? "Lưu luật sư thất bại. Vui lòng thử lại."));
    }
  };

  const handleSaveConclusion = async (c: Conclusion) => {
    try {
      const STATUS_API_MAP: Record<string, string> = {
        [CONCLUSION_STATUS_LABEL[ConclusionStatus.DU_THAO]]: ConclusionStatus.DU_THAO,
        [CONCLUSION_STATUS_LABEL[ConclusionStatus.CHO_DUYET]]: ConclusionStatus.CHO_DUYET,
        [CONCLUSION_STATUS_LABEL[ConclusionStatus.DA_DUYET]]: ConclusionStatus.DA_DUYET,
      };
      if (editingConclusion) {
        await api.put(`/conclusions/${c.id}`, {
          type: c.type,
          content: c.content,
          status: STATUS_API_MAP[c.status] ?? ConclusionStatus.DU_THAO,
          notes: "",
        });
      } else {
        await api.post("/conclusions", {
          caseId: id,
          type: c.type,
          content: c.content,
          status: STATUS_API_MAP[c.status] ?? ConclusionStatus.DU_THAO,
        });
      }
      await fetchConclusions();
    } catch {
      // silently fail — keep UI state
      setConclusions((prev) =>
        editingConclusion ? prev.map((x) => (x.id === c.id ? c : x)) : [...prev, c]
      );
    }
    setShowConclusionModal(false);
    setEditingConclusion(null);
  };

  // Mở modal cập nhật tiến độ — khởi tạo từ caseData hiện tại
  const handleOpenProgress = () => {
    setProgressStatus(caseData?.status ?? "");
    setProgressDeadline(
      caseData?.deadline ? new Date(caseData.deadline).toISOString().slice(0, 10) : ""
    );
    setProgressError("");
    setShowProgressModal(true);
  };

  const handleSaveProgress = async () => {
    if (!progressStatus) { setProgressError("Vui lòng chọn trạng thái"); return; }
    setProgressSaving(true);
    setProgressError("");
    try {
      const payload: Record<string, unknown> = { status: progressStatus };
      if (progressDeadline) payload.deadline = progressDeadline;
      const res = await api.put(`/cases/${id}`, payload);
      setCaseData(res.data.data);
      setShowProgressModal(false);
      if (activeTab === "timeline") fetchTimeline();
    } catch (e: any) {
      setProgressError(e?.response?.data?.message ?? "Lưu thất bại, thử lại.");
    } finally {
      setProgressSaving(false);
    }
  };

  const handleSaveSupplement = async () => {
    if (!supplementForm.type || !supplementForm.decisionNumber || !supplementForm.reason) {
      return;
    }
    setSupplementSaving(true);
    try {
      await api.post("/investigation-supplements", {
        caseId: id,
        type: supplementForm.type,
        decisionNumber: supplementForm.decisionNumber,
        decisionDate: supplementForm.decisionDate || null,
        reason: supplementForm.reason,
        deadline: supplementForm.deadline || null,
      });
      setShowSupplementModal(false);
      setSupplementForm({ type: "", decisionNumber: "", decisionDate: "", reason: "", deadline: "" });
      fetchTimeline();
    } catch {
    } finally {
      setSupplementSaving(false);
    }
  };

  // ─── Tab contents ──────────────────────────────────────────────────────────

  const renderInfoTab = () => {
    if (loadingCase) {
      return (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      );
    }
    const investigatorName = caseData?.investigator
      ? `${caseData.investigator.firstName ?? ""} ${caseData.investigator.lastName ?? ""}`.trim() || caseData.investigator.username
      : "Chưa phân công";
    const createdAt = caseData?.createdAt
      ? new Date(caseData.createdAt).toLocaleDateString("vi-VN")
      : "";
    return (
      <div className="space-y-6" data-testid="tab-content-info">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Thông tin cơ bản */}
          <div className="bg-slate-50 rounded-lg p-5 space-y-3">
            <h3 className="font-semibold text-slate-800 text-sm uppercase tracking-wide">Thông tin cơ bản</h3>
            <div className="space-y-2 text-sm">
              {[
                { label: "Mã vụ án", value: id, icon: <Hash className="w-4 h-4 text-slate-400" /> },
                { label: "Điều tra viên", value: investigatorName, icon: <User className="w-4 h-4 text-slate-400" /> },
                { label: "Đơn vị", value: caseData?.unit ?? "—", icon: <Building2 className="w-4 h-4 text-slate-400" /> },
                { label: "Ngày khởi tạo", value: createdAt, icon: <Calendar className="w-4 h-4 text-slate-400" /> },
                { label: "Hạn xử lý", value: caseDeadline || "—", icon: <Clock className="w-4 h-4 text-slate-400" /> },
              ].map((row) => (
                <div key={row.label} className="flex items-center gap-3">
                  {row.icon}
                  <span className="text-slate-500 w-32 flex-shrink-0">{row.label}:</span>
                  <span className="font-medium text-slate-800">{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Thông tin pháp lý */}
          <div className="bg-slate-50 rounded-lg p-5 space-y-3">
            <h3 className="font-semibold text-slate-800 text-sm uppercase tracking-wide">Thông tin pháp lý</h3>
            <div className="space-y-2 text-sm">
              {[
                { label: "Tội danh", value: caseData?.crime ?? "—" },
                { label: "Trạng thái", value: caseData?.status ?? "—" },
                { label: "Số bị can", value: `${caseData?.subjectsCount ?? defendants.length} người` },
              ].map((row) => (
                <div key={row.label} className="flex items-start gap-3">
                  <Scale className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-500 w-32 flex-shrink-0">{row.label}:</span>
                  <span className="font-medium text-slate-800">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tên vụ án */}
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" />
            Tên vụ án
          </h3>
          <p className="text-slate-700 leading-relaxed text-sm">
            {caseData?.name ?? "—"}
          </p>
          {overdue && (
            <div className="mt-4 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 font-medium">
                Vụ án này đã quá hạn điều tra ({caseDeadline}). Cần xử lý ngay.
              </p>
            </div>
          )}
        </div>

        {/* Đơn thư liên kết */}
        {caseData?.petitions && caseData.petitions.length > 0 && (
          <div className="bg-white rounded-lg border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-purple-600" />
              Đơn thư liên kết ({caseData.petitions.length})
            </h3>
            <div className="space-y-2">
              {caseData.petitions.map((p: { id: string; stt: string; petitionType?: string; status: string; senderName: string; receivedDate: string }) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors cursor-pointer"
                  onClick={() => navigate(`/don-thu`)}
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-purple-600" />
                    <div>
                      <span className="font-medium text-sm text-slate-800">{p.stt}</span>
                      {p.petitionType && (
                        <span className="ml-2 text-xs text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">{p.petitionType}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span>{p.senderName}</span>
                    <span>{new Date(p.receivedDate).toLocaleDateString("vi-VN")}</span>
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">{p.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderDefendantsTab = () => {
    if (loadingDefendants) {
      return <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>;
    }
    return (
    <div className="space-y-4" data-testid="tab-content-defendants">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">Tổng cộng: <span className="font-semibold text-slate-800">{defendants.length}</span> bị can</p>
        <button
          onClick={() => { setEditingDefendant(null); setShowDefendantModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          data-testid="btn-add-defendant"
        >
          <Plus className="w-4 h-4" />
          Thêm bị can
        </button>
      </div>

      {defendants.length === 0 ? (
        <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-lg">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500 text-sm">Chưa có bị can nào</p>
        </div>
      ) : (
        <div className="space-y-3">
          {defendants.map((d) => (
            <div key={d.id} className="bg-white border border-slate-200 rounded-lg p-5" data-testid={`defendant-card-${d.id}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">{d.name}</p>
                    <p className="text-xs text-slate-500">CCCD: {d.idNumber}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    d.detentionStatus === "Tạm giam" ? "bg-red-100 text-red-700" :
                    d.detentionStatus === "Đang điều tra" ? "bg-amber-100 text-amber-700" :
                    "bg-green-100 text-green-700"
                  }`}>
                    {d.detentionStatus}
                  </span>
                  <button
                    onClick={() => { setEditingDefendant(d); setShowDefendantModal(true); }}
                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    data-testid={`btn-edit-defendant-${d.id}`}
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={async () => { if (confirm(`Xóa bị can ${d.name}?`)) { try { await api.delete(`/subjects/${d.id}`); await fetchDefendants(); } catch { setDefendants((prev) => prev.filter((x) => x.id !== d.id)); } } }}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-slate-600">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Ngày sinh: {d.dateOfBirth ? new Date(d.dateOfBirth).toLocaleDateString("vi-VN") : "—"}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <Phone className="w-3.5 h-3.5" />
                  <span>{d.phone || "—"}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600 col-span-2">
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{d.address || "—"}</span>
                </div>
                {(d.chargesLabel || d.chargesAgainst) && (
                  <div className="flex items-center gap-2 text-slate-600 col-span-2">
                    <Scale className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{d.chargesLabel || d.chargesAgainst}</span>
                  </div>
                )}
                {d.detentionStatus === "Tạm giam" && d.detentionExpiry && (
                  <div className={`flex items-center gap-2 col-span-2 ${isOverdue(d.detentionExpiry) ? "text-red-600" : "text-slate-600"}`}>
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Hạn tạm giam: {new Date(d.detentionExpiry).toLocaleDateString("vi-VN")} {isOverdue(d.detentionExpiry) && "(Quá hạn!)"}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
    );
  };

  const renderLawyersTab = () => {
    if (loadingLawyers) {
      return <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" /></div>;
    }
    return (
    <div className="space-y-4" data-testid="tab-content-lawyers">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">Tổng cộng: <span className="font-semibold text-slate-800">{lawyers.length}</span> luật sư</p>
        <button
          onClick={() => { setEditingLawyer(null); setShowLawyerModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
          data-testid="btn-add-lawyer"
        >
          <Plus className="w-4 h-4" />
          Gán luật sư
        </button>
      </div>

      {lawyers.length === 0 ? (
        <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-lg">
          <Scale className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500 text-sm">Chưa có luật sư nào được gán</p>
        </div>
      ) : (
        <div className="space-y-3">
          {lawyers.map((l) => (
            <div key={l.id} className="bg-white border border-slate-200 rounded-lg p-5" data-testid={`lawyer-card-${l.id}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                    <Scale className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">{l.name}</p>
                    <p className="text-xs text-slate-500">Thẻ LS: {l.barNumber}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setEditingLawyer(l); setShowLawyerModal(true); }}
                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={async () => { if (confirm(`Xóa luật sư ${l.name}?`)) { try { await api.delete(`/lawyers/${l.id}`); await fetchLawyers(); } catch { setLawyers((prev) => prev.filter((x) => x.id !== l.id)); } } }}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-600">
                <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" /><span>{l.phone || "—"}</span></div>
                <div className="flex items-center gap-2"><Building2 className="w-3.5 h-3.5" /><span>{l.lawFirm || "—"}</span></div>
                <div className="flex items-center gap-2 col-span-2">
                  <Users className="w-3.5 h-3.5" />
                  <span>Bào chữa cho: <span className="font-medium text-slate-800">{l.assignedTo || "—"}</span></span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
    );
  };

  const renderTimelineTab = () => {
    const getEventIcon = (type: "info" | "warning" | "success" | "danger") => {
      switch (type) {
        case "info":    return <AlertCircle className="w-5 h-5 text-blue-600" />;
        case "warning": return <Clock className="w-5 h-5 text-amber-600" />;
        case "success": return <CheckCircle className="w-5 h-5 text-green-600" />;
        case "danger":  return <Scale className="w-5 h-5 text-red-600" />;
      }
    };
    const getEventBg = (type: "info" | "warning" | "success" | "danger") => {
      switch (type) {
        case "info":    return "bg-blue-100";
        case "warning": return "bg-amber-100";
        case "success": return "bg-green-100";
        case "danger":  return "bg-red-100";
      }
    };

    return (
      <div className="space-y-4" data-testid="tab-content-timeline">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-800">Timeline tiến trình điều tra</h3>
          <button
            onClick={() => setShowSupplementModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
            data-testid="btn-supplement-investigation"
          >
            <Plus className="w-4 h-4" />
            Điều tra bổ sung
          </button>
        </div>

        {loadingTimeline ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        ) : timeline.length === 0 ? (
          <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-lg">
            <Clock className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">Chưa có lịch sử hoạt động</p>
          </div>
        ) : (
          <div className="relative">
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-200" />
            <div className="space-y-6">
              {timeline.map((event) => (
                <div key={event.id} className="relative flex gap-4">
                  <div className={`relative z-10 w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${getEventBg(event.type)}`}>
                    {getEventIcon(event.type)}
                  </div>
                  <div className="flex-1 pb-6">
                    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className="font-medium text-slate-800">{event.title}</h4>
                        <span className="text-xs text-slate-500 whitespace-nowrap">
                          {event.date} {event.time}
                        </span>
                      </div>
                      {event.description && (
                        <p className="text-sm text-slate-600 mb-2">{event.description}</p>
                      )}
                      <p className="text-xs text-slate-500">Thực hiện bởi: {event.actor}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderConclusionTab = () => {
    if (loadingConclusions) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
        </div>
      );
    }
    return (
    <div className="space-y-4" data-testid="tab-content-conclusion">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">Kết luận điều tra</p>
        <button
          onClick={() => { setEditingConclusion(null); setShowConclusionModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm font-medium"
          data-testid="btn-add-conclusion"
        >
          <Plus className="w-4 h-4" />
          Thêm kết luận
        </button>
      </div>

      {conclusions.length === 0 ? (
        <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-lg">
          <Gavel className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500 text-sm">Chưa có kết luận điều tra</p>
        </div>
      ) : (
        conclusions.map((c) => (
          <div key={c.id} className="bg-white border border-slate-200 rounded-lg p-5" data-testid={`conclusion-card-${c.id}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <BookOpen className="w-5 h-5 text-amber-600" />
                <div>
                  <p className="font-semibold text-slate-800">{c.type}</p>
                  <p className="text-xs text-slate-500">{c.date ? new Date(c.date).toLocaleDateString("vi-VN") : "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                  c.status === CONCLUSION_STATUS_LABEL[ConclusionStatus.DA_DUYET] ? "bg-green-100 text-green-700" :
                  c.status === CONCLUSION_STATUS_LABEL[ConclusionStatus.CHO_DUYET] ? "bg-amber-100 text-amber-700" :
                  "bg-slate-100 text-slate-700"
                }`}>
                  {c.status}
                </span>
                <button onClick={() => { setEditingConclusion(c); setShowConclusionModal(true); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors">
                  <Edit className="w-4 h-4" />
                </button>
              </div>
            </div>
            <p className="text-sm text-slate-700 line-clamp-3">{c.content}</p>
            <div className="mt-3 flex gap-4 text-xs text-slate-500">
              <span>Người lập: <span className="font-medium">{c.author}</span></span>
              <span>Duyệt: <span className="font-medium">{c.approvedBy}</span></span>
            </div>
          </div>
        ))
      )}
    </div>
    );
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6" data-testid="case-detail-page">
      {/* Back */}
      <button
        onClick={() => navigate("/cases")}
        className="flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors"
        data-testid="btn-back-to-list"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm font-medium">Quay lại danh sách</span>
      </button>

      {/* Header card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center flex-wrap gap-2 mb-1">
              <h1 className="text-xl font-bold text-slate-800">
                {caseData?.name ?? "—"}
              </h1>
              {overdue && (
                <span
                  className="px-2.5 py-1 text-xs font-bold text-white bg-red-600 rounded-full animate-pulse"
                  data-testid="overdue-badge-detail"
                >
                  Quá hạn
                </span>
              )}
              {caseData?.status && (
                <span className="px-2.5 py-1 rounded-full text-xs font-medium text-blue-700 bg-blue-100">
                  {STATUS_LABEL[caseData.status] ?? caseData.status}
                </span>
              )}
            </div>
            <p className="text-slate-500 text-sm">Mã vụ án: <span className="font-semibold text-blue-600">{id}</span></p>
          </div>
          <div className="flex gap-3">
            {canDispatch && (
              <button
                onClick={() => setShowAssignModal(true)}
                className="px-4 py-2 border border-orange-300 text-orange-700 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors text-sm font-medium"
                data-testid="btn-assign-case"
              >
                <Users className="w-4 h-4 inline mr-1.5" />
                {caseData?.assignedTeamId ? 'Phân công lại' : 'Phân công'}
              </button>
            )}
            <button
              onClick={() => navigate(`/cases/${id}/edit`)}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
              data-testid="btn-edit-case"
            >
              <Edit className="w-4 h-4 inline mr-1.5" />
              Chỉnh sửa
            </button>
            <button
              onClick={handleOpenProgress}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              data-testid="btn-update-progress"
            >
              Cập nhật tiến độ
            </button>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 pt-5 border-t border-slate-100">
          {[
            {
              icon: <User className="w-4 h-4 text-blue-500" />,
              label: "Điều tra viên",
              value: caseData?.investigator
                ? `${caseData.investigator.firstName ?? ""} ${caseData.investigator.lastName ?? ""}`.trim() || caseData.investigator.username
                : "Chưa phân công",
              danger: false,
            },
            {
              icon: <Calendar className="w-4 h-4 text-green-500" />,
              label: "Ngày tạo",
              value: caseData?.createdAt ? new Date(caseData.createdAt).toLocaleDateString("vi-VN") : "—",
              danger: false,
            },
            {
              icon: <Clock className={`w-4 h-4 ${overdue ? "text-red-500" : "text-amber-500"}`} />,
              label: "Hạn điều tra",
              value: caseDeadline || "—",
              danger: overdue,
            },
            {
              icon: <Users className="w-4 h-4 text-purple-500" />,
              label: "Bị can",
              value: `${caseData?.subjectsCount ?? defendants.length} người`,
              danger: false,
            },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${s.danger ? "bg-red-100" : "bg-slate-100"}`}>{s.icon}</div>
              <div>
                <p className="text-xs text-slate-500">{s.label}</p>
                <p className={`font-semibold text-sm ${s.danger ? "text-red-600" : "text-slate-800"}`}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="border-b border-slate-200 px-2" role="tablist">
          <div className="flex" data-testid="detail-tabs">
            {DETAIL_TABS.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
                  activeTab === tab.id
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-600 hover:text-slate-800 hover:border-slate-300"
                }`}
                data-testid={`tab-${tab.id}`}
              >
                {tab.icon}
                {tab.label}
                {tab.id === "defendants" && defendants.length > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">{defendants.length}</span>
                )}
                {tab.id === "lawyers" && lawyers.length > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-purple-100 text-purple-700 rounded-full">{lawyers.length}</span>
                )}
                {tab.id === "conclusion" && conclusions.length > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded-full">{conclusions.length}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {activeTab === "info" && renderInfoTab()}
          {activeTab === "defendants" && renderDefendantsTab()}
          {activeTab === "lawyers" && renderLawyersTab()}
          {activeTab === "timeline" && renderTimelineTab()}
          {activeTab === "conclusion" && renderConclusionTab()}
        </div>
      </div>

      {/* Modals */}
      {showDefendantModal && (
        <DefendantModal
          defendant={editingDefendant}
          crimes={crimes}
          loadingCrimes={loadingCrimes}
          error={defendantError}
          onClose={() => { setShowDefendantModal(false); setEditingDefendant(null); setDefendantError(""); }}
          onSave={handleSaveDefendant}
        />
      )}
      {showLawyerModal && (
        <LawyerModal
          lawyer={editingLawyer}
          defendants={defendants}
          onClose={() => { setShowLawyerModal(false); setEditingLawyer(null); }}
          onSave={handleSaveLawyer}
        />
      )}
      {showConclusionModal && (
        <ConclusionModal
          conclusion={editingConclusion}
          onClose={() => { setShowConclusionModal(false); setEditingConclusion(null); }}
          onSave={handleSaveConclusion}
        />
      )}

      {/* Modal cập nhật tiến độ */}
      {showProgressModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                Cập nhật tiến độ
              </h2>
              <button onClick={() => setShowProgressModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Trạng thái <span className="text-red-500">*</span>
                </label>
                <select
                  value={progressStatus}
                  onChange={(e) => setProgressStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                >
                  <option value="">-- Chọn trạng thái --</option>
                  {Object.entries(STATUS_LABEL).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Hạn điều tra
                </label>
                <input
                  type="date"
                  value={progressDeadline}
                  onChange={(e) => setProgressDeadline(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              {progressError && (
                <p className="text-sm text-red-600">{progressError}</p>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowProgressModal(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveProgress}
                disabled={progressSaving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                {progressSaving ? "Đang lưu..." : "Lưu"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Điều tra bổ sung */}
      {showSupplementModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
            <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="font-bold text-slate-800">Điều tra bổ sung / Điều tra lại</h2>
              <button onClick={() => setShowSupplementModal(false)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Loại quyết định <span className="text-red-500">*</span>
                </label>
                <select
                  value={supplementForm.type}
                  onChange={(e) => setSupplementForm({ ...supplementForm, type: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">Chọn loại quyết định</option>
                  <option value="Điều tra bổ sung">Điều tra bổ sung</option>
                  <option value="Điều tra lại">Điều tra lại</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Số quyết định <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={supplementForm.decisionNumber}
                    onChange={(e) => setSupplementForm({ ...supplementForm, decisionNumber: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Số quyết định"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Ngày quyết định
                  </label>
                  <input
                    type="date"
                    value={supplementForm.decisionDate}
                    onChange={(e) => setSupplementForm({ ...supplementForm, decisionDate: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Lý do <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={supplementForm.reason}
                  onChange={(e) => setSupplementForm({ ...supplementForm, reason: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nêu rõ lý do cần điều tra bổ sung/điều tra lại..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Hạn hoàn thành
                </label>
                <input
                  type="date"
                  value={supplementForm.deadline}
                  onChange={(e) => setSupplementForm({ ...supplementForm, deadline: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="border-t border-slate-200 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setShowSupplementModal(false)}
                className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveSupplement}
                disabled={supplementSaving || !supplementForm.type || !supplementForm.decisionNumber || !supplementForm.reason}
                className="px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-60"
              >
                {supplementSaving ? "Đang lưu..." : "Lưu quyết định"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {canDispatch && (
        <AssignModal
          open={showAssignModal}
          onClose={() => setShowAssignModal(false)}
          resourceType="cases"
          recordId={id ?? ''}
          currentUpdatedAt={caseData?.updatedAt}
          currentTeamId={caseData?.assignedTeamId}
          currentInvestigatorId={caseData?.investigatorId}
          onSuccess={() => {
            setShowAssignModal(false);
            // Re-fetch case data
            api.get(`/cases/${id}`).then((r: any) => setCaseData(r.data.data)).catch(() => {});
          }}
        />
      )}
    </div>
  );
}
