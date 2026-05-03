/**
 * CaseObjectsTab — Tab "Đối tượng" trong CaseDetailPage
 * TASK-2026-261225 / AC-03
 *
 * Hiển thị 3 danh sách phân loại theo caseId hiện tại:
 *   1. Bị can (SUSPECT)
 *   2. Nạn nhân & Người làm chứng (VICTIM + WITNESS)
 *   3. Luật sư (Lawyer)
 *
 * Pattern: Refs/CaseDetailNew.tsx + ObjectListPage.tsx
 */

import { useState } from "react";
import { api } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SubjectType } from "@/shared/enums/subject-status";
import {
  Users,
  User,
  Scale,
  AlertTriangle,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  Building2,
  Phone,
  Calendar,
  MapPin,
  ShieldAlert,
  Heart,
  Eye as EyeIcon,
} from "lucide-react";
import { FKSelect, type FKOption } from "@/components/FKSelect";
import {
  LABEL_BASE,
  INPUT_BASE,
  SELECT_BASE,
  TEXTAREA_BASE,
  FIELD_ERROR_TEXT,
  BTN_PRIMARY,
  BTN_SECONDARY,
  BTN_DANGER,
  BTN_ICON_BLUE,
  BTN_ICON_RED,
  MODAL_OVERLAY,
  MODAL_HEADER,
  MODAL_FOOTER,
  getInputClass,
} from "@/constants/styles";

// ─── Types ────────────────────────────────────────────────────────────────────

import type { SubjectStatus as SubjectStatusType } from "@/shared/enums/subject-status";
type SubjectStatus = SubjectStatusType;
type Gender = "MALE" | "FEMALE" | "OTHER";

interface Subject {
  id: string;
  fullName: string;
  dateOfBirth: string;
  gender: Gender;
  idNumber: string;
  address: string;
  phone?: string;
  type: SubjectType;
  status: SubjectStatus;
  notes?: string;
  caseId: string;
  crimeId: string;
}

interface Lawyer {
  id: string;
  fullName: string;
  barNumber: string;
  lawFirm?: string;
  phone?: string;
  caseId: string;
  subjectId?: string;
  subject?: { id: string; fullName: string };
}

interface SubjectFormData {
  fullName: string;
  dateOfBirth: string;
  gender: Gender;
  idNumber: string;
  address: string;
  phone: string;
  status: SubjectStatus;
  notes: string;
  type: SubjectType;
  caseId: string;
  crimeId: string;
}

interface LawyerFormData {
  fullName: string;
  barNumber: string;
  lawFirm: string;
  phone: string;
  caseId: string;
  subjectId: string;
}

// ─── API helpers ──────────────────────────────────────────────────────────────


// ─── Label maps ───────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<SubjectStatus, string> = {
  INVESTIGATING: "Đang điều tra",
  DETAINED: "Tạm giam",
  RELEASED: "Tại ngoại",
  WANTED: "Truy nã",
};

const STATUS_COLOR: Record<SubjectStatus, string> = {
  INVESTIGATING: "bg-amber-100 text-amber-700",
  DETAINED: "bg-red-100 text-red-700",
  RELEASED: "bg-green-100 text-green-700",
  WANTED: "bg-purple-100 text-purple-700",
};

const GENDER_LABEL: Record<Gender, string> = {
  MALE: "Nam",
  FEMALE: "Nữ",
  OTHER: "Khác",
};

// ─── SubjectMiniForm ──────────────────────────────────────────────────────────

interface SubjectFormProps {
  initial?: Subject | null;
  subjectType: SubjectType;
  caseId: string;
  crimeOptions: FKOption[];
  loadingCrimes: boolean;
  onSave: (data: SubjectFormData) => Promise<void>;
  onClose: () => void;
  isSaving: boolean;
  serverError?: string;
}

function SubjectMiniForm({
  initial,
  subjectType,
  caseId,
  crimeOptions,
  loadingCrimes,
  onSave,
  onClose,
  isSaving,
  serverError,
}: SubjectFormProps) {
  const typeLabel =
    subjectType === SubjectType.VICTIM ? "Nạn nhân" :
    subjectType === SubjectType.WITNESS ? "Người làm chứng" : "Bị can";

  const [form, setForm] = useState<SubjectFormData>(() =>
    initial
      ? {
          fullName: initial.fullName,
          dateOfBirth: initial.dateOfBirth,
          gender: initial.gender,
          idNumber: initial.idNumber,
          address: initial.address,
          phone: initial.phone ?? "",
          status: initial.status,
          notes: initial.notes ?? "",
          type: subjectType,
          caseId,
          crimeId: initial.crimeId,
        }
      : {
          fullName: "",
          dateOfBirth: "",
          gender: "MALE",
          idNumber: "",
          address: "",
          phone: "",
          status: "INVESTIGATING",
          notes: "",
          type: subjectType,
          caseId,
          crimeId: "",
        }
  );
  const [errors, setErrors] = useState<Partial<Record<keyof SubjectFormData, string>>>({});

  const validate = () => {
    const e: typeof errors = {};
    if (!form.fullName.trim()) e.fullName = "Họ tên không được để trống";
    if (!form.idNumber.trim()) e.idNumber = "Số CCCD/CMT không được để trống";
    if (!form.dateOfBirth) e.dateOfBirth = "Ngày sinh không được để trống";
    if (!form.address.trim()) e.address = "Địa chỉ không được để trống";
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    await onSave(form);
  };

  const f = <K extends keyof SubjectFormData>(key: K, value: SubjectFormData[K]) => {
    setForm((p) => ({ ...p, [key]: value }));
    setErrors((p) => ({ ...p, [key]: undefined }));
  };

  const accentIcon =
    subjectType === SubjectType.VICTIM ? <Heart className="w-4 h-4 text-orange-600" /> :
    subjectType === SubjectType.WITNESS ? <EyeIcon className="w-4 h-4 text-teal-600" /> :
    <ShieldAlert className="w-4 h-4 text-red-600" />;

  return (
    <div className={MODAL_OVERLAY} role="dialog" aria-modal="true">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className={MODAL_HEADER}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
              {accentIcon}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">
                {initial ? `Chỉnh sửa ${typeLabel.toLowerCase()}` : `Thêm ${typeLabel.toLowerCase()}`}
              </h2>
              <p className="text-xs text-slate-500">Loại: {typeLabel}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" aria-label="Đóng">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {serverError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {serverError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Họ tên */}
            <div className="md:col-span-2">
              <label className={LABEL_BASE}>Họ và tên <span className="text-red-500">*</span></label>
              <input
                value={form.fullName}
                onChange={(e) => f("fullName", e.target.value)}
                className={getInputClass(!!errors.fullName)}
                placeholder="Nguyễn Văn A"
                data-testid="subject-fullName"
              />
              {errors.fullName && <p className={FIELD_ERROR_TEXT}>{errors.fullName}</p>}
            </div>

            {/* Ngày sinh */}
            <div>
              <label className={LABEL_BASE}>Ngày sinh <span className="text-red-500">*</span></label>
              <input
                type="date"
                value={form.dateOfBirth}
                onChange={(e) => f("dateOfBirth", e.target.value)}
                className={getInputClass(!!errors.dateOfBirth)}
                data-testid="subject-dateOfBirth"
              />
              {errors.dateOfBirth && <p className={FIELD_ERROR_TEXT}>{errors.dateOfBirth}</p>}
            </div>

            {/* Giới tính */}
            <div>
              <label className={LABEL_BASE}>Giới tính</label>
              <select
                value={form.gender}
                onChange={(e) => f("gender", e.target.value as Gender)}
                className={SELECT_BASE}
                data-testid="subject-gender"
              >
                <option value="MALE">Nam</option>
                <option value="FEMALE">Nữ</option>
                <option value="OTHER">Khác</option>
              </select>
            </div>

            {/* CCCD */}
            <div>
              <label className={LABEL_BASE}>Số CCCD/CMT <span className="text-red-500">*</span></label>
              <input
                value={form.idNumber}
                onChange={(e) => f("idNumber", e.target.value)}
                className={getInputClass(!!errors.idNumber)}
                placeholder="012345678901"
                data-testid="subject-idNumber"
              />
              {errors.idNumber && <p className={FIELD_ERROR_TEXT}>{errors.idNumber}</p>}
            </div>

            {/* Điện thoại */}
            <div>
              <label className={LABEL_BASE}>Số điện thoại</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => f("phone", e.target.value)}
                className={INPUT_BASE}
                placeholder="09xxxxxxxx"
                data-testid="subject-phone"
              />
            </div>

            {/* Địa chỉ */}
            <div className="md:col-span-2">
              <label className={LABEL_BASE}>Địa chỉ <span className="text-red-500">*</span></label>
              <input
                value={form.address}
                onChange={(e) => f("address", e.target.value)}
                className={getInputClass(!!errors.address)}
                placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành"
                data-testid="subject-address"
              />
              {errors.address && <p className={FIELD_ERROR_TEXT}>{errors.address}</p>}
            </div>

            {/* Trạng thái (chỉ cho SUSPECT) */}
            {subjectType === SubjectType.SUSPECT && (
              <div>
                <label className={LABEL_BASE}>Trạng thái</label>
                <select
                  value={form.status}
                  onChange={(e) => f("status", e.target.value as SubjectStatus)}
                  className={SELECT_BASE}
                  data-testid="subject-status"
                >
                  <option value="INVESTIGATING">Đang điều tra</option>
                  <option value="DETAINED">Tạm giam</option>
                  <option value="RELEASED">Tại ngoại</option>
                  <option value="WANTED">Truy nã</option>
                </select>
              </div>
            )}

            {/* Tội danh / Vụ việc liên quan — FK select */}
            <div>
              <label className={LABEL_BASE}>Tội danh / Hành vi liên quan</label>
              <FKSelect
                label=""
                resource="crimes"
                value={form.crimeId}
                onChange={(v) => f("crimeId", v)}
                options={crimeOptions}
                loading={loadingCrimes}
                searchPlaceholder="Tìm tội danh..."
                placeholder="Chọn tội danh (tuỳ chọn)"
              />
            </div>

            {/* Ghi chú */}
            <div className="md:col-span-2">
              <label className={LABEL_BASE}>Ghi chú</label>
              <textarea
                value={form.notes}
                onChange={(e) => f("notes", e.target.value)}
                rows={3}
                className={TEXTAREA_BASE}
                placeholder="Ghi chú thêm..."
                data-testid="subject-notes"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={MODAL_FOOTER}>
          <button onClick={onClose} className={BTN_SECONDARY} disabled={isSaving}>Hủy</button>
          <button
            onClick={handleSubmit}
            className={`${BTN_PRIMARY} flex items-center gap-2`}
            disabled={isSaving}
            data-testid="subject-submit"
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            <Save className="w-4 h-4" />
            {initial ? "Cập nhật" : "Lưu"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── LawyerMiniForm ───────────────────────────────────────────────────────────

interface LawyerFormModalProps {
  initial?: Lawyer | null;
  caseId: string;
  suspectOptions: FKOption[];
  loadingSuspects: boolean;
  onSave: (data: LawyerFormData) => Promise<void>;
  onClose: () => void;
  isSaving: boolean;
  serverError?: string;
}

function LawyerMiniForm({
  initial,
  caseId,
  suspectOptions,
  loadingSuspects,
  onSave,
  onClose,
  isSaving,
  serverError,
}: LawyerFormModalProps) {
  const [form, setForm] = useState<LawyerFormData>(() =>
    initial
      ? {
          fullName: initial.fullName,
          barNumber: initial.barNumber,
          lawFirm: initial.lawFirm ?? "",
          phone: initial.phone ?? "",
          caseId,
          subjectId: initial.subjectId ?? "",
        }
      : { fullName: "", barNumber: "", lawFirm: "", phone: "", caseId, subjectId: "" }
  );
  const [errors, setErrors] = useState<Partial<Record<keyof LawyerFormData, string>>>({});

  const validate = () => {
    const e: typeof errors = {};
    if (!form.fullName.trim()) e.fullName = "Họ tên không được để trống";
    if (!form.barNumber.trim()) e.barNumber = "Số thẻ luật sư không được để trống";
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    await onSave(form);
  };

  const f = <K extends keyof LawyerFormData>(key: K, value: LawyerFormData[K]) => {
    setForm((p) => ({ ...p, [key]: value }));
    setErrors((p) => ({ ...p, [key]: undefined }));
  };

  return (
    <div className={MODAL_OVERLAY} role="dialog" aria-modal="true">
      <div className="bg-white rounded-lg shadow-xl max-w-xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className={MODAL_HEADER}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Scale className="w-4 h-4 text-blue-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-800">
              {initial ? "Chỉnh sửa luật sư" : "Gán luật sư"}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" aria-label="Đóng">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {serverError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {serverError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className={LABEL_BASE}>Họ và tên luật sư <span className="text-red-500">*</span></label>
              <input
                value={form.fullName}
                onChange={(e) => f("fullName", e.target.value)}
                className={getInputClass(!!errors.fullName)}
                placeholder="Luật sư Nguyễn Văn A"
                data-testid="lawyer-fullName"
              />
              {errors.fullName && <p className={FIELD_ERROR_TEXT}>{errors.fullName}</p>}
            </div>

            <div>
              <label className={LABEL_BASE}>Số thẻ luật sư <span className="text-red-500">*</span></label>
              <input
                value={form.barNumber}
                onChange={(e) => f("barNumber", e.target.value)}
                className={getInputClass(!!errors.barNumber)}
                placeholder="LS-12345/HCM"
                data-testid="lawyer-barNumber"
              />
              {errors.barNumber && <p className={FIELD_ERROR_TEXT}>{errors.barNumber}</p>}
            </div>

            <div>
              <label className={LABEL_BASE}>Văn phòng luật sư</label>
              <input
                value={form.lawFirm}
                onChange={(e) => f("lawFirm", e.target.value)}
                className={INPUT_BASE}
                placeholder="Văn phòng Luật sư Công Lý"
                data-testid="lawyer-lawFirm"
              />
            </div>

            <div>
              <label className={LABEL_BASE}>Điện thoại</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => f("phone", e.target.value)}
                className={INPUT_BASE}
                placeholder="0901234567"
                data-testid="lawyer-phone"
              />
            </div>

            {/* Bị can bào chữa — FK, nullable (EC-01: 1 luật sư nhiều bị can = nhiều bản ghi) */}
            <div>
              <label className={LABEL_BASE}>Bị can bào chữa</label>
              <FKSelect
                label=""
                resource="subjects"
                value={form.subjectId}
                onChange={(v) => f("subjectId", v)}
                options={suspectOptions}
                loading={loadingSuspects}
                searchPlaceholder="Tìm bị can..."
                placeholder="Chọn bị can (tuỳ chọn)"
                data-testid="lawyer-subjectId"
              />
            </div>
          </div>
        </div>

        <div className={MODAL_FOOTER}>
          <button onClick={onClose} className={BTN_SECONDARY} disabled={isSaving} data-testid="btn-cancel-lawyer">
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            className={`${BTN_PRIMARY} flex items-center gap-2`}
            disabled={isSaving}
            data-testid="lawyer-submit"
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            {initial ? "Cập nhật" : "Gán luật sư"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SubjectSubList ──────────────────────────────────────────────────────────

interface SubjectSubListProps {
  caseId: string;
  subjectType: SubjectType;
  crimeOptions: FKOption[];
  loadingCrimes: boolean;
}

function SubjectSubList({ caseId, subjectType, crimeOptions, loadingCrimes }: SubjectSubListProps) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Subject | null>(null);
  const [deleteItem, setDeleteItem] = useState<Subject | null>(null);
  const [formError, setFormError] = useState<string | undefined>();

  const queryKey = ["subjects", caseId, subjectType];

  const { data, isLoading, isError } = useQuery<{ success: boolean; data: Subject[]; total: number }>({
    queryKey,
    queryFn: () =>
      api.get(`/subjects?caseId=${encodeURIComponent(caseId)}&type=${subjectType}&limit=100`).then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (dto: SubjectFormData) =>
      api.post("/subjects", {
          ...dto,
          phone: dto.phone || undefined,
          notes: dto.notes || undefined,
          crimeId: dto.crimeId || undefined,
        }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setShowForm(false);
      setFormError(undefined);
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: SubjectFormData }) =>
      api.put(`/subjects/${id}`, {
          ...dto,
          phone: dto.phone || undefined,
          notes: dto.notes || undefined,
          crimeId: dto.crimeId || undefined,
        }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setShowForm(false);
      setEditItem(null);
      setFormError(undefined);
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/subjects/${id}`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setDeleteItem(null);
    },
  });

  const handleSave = async (dto: SubjectFormData) => {
    if (editItem) {
      await updateMutation.mutateAsync({ id: editItem.id, dto });
    } else {
      await createMutation.mutateAsync(dto);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const subjects = data?.data ?? [];

  const typeLabel =
    subjectType === SubjectType.VICTIM ? "Nạn nhân" :
    subjectType === SubjectType.WITNESS ? "Người làm chứng" : "Bị can";

  const accentColor =
    subjectType === SubjectType.VICTIM ? "bg-orange-100 text-orange-700" :
    subjectType === SubjectType.WITNESS ? "bg-teal-100 text-teal-700" :
    "bg-red-100 text-red-700";

  const btnColor =
    subjectType === SubjectType.VICTIM ? "bg-orange-600 hover:bg-orange-700" :
    subjectType === SubjectType.WITNESS ? "bg-teal-600 hover:bg-teal-700" :
    "bg-red-600 hover:bg-red-700";

  const iconColor =
    subjectType === SubjectType.VICTIM ? "text-orange-600" :
    subjectType === SubjectType.WITNESS ? "text-teal-600" : "text-red-600";

  const bgIcon =
    subjectType === SubjectType.VICTIM ? "bg-orange-100" :
    subjectType === SubjectType.WITNESS ? "bg-teal-100" : "bg-red-100";

  return (
    <div className="space-y-3">
      {/* Sub-header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${accentColor}`}>
            {typeLabel}
          </span>
          <span className="text-sm text-slate-500">({subjects.length})</span>
        </div>
        <button
          onClick={() => { setEditItem(null); setFormError(undefined); setShowForm(true); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 ${btnColor} text-white rounded-lg transition-colors text-xs font-medium`}
          data-testid={`btn-add-${subjectType.toLowerCase()}`}
        >
          <Plus className="w-3.5 h-3.5" />
          Thêm {typeLabel.toLowerCase()}
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-4 text-slate-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Đang tải...
        </div>
      ) : isError ? (
        <div className="flex items-center gap-2 py-4 text-red-500 text-sm">
          <AlertTriangle className="w-4 h-4" />
          Không thể tải danh sách
        </div>
      ) : subjects.length === 0 ? (
        <div className="py-6 text-center border border-dashed border-slate-200 rounded-lg">
          <Users className="w-8 h-8 text-slate-300 mx-auto mb-1" />
          <p className="text-slate-400 text-sm">Chưa có {typeLabel.toLowerCase()} nào</p>
        </div>
      ) : (
        <div className="space-y-2">
          {subjects.map((s) => (
            <div
              key={s.id}
              className="bg-white border border-slate-200 rounded-lg p-4 flex items-start justify-between gap-3"
              data-testid={`subject-row-${s.id}`}
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className={`w-9 h-9 ${bgIcon} rounded-full flex items-center justify-center flex-shrink-0`}>
                  <User className={`w-4 h-4 ${iconColor}`} />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 text-sm truncate">{s.fullName}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {s.dateOfBirth ? new Date(s.dateOfBirth).toLocaleDateString("vi-VN") : "—"}
                    </span>
                    <span>{GENDER_LABEL[s.gender]}</span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {s.address || "—"}
                    </span>
                    {s.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {s.phone}
                      </span>
                    )}
                  </div>
                  {subjectType === SubjectType.SUSPECT && (
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[s.status]}`}>
                      {STATUS_LABEL[s.status]}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => { setEditItem(s); setFormError(undefined); setShowForm(true); }}
                  className={BTN_ICON_BLUE}
                  title="Chỉnh sửa"
                  data-testid={`btn-edit-subject-${s.id}`}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setDeleteItem(s)}
                  className={BTN_ICON_RED}
                  title="Xóa"
                  data-testid={`btn-delete-subject-${s.id}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit form modal */}
      {showForm && (
        <SubjectMiniForm
          initial={editItem}
          subjectType={subjectType}
          caseId={caseId}
          crimeOptions={crimeOptions}
          loadingCrimes={loadingCrimes}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditItem(null); setFormError(undefined); }}
          isSaving={isSaving}
          serverError={formError}
        />
      )}

      {/* Delete confirm */}
      {deleteItem && (
        <div className={MODAL_OVERLAY} role="dialog">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Xác nhận xóa</h3>
                <p className="text-sm text-slate-600 mt-1">
                  Bạn có chắc muốn xóa <strong className="text-slate-800">{deleteItem.fullName}</strong>?
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setDeleteItem(null)} className={BTN_SECONDARY}>Hủy</button>
              <button
                onClick={() => deleteMutation.mutate(deleteItem.id)}
                className={`${BTN_DANGER} flex items-center gap-2`}
                disabled={deleteMutation.isPending}
                data-testid={`btn-confirm-delete-subject-${deleteItem.id}`}
              >
                {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── LawyerSubList ────────────────────────────────────────────────────────────

interface LawyerSubListProps {
  caseId: string;
  suspectOptions: FKOption[];
  loadingSuspects: boolean;
}

function LawyerSubList({ caseId, suspectOptions, loadingSuspects }: LawyerSubListProps) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Lawyer | null>(null);
  const [deleteItem, setDeleteItem] = useState<Lawyer | null>(null);
  const [formError, setFormError] = useState<string | undefined>();

  const queryKey = ["lawyers", caseId];

  const { data, isLoading, isError } = useQuery<{ success: boolean; data: Lawyer[]; total: number }>({
    queryKey,
    queryFn: () => api.get(`/lawyers?caseId=${encodeURIComponent(caseId)}&limit=100`).then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (dto: LawyerFormData) =>
      api.post("/lawyers", {
          ...dto,
          lawFirm: dto.lawFirm || undefined,
          phone: dto.phone || undefined,
          subjectId: dto.subjectId || undefined,
        }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setShowForm(false);
      setFormError(undefined);
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: LawyerFormData }) =>
      api.put(`/lawyers/${id}`, {
          ...dto,
          lawFirm: dto.lawFirm || undefined,
          phone: dto.phone || undefined,
          subjectId: dto.subjectId || undefined,
        }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setShowForm(false);
      setEditItem(null);
      setFormError(undefined);
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/lawyers/${id}`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setDeleteItem(null);
    },
  });

  const handleSave = async (dto: LawyerFormData) => {
    if (editItem) {
      await updateMutation.mutateAsync({ id: editItem.id, dto });
    } else {
      await createMutation.mutateAsync(dto);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const lawyers = data?.data ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
            Luật sư
          </span>
          <span className="text-sm text-slate-500">({lawyers.length})</span>
        </div>
        <button
          onClick={() => { setEditItem(null); setFormError(undefined); setShowForm(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-xs font-medium"
          data-testid="btn-add-lawyer"
        >
          <Plus className="w-3.5 h-3.5" />
          Gán luật sư
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-4 text-slate-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Đang tải...
        </div>
      ) : isError ? (
        <div className="flex items-center gap-2 py-4 text-red-500 text-sm">
          <AlertTriangle className="w-4 h-4" />
          Không thể tải danh sách luật sư
        </div>
      ) : lawyers.length === 0 ? (
        <div className="py-6 text-center border border-dashed border-slate-200 rounded-lg">
          <Scale className="w-8 h-8 text-slate-300 mx-auto mb-1" />
          <p className="text-slate-400 text-sm">Chưa có luật sư nào được gán</p>
        </div>
      ) : (
        <div className="space-y-2">
          {lawyers.map((l) => (
            <div
              key={l.id}
              className="bg-white border border-slate-200 rounded-lg p-4 flex items-start justify-between gap-3"
              data-testid={`lawyer-row-${l.id}`}
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-9 h-9 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Scale className="w-4 h-4 text-purple-600" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 text-sm">{l.fullName}</p>
                  <p className="text-xs text-blue-600 font-mono">{l.barNumber}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-xs text-slate-500">
                    {l.lawFirm && (
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {l.lawFirm}
                      </span>
                    )}
                    {l.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {l.phone}
                      </span>
                    )}
                    {l.subject && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        Bào chữa: {l.subject.fullName}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => { setEditItem(l); setFormError(undefined); setShowForm(true); }}
                  className={BTN_ICON_BLUE}
                  title="Chỉnh sửa"
                  data-testid={`btn-edit-lawyer-${l.id}`}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setDeleteItem(l)}
                  className={BTN_ICON_RED}
                  title="Xóa"
                  data-testid={`btn-delete-lawyer-${l.id}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <LawyerMiniForm
          initial={editItem}
          caseId={caseId}
          suspectOptions={suspectOptions}
          loadingSuspects={loadingSuspects}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditItem(null); setFormError(undefined); }}
          isSaving={isSaving}
          serverError={formError}
        />
      )}

      {deleteItem && (
        <div className={MODAL_OVERLAY} role="dialog">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Xác nhận xóa luật sư</h3>
                <p className="text-sm text-slate-600 mt-1">
                  Bạn có chắc muốn xóa luật sư{" "}
                  <strong className="text-slate-800">{deleteItem.fullName}</strong>?
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setDeleteItem(null)} className={BTN_SECONDARY}>Hủy</button>
              <button
                onClick={() => deleteMutation.mutate(deleteItem.id)}
                className={`${BTN_DANGER} flex items-center gap-2`}
                disabled={deleteMutation.isPending}
                data-testid="btn-confirm-delete-lawyer"
              >
                {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Xóa luật sư
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CaseObjectsTab (main export) ─────────────────────────────────────────────

interface CaseObjectsTabProps {
  /** ID của vụ án hiện tại — truyền từ CaseDetailPage */
  caseId: string;
}

/**
 * AC-03: hiển thị 3 sub-list riêng biệt:
 *   1. Bị can (SUSPECT)
 *   2. Nạn nhân (VICTIM) + Người làm chứng (WITNESS)
 *   3. Luật sư (Lawyer)
 */
export default function CaseObjectsTab({ caseId }: CaseObjectsTabProps) {
  // Fetch crimes for FK select (shared across subject sub-lists)
  const { data: crimesData, isLoading: loadingCrimes } = useQuery<{
    success: boolean;
    data: Array<{ id: string; name: string }>;
  }>({
    queryKey: ["crimes-fk"],
    queryFn: () => api.get('/crimes?limit=100').then((r) => r.data),
    staleTime: 10 * 60 * 1000,
  });

  // Fetch suspects for Lawyer FK select (scoped to this case)
  const { data: suspectsData, isLoading: loadingSuspects } = useQuery<{
    success: boolean;
    data: Array<{ id: string; fullName: string }>;
  }>({
    queryKey: ["subjects-suspects-fk", caseId],
    queryFn: () => api.get(`/subjects?caseId=${encodeURIComponent(caseId)}&type=SUSPECT&limit=100`).then((r) => r.data),
    staleTime: 2 * 60 * 1000,
  });

  const crimeOptions: FKOption[] =
    crimesData?.data.map((c) => ({ value: c.id, label: c.name })) ?? [];
  const suspectOptions: FKOption[] =
    suspectsData?.data.map((s) => ({ value: s.id, label: s.fullName })) ?? [];

  return (
    <div className="space-y-8" data-testid="tab-content-objects">
      {/* ── Section 1: Bị can ── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <ShieldAlert className="w-5 h-5 text-red-600" />
          <h3 className="text-base font-semibold text-slate-800">Bị can</h3>
          <div className="flex-1 h-px bg-slate-200" />
        </div>
        <SubjectSubList
          caseId={caseId}
          subjectType="SUSPECT"
          crimeOptions={crimeOptions}
          loadingCrimes={loadingCrimes}
        />
      </section>

      {/* ── Section 2: Nạn nhân & Người làm chứng ── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Heart className="w-5 h-5 text-orange-600" />
          <h3 className="text-base font-semibold text-slate-800">Nạn nhân &amp; Người làm chứng</h3>
          <div className="flex-1 h-px bg-slate-200" />
        </div>
        <div className="space-y-6">
          <SubjectSubList
            caseId={caseId}
            subjectType="VICTIM"
            crimeOptions={crimeOptions}
            loadingCrimes={loadingCrimes}
          />
          <SubjectSubList
            caseId={caseId}
            subjectType="WITNESS"
            crimeOptions={crimeOptions}
            loadingCrimes={loadingCrimes}
          />
        </div>
      </section>

      {/* ── Section 3: Luật sư ── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Scale className="w-5 h-5 text-purple-600" />
          <h3 className="text-base font-semibold text-slate-800">Luật sư bào chữa</h3>
          <div className="flex-1 h-px bg-slate-200" />
        </div>
        <LawyerSubList
          caseId={caseId}
          suspectOptions={suspectOptions}
          loadingSuspects={loadingSuspects}
        />
      </section>
    </div>
  );
}
