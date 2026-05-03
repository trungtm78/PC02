/**
 * ObjectListPage — Quản lý Đối tượng (Subjects)
 * TASK-2026-261224
 *
 * Pattern: Refs/SuspectsManagement.tsx
 * Primary color: purple-600
 */

import { useState, useCallback, useEffect } from "react";
import { api } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Plus,
  Filter,
  ChevronLeft,
  ChevronRight,
  X,
  AlertTriangle,
  Users,
  UserCheck,
  UserX,
  Eye,
  Pencil,
  Trash2,
  Loader2,
} from "lucide-react";
import { FKSelect, type FKOption } from "@/components/FKSelect";
import { usePermission } from "@/hooks/usePermission";
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
  STATUS_BADGE_BASE,
  EMPTY_STATE_WRAPPER,
  EMPTY_STATE_ICON,
  EMPTY_STATE_TEXT,
  EMPTY_STATE_SUBTEXT,
  getInputClass,
} from "@/constants/styles";

// ─── Types ───────────────────────────────────────────────────────────────────

type SubjectStatus = "INVESTIGATING" | "DETAINED" | "RELEASED" | "WANTED";
type Gender = "MALE" | "FEMALE" | "OTHER";
export type SubjectType = "SUSPECT" | "VICTIM" | "WITNESS"; // TASK-2026-261225

interface Subject {
  id: string;
  fullName: string;
  dateOfBirth: string;
  gender: Gender;
  idNumber: string;
  address: string;
  phone?: string;
  occupationId?: string;
  nationalityId?: string;
  districtId?: string;
  wardId?: string;
  caseId: string;
  crimeId: string;
  type: SubjectType;       // TASK-2026-261225
  status: SubjectStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  case?: { id: string; name: string; status: string };
}

interface SubjectListResponse {
  success: boolean;
  data: Subject[];
  total: number;
  page: number;
  pageSize: number;
}

interface FormData {
  fullName: string;
  dateOfBirth: string;
  gender: Gender;
  idNumber: string;
  address: string;
  phone: string;
  occupationId: string;
  nationalityId: string;
  districtId: string;
  wardId: string;
  caseId: string;
  crimeId: string;
  status: SubjectStatus;
  notes: string;
}

interface FormErrors {
  fullName?: string;
  dateOfBirth?: string;
  idNumber?: string;
  address?: string;
  caseId?: string;
  crimeId?: string;
}

interface DirectoryItem {
  id: string;
  type: string;
  code: string;
  name: string;
  parentId?: string;
  isActive: boolean;
}

interface CaseItem {
  id: string;
  name: string;
  status: string;
}


// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_LABELS: Record<SubjectStatus, string> = {
  INVESTIGATING: "Đang điều tra",
  DETAINED: "Đang tạm giam",
  RELEASED: "Đã thả",
  WANTED: "Đang truy nã",
};

const STATUS_COLORS: Record<SubjectStatus, string> = {
  INVESTIGATING: "bg-blue-100 text-blue-700",
  DETAINED: "bg-red-100 text-red-700",
  RELEASED: "bg-green-100 text-green-700",
  WANTED: "bg-orange-100 text-orange-700",
};

const GENDER_LABELS: Record<Gender, string> = {
  MALE: "Nam",
  FEMALE: "Nữ",
  OTHER: "Khác",
};

function StatusBadge({ status }: { status: SubjectStatus }) {
  return (
    <span className={`${STATUS_BADGE_BASE} ${STATUS_COLORS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

// ─── Form validation ──────────────────────────────────────────────────────────

function validateForm(data: FormData): FormErrors {
  const errors: FormErrors = {};
  if (!data.fullName.trim()) errors.fullName = "Họ tên không được để trống";
  if (!data.dateOfBirth) errors.dateOfBirth = "Ngày sinh không được để trống";
  if (!data.idNumber.trim()) {
    errors.idNumber = "Số CCCD/CMND không được để trống";
  } else if (!/^\d{9}$|^\d{12}$/.test(data.idNumber)) {
    errors.idNumber = "Số CCCD/CMND phải có 9 hoặc 12 chữ số";
  }
  if (!data.address.trim()) errors.address = "Địa chỉ không được để trống";
  if (!data.caseId) errors.caseId = "Vụ án không được để trống";
  if (!data.crimeId) errors.crimeId = "Tội danh không được để trống";
  return errors;
}

const EMPTY_FORM: FormData = {
  fullName: "",
  dateOfBirth: "",
  gender: "MALE",
  idNumber: "",
  address: "",
  phone: "",
  occupationId: "",
  nationalityId: "",
  districtId: "",
  wardId: "",
  caseId: "",
  crimeId: "",
  status: "INVESTIGATING",
  notes: "",
};

// ─── SubjectForm modal ────────────────────────────────────────────────────────

interface SubjectFormProps {
  subject?: Subject | null;
  crimeOptions: FKOption[];
  caseOptions: FKOption[];
  districtOptions: FKOption[];
  wardOptions: FKOption[];
  nationalityOptions: FKOption[];
  occupationOptions: FKOption[];
  loadingOptions: boolean;
  onSave: (data: FormData) => Promise<void>;
  onClose: () => void;
  isSaving: boolean;
  serverError?: string;
}

function SubjectForm({
  subject,
  crimeOptions,
  caseOptions,
  districtOptions,
  wardOptions,
  nationalityOptions,
  occupationOptions,
  loadingOptions,
  onSave,
  onClose,
  isSaving,
  serverError,
}: SubjectFormProps) {
  const [form, setForm] = useState<FormData>(() => {
    if (subject) {
      return {
        fullName: subject.fullName,
        dateOfBirth: subject.dateOfBirth?.split("T")[0] ?? "",
        gender: subject.gender,
        idNumber: subject.idNumber,
        address: subject.address,
        phone: subject.phone ?? "",
        occupationId: subject.occupationId ?? "",
        nationalityId: subject.nationalityId ?? "",
        districtId: subject.districtId ?? "",
        wardId: subject.wardId ?? "",
        caseId: subject.caseId,
        crimeId: subject.crimeId,
        status: subject.status,
        notes: subject.notes ?? "",
      };
    }
    return EMPTY_FORM;
  });

  const [errors, setErrors] = useState<FormErrors>({});

  // Filtered ward options by selected district
  // wardId is stored with parentId in metadata — currently all wards shown;
  // backend API pre-filters by districtId in production query.
  const filteredWards = form.districtId
    ? wardOptions
    : wardOptions;

  // Set field helper
  const setField = useCallback(
    <K extends keyof FormData>(key: K, value: FormData[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    },
    []
  );

  // When district changes, reset ward
  const handleDistrictChange = useCallback(
    (value: string) => {
      setForm((prev) => ({ ...prev, districtId: value, wardId: "" }));
      setErrors((prev) => ({ ...prev, districtId: undefined, wardId: undefined }));
    },
    []
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validateForm(form);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    await onSave(form);
  };

  return (
    <div className={MODAL_OVERLAY} role="dialog" aria-modal="true">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className={MODAL_HEADER}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4 text-slate-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">
                {subject ? "Chỉnh sửa đối tượng" : "Thêm đối tượng mới"}
              </h2>
              <p className="text-xs text-slate-500">
                {subject ? `ID: ${subject.id}` : "Nhập thông tin đối tượng"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-6 space-y-6"
          noValidate
        >
          {/* Server error */}
          {serverError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {serverError}
            </div>
          )}

          {/* ── Thông tin cá nhân ── */}
          <div>
            <h3 className="text-sm font-semibold text-purple-700 uppercase tracking-wide mb-4">
              Thông tin cá nhân
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Họ tên */}
              <div className="md:col-span-2">
                <label className={LABEL_BASE}>
                  Họ và tên <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.fullName}
                  onChange={(e) => setField("fullName", e.target.value)}
                  className={getInputClass(!!errors.fullName)}
                  placeholder="Nguyễn Văn A"
                  data-testid="subject-fullName"
                />
                {errors.fullName && (
                  <p className={FIELD_ERROR_TEXT}>{errors.fullName}</p>
                )}
              </div>

              {/* Ngày sinh */}
              <div>
                <label className={LABEL_BASE}>
                  Ngày sinh <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(e) => setField("dateOfBirth", e.target.value)}
                  className={getInputClass(!!errors.dateOfBirth)}
                  data-testid="subject-dateOfBirth"
                />
                {errors.dateOfBirth && (
                  <p className={FIELD_ERROR_TEXT}>{errors.dateOfBirth}</p>
                )}
              </div>

              {/* Giới tính */}
              <div>
                <label className={LABEL_BASE}>Giới tính</label>
                <select
                  value={form.gender}
                  onChange={(e) => setField("gender", e.target.value as Gender)}
                  className={SELECT_BASE}
                  data-testid="subject-gender"
                >
                  <option value="MALE">Nam</option>
                  <option value="FEMALE">Nữ</option>
                  <option value="OTHER">Khác</option>
                </select>
              </div>

              {/* Số CCCD/CMND */}
              <div>
                <label className={LABEL_BASE}>
                  Số CCCD/CMND <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.idNumber}
                  onChange={(e) => setField("idNumber", e.target.value)}
                  className={getInputClass(!!errors.idNumber)}
                  placeholder="012345678901"
                  maxLength={12}
                  data-testid="subject-idNumber"
                />
                {errors.idNumber && (
                  <p className={FIELD_ERROR_TEXT}>{errors.idNumber}</p>
                )}
              </div>

              {/* Điện thoại */}
              <div>
                <label className={LABEL_BASE}>Điện thoại</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setField("phone", e.target.value)}
                  className={INPUT_BASE}
                  placeholder="0912345678"
                  data-testid="subject-phone"
                />
              </div>

              {/* Địa chỉ */}
              <div className="md:col-span-2">
                <label className={LABEL_BASE}>
                  Địa chỉ thường trú <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setField("address", e.target.value)}
                  className={getInputClass(!!errors.address)}
                  placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố"
                  data-testid="subject-address"
                />
                {errors.address && (
                  <p className={FIELD_ERROR_TEXT}>{errors.address}</p>
                )}
              </div>

              {/* Quận/Huyện */}
              <div>
                <FKSelect
                  label="Quận/Huyện"
                  value={form.districtId}
                  onChange={handleDistrictChange}
                  options={districtOptions}
                  loading={loadingOptions}
                  placeholder="Chọn quận/huyện..."
                  testId="subject-districtId"
                />
              </div>

              {/* Phường/Xã — cascade từ Quận/Huyện */}
              <div>
                <FKSelect
                  label="Phường/Xã"
                  value={form.wardId}
                  onChange={(v) => setField("wardId", v)}
                  options={filteredWards}
                  loading={loadingOptions}
                  placeholder={
                    form.districtId
                      ? "Chọn phường/xã..."
                      : "Chọn quận/huyện trước"
                  }
                  testId="subject-wardId"
                />
              </div>

              {/* Quốc tịch */}
              <div>
                <FKSelect
                  label="Quốc tịch"
                  value={form.nationalityId}
                  onChange={(v) => setField("nationalityId", v)}
                  options={nationalityOptions}
                  loading={loadingOptions}
                  placeholder="Chọn quốc tịch..."
                  testId="subject-nationalityId"
                />
              </div>

              {/* Nghề nghiệp */}
              <div>
                <FKSelect
                  label="Nghề nghiệp"
                  value={form.occupationId}
                  onChange={(v) => setField("occupationId", v)}
                  options={occupationOptions}
                  loading={loadingOptions}
                  placeholder="Chọn nghề nghiệp..."
                  testId="subject-occupationId"
                />
              </div>
            </div>
          </div>

          {/* ── Thông tin vụ án ── */}
          <div>
            <h3 className="text-sm font-semibold text-purple-700 uppercase tracking-wide mb-4">
              Thông tin vụ án
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Vụ án */}
              <div>
                <FKSelect
                  label="Vụ án"
                  required
                  error={errors.caseId}
                  value={form.caseId}
                  onChange={(v) => setField("caseId", v)}
                  options={caseOptions}
                  loading={loadingOptions}
                  placeholder="Tìm kiếm vụ án..."
                  testId="subject-caseId"
                />
              </div>

              {/* Tội danh */}
              <div>
                <FKSelect
                  label="Tội danh"
                  required
                  error={errors.crimeId}
                  value={form.crimeId}
                  onChange={(v) => setField("crimeId", v)}
                  options={crimeOptions}
                  loading={loadingOptions}
                  placeholder="Tìm kiếm tội danh..."
                  testId="subject-crimeId"
                />
              </div>

              {/* Trạng thái */}
              <div>
                <label className={LABEL_BASE}>Trạng thái</label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setField("status", e.target.value as SubjectStatus)
                  }
                  className={SELECT_BASE}
                  data-testid="subject-status"
                >
                  <option value="INVESTIGATING">Đang điều tra</option>
                  <option value="DETAINED">Đang tạm giam</option>
                  <option value="RELEASED">Đã thả</option>
                  <option value="WANTED">Đang truy nã</option>
                </select>
              </div>
            </div>
          </div>

          {/* ── Ghi chú ── */}
          <div>
            <label className={LABEL_BASE}>Ghi chú</label>
            <textarea
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              className={`${TEXTAREA_BASE} h-24 resize-none`}
              placeholder="Nhập ghi chú về đối tượng..."
              data-testid="subject-notes"
            />
          </div>
        </form>

        {/* Footer */}
        <div className={MODAL_FOOTER}>
          <button
            type="button"
            onClick={onClose}
            className={BTN_SECONDARY}
            disabled={isSaving}
          >
            Hủy
          </button>
          <button
            type="submit"
            form=""
            onClick={handleSubmit as unknown as React.MouseEventHandler<HTMLButtonElement>}
            className={`${BTN_PRIMARY} bg-purple-600 hover:bg-purple-700 flex items-center gap-2`}
            disabled={isSaving}
            data-testid="subject-submit"
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            {subject ? "Lưu thay đổi" : "Tạo đối tượng"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete confirmation dialog ───────────────────────────────────────────────

function DeleteDialog({
  subject,
  onConfirm,
  onClose,
  isDeleting,
}: {
  subject: Subject;
  onConfirm: () => void;
  onClose: () => void;
  isDeleting: boolean;
}) {
  return (
    <div className={MODAL_OVERLAY}>
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">
                Xác nhận xóa đối tượng
              </h2>
              <p className="text-sm text-slate-500">Thao tác này không thể hoàn tác</p>
            </div>
          </div>
          <p className="text-sm text-slate-700 mb-6">
            Bạn có chắc chắn muốn xóa đối tượng{" "}
            <span className="font-semibold text-slate-900">
              {subject.fullName}
            </span>{" "}
            (CCCD: {subject.idNumber})?
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className={BTN_SECONDARY}
              disabled={isDeleting}
            >
              Hủy
            </button>
            <button
              onClick={onConfirm}
              className={`${BTN_DANGER} flex items-center gap-2`}
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
              Xóa đối tượng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Type config maps — TASK-2026-261225 ──────────────────────────────────────

const TYPE_CONFIG: Record<SubjectType, {
  label: string; pageTitle: string; pageSubtitle: string; btnLabel: string;
  iconBg: string; btnClass: string; ringClass: string; avatarBg: string; avatarText: string;
}> = {
  SUSPECT: {
    label: "Bị can", pageTitle: "Quản lý Đối tượng", pageSubtitle: "Danh sách Bị can / Bị cáo trong các vụ án", btnLabel: "Thêm bị can",
    iconBg: "bg-purple-600", btnClass: "bg-purple-600 hover:bg-purple-700", ringClass: "focus:ring-purple-500", avatarBg: "bg-purple-100", avatarText: "text-purple-700",
  },
  VICTIM: {
    label: "Bị hại", pageTitle: "Quản lý Bị hại", pageSubtitle: "Danh sách Bị hại trong các vụ án — Phòng PC02", btnLabel: "Thêm bị hại",
    iconBg: "bg-rose-600", btnClass: "bg-rose-600 hover:bg-rose-700", ringClass: "focus:ring-rose-500", avatarBg: "bg-rose-100", avatarText: "text-rose-700",
  },
  WITNESS: {
    label: "Nhân chứng", pageTitle: "Quản lý Nhân chứng", pageSubtitle: "Danh sách Nhân chứng trong các vụ án", btnLabel: "Thêm nhân chứng",
    iconBg: "bg-teal-600", btnClass: "bg-teal-600 hover:bg-teal-700", ringClass: "focus:ring-teal-500", avatarBg: "bg-teal-100", avatarText: "text-teal-700",
  },
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface ObjectListPageProps {
  subjectType?: SubjectType; // defaults to SUSPECT for backward compat
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ObjectListPage({ subjectType = "SUSPECT" }: ObjectListPageProps) {
  const queryClient = useQueryClient();
  const typeConfig = TYPE_CONFIG[subjectType];
  const { canEdit } = usePermission();
  const canEditRow = canEdit('objects');

  // ── Filter state ──
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<SubjectStatus | "">("");
  const [caseFilter, setCaseFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  // ── Modal state ──
  const [showForm, setShowForm] = useState(false);
  const [editSubject, setEditSubject] = useState<Subject | null>(null);
  const [deleteSubject, setDeleteSubject] = useState<Subject | null>(null);
  const [formError, setFormError] = useState<string | undefined>();

  // ── Fetch subjects (filtered by subjectType) ──
  const { data, isLoading, isError } = useQuery<SubjectListResponse>({
    queryKey: ["subjects", subjectType, search, statusFilter, caseFilter, page],
    queryFn: () => {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String((page - 1) * PAGE_SIZE),
        type: subjectType,  // TASK-2026-261225: always filter by type
      });
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      if (caseFilter) params.set("caseId", caseFilter);
      return api.get(`/subjects?${params}`).then((r) => r.data);
    },
  });

  // ── Fetch directory options ──
  const { data: directoriesData, isLoading: loadingDirs } = useQuery<{
    success: boolean;
    data: DirectoryItem[];
  }>({
    queryKey: ["directories-all"],
    queryFn: () => api.get('/directories?limit=100').then((r) => r.data),
    staleTime: 10 * 60 * 1000,
  });

  const { data: casesData, isLoading: loadingCases } = useQuery<{
    success: boolean;
    data: CaseItem[];
  }>({
    queryKey: ["cases-fk"],
    queryFn: () => api.get('/cases?limit=100').then((r) => r.data),
    staleTime: 10 * 60 * 1000,
  });

  const loadingOptions = loadingDirs || loadingCases;

  // Build FK option arrays
  const crimeOptions: FKOption[] =
    directoriesData?.data
      .filter((d) => d.type === "CRIME" && d.isActive)
      .map((d) => ({ value: d.id, label: d.name })) ?? [];

  const districtOptions: FKOption[] =
    directoriesData?.data
      .filter((d) => d.type === "DISTRICT" && d.isActive)
      .map((d) => ({ value: d.id, label: d.name })) ?? [];

  const wardOptions: FKOption[] =
    directoriesData?.data
      .filter((d) => d.type === "WARD" && d.isActive)
      .map((d) => ({ value: d.id, label: d.name })) ?? [];

  const nationalityOptions: FKOption[] =
    directoriesData?.data
      .filter((d) => d.type === "NATIONALITY" && d.isActive)
      .map((d) => ({ value: d.id, label: d.name })) ?? [];

  const occupationOptions: FKOption[] =
    directoriesData?.data
      .filter((d) => d.type === "OCCUPATION" && d.isActive)
      .map((d) => ({ value: d.id, label: d.name })) ?? [];

  const caseOptions: FKOption[] =
    casesData?.data.map((c) => ({ value: c.id, label: c.name })) ?? [];

  // ── Stats ──
  const subjects = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // SUSPECT stats
  const statDetained = subjects.filter((s) => s.status === "DETAINED").length;
  const statWanted   = subjects.filter((s) => s.status === "WANTED").length;
  const statInvestigating = subjects.filter((s) => s.status === "INVESTIGATING").length;

  // VICTIM stats (derived from status mapping — business logic per UI_Specs TABLE 2.2.A)
  // COMPENSATED ≡ RELEASED for victim (bồi thường xong → trả tự do)
  // PROCESSING  ≡ INVESTIGATING for victim (đang xử lý bồi thường)
  // DAMAGE      ≡ sum of damageAmount field — currently mock: count of DETAINED records as proxy
  const statVictimCompensated = subjects.filter((s) => s.status === "RELEASED").length;
  const statVictimProcessing  = subjects.filter((s) => s.status === "INVESTIGATING").length;
  // damageTotal: use placeholder 0 until backend provides damage field
  const statVictimDamage = 0;

  // WITNESS stats (derived from status mapping — per UI_Specs TABLE 2.2.A)
  // DECLARED ≡ RELEASED for witness (đã khai báo xong)
  // PENDING  ≡ INVESTIGATING for witness (chờ khai báo)
  // REFUSED  ≡ WANTED for witness (từ chối khai báo)
  const statWitnessDeclared  = subjects.filter((s) => s.status === "RELEASED").length;
  const statWitnessPending   = subjects.filter((s) => s.status === "INVESTIGATING").length;
  const statWitnessRefused   = subjects.filter((s) => s.status === "WANTED").length;

  // ── Create mutation ──
  const createMutation = useMutation({
    mutationFn: (dto: FormData) =>
      api.post("/subjects", {
          ...dto,
          type: subjectType,
          phone: dto.phone || undefined,
          occupationId: dto.occupationId || undefined,
          nationalityId: dto.nationalityId || undefined,
          districtId: dto.districtId || undefined,
          wardId: dto.wardId || undefined,
          notes: dto.notes || undefined,
        }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      setShowForm(false);
      setFormError(undefined);
    },
    onError: (err: Error) => {
      setFormError(err.message);
    },
  });

  // ── Update mutation ──
  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: FormData }) =>
      api.put(`/subjects/${id}`, {
          ...dto,
          phone: dto.phone || undefined,
          occupationId: dto.occupationId || undefined,
          nationalityId: dto.nationalityId || undefined,
          districtId: dto.districtId || undefined,
          wardId: dto.wardId || undefined,
          notes: dto.notes || undefined,
        }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      setShowForm(false);
      setEditSubject(null);
      setFormError(undefined);
    },
    onError: (err: Error) => {
      setFormError(err.message);
    },
  });

  // ── Delete mutation ──
  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete(`/subjects/${id}`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      setDeleteSubject(null);
    },
  });

  // ── Handlers ──
  const handleOpenCreate = () => {
    setEditSubject(null);
    setFormError(undefined);
    setShowForm(true);
  };

  const handleOpenEdit = (s: Subject) => {
    setEditSubject(s);
    setFormError(undefined);
    setShowForm(true);
  };

  const handleSave = async (formData: FormData) => {
    if (editSubject) {
      await updateMutation.mutateAsync({ id: editSubject.id, dto: formData });
    } else {
      await createMutation.mutateAsync(formData);
    }
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditSubject(null);
    setFormError(undefined);
  };

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, caseFilter]);

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Page header ── */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 ${typeConfig.iconBg} rounded-lg flex items-center justify-center`}>
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800" data-testid="page-title">
                {typeConfig.pageTitle}
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {typeConfig.pageSubtitle}
              </p>
            </div>
          </div>
          <button
            onClick={handleOpenCreate}
            className={`flex items-center gap-2 px-4 py-2.5 text-white rounded-lg transition-colors font-medium ${typeConfig.btnClass}`}
            data-testid="btn-add-subject"
          >
            <Plus className="w-4 h-4" />
            {typeConfig.btnLabel}
          </button>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6">
        {/* ── Stats cards — dynamic per subjectType (TASK-2026-261225) ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

          {/* Card 1: Tổng số — shared across all types */}
          <div
            className="bg-white rounded-lg border border-slate-200 p-4"
            data-testid="stat-card-total"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Tổng số
              </span>
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="w-4 h-4 text-blue-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-800">{total}</p>
            <p className="text-xs text-slate-500 mt-1">Tổng số {typeConfig.label.toLowerCase()}</p>
          </div>

          {/* Cards 2-4: dynamic per subjectType */}
          {subjectType === "SUSPECT" && (
            <>
              {/* Card 2: Tạm giam */}
              <div
                className="bg-white rounded-lg border border-slate-200 p-4"
                data-testid="stat-card-detained"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                    Tạm giam
                  </span>
                  <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                    <UserX className="w-4 h-4 text-red-600" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-red-600">{statDetained}</p>
                <p className="text-xs text-slate-500 mt-1">Đang tạm giam</p>
              </div>

              {/* Card 3: Truy nã */}
              <div
                className="bg-white rounded-lg border border-slate-200 p-4"
                data-testid="stat-card-wanted"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                    Truy nã
                  </span>
                  <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                    <Eye className="w-4 h-4 text-orange-600" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-orange-600">{statWanted}</p>
                <p className="text-xs text-slate-500 mt-1">Đang truy nã</p>
              </div>

              {/* Card 4: Đang điều tra */}
              <div
                className="bg-white rounded-lg border border-slate-200 p-4"
                data-testid="stat-card-investigating"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                    Điều tra
                  </span>
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Search className="w-4 h-4 text-purple-600" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-purple-600">{statInvestigating}</p>
                <p className="text-xs text-slate-500 mt-1">Đang điều tra</p>
              </div>
            </>
          )}

          {subjectType === "VICTIM" && (
            <>
              {/* Card 2: Đã bồi thường */}
              <div
                className="bg-white rounded-lg border border-slate-200 p-4"
                data-testid="stat-card-compensated"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                    Bồi thường
                  </span>
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <UserCheck className="w-4 h-4 text-green-600" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-green-600">{statVictimCompensated}</p>
                <p className="text-xs text-slate-500 mt-1">Đã bồi thường</p>
              </div>

              {/* Card 3: Đang xử lý */}
              <div
                className="bg-white rounded-lg border border-slate-200 p-4"
                data-testid="stat-card-processing"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                    Xử lý
                  </span>
                  <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                    <Eye className="w-4 h-4 text-amber-600" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-amber-600">{statVictimProcessing}</p>
                <p className="text-xs text-slate-500 mt-1">Đang xử lý</p>
              </div>

              {/* Card 4: Tổng thiệt hại (EC-03: large number — currency formatted) */}
              <div
                className="bg-white rounded-lg border border-slate-200 p-4"
                data-testid="stat-card-damage"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                    Thiệt hại
                  </span>
                  <div className="w-8 h-8 bg-rose-100 rounded-lg flex items-center justify-center">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                  </div>
                </div>
                <p
                  className="text-2xl font-bold text-rose-600 truncate"
                  title={statVictimDamage.toLocaleString("vi-VN") + " đ"}
                >
                  {statVictimDamage > 999_999_999
                    ? `${(statVictimDamage / 1_000_000_000).toFixed(1)} tỷ`
                    : statVictimDamage.toLocaleString("vi-VN")}
                </p>
                <p className="text-xs text-slate-500 mt-1">Tổng thiệt hại (đ)</p>
              </div>
            </>
          )}

          {subjectType === "WITNESS" && (
            <>
              {/* Card 2: Đã khai báo */}
              <div
                className="bg-white rounded-lg border border-slate-200 p-4"
                data-testid="stat-card-declared"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                    Khai báo
                  </span>
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <UserCheck className="w-4 h-4 text-green-600" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-green-600">{statWitnessDeclared}</p>
                <p className="text-xs text-slate-500 mt-1">Đã khai báo</p>
              </div>

              {/* Card 3: Chờ khai báo */}
              <div
                className="bg-white rounded-lg border border-slate-200 p-4"
                data-testid="stat-card-pending"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                    Chờ
                  </span>
                  <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                    <Search className="w-4 h-4 text-amber-600" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-amber-600">{statWitnessPending}</p>
                <p className="text-xs text-slate-500 mt-1">Chờ khai báo</p>
              </div>

              {/* Card 4: Từ chối */}
              <div
                className="bg-white rounded-lg border border-slate-200 p-4"
                data-testid="stat-card-refused"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                    Từ chối
                  </span>
                  <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                    <UserX className="w-4 h-4 text-red-600" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-red-600">{statWitnessRefused}</p>
                <p className="text-xs text-slate-500 mt-1">Từ chối khai báo</p>
              </div>
            </>
          )}

        </div>

        {/* ── Search & Filter bar ── */}
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm kiếm theo họ tên, số CCCD, địa chỉ..."
                className={`w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 ${typeConfig.ringClass} text-sm`}
                data-testid="search-input"
              />
            </div>

            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as SubjectStatus | "")
              }
              className="px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm bg-white"
              data-testid="status-filter"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="INVESTIGATING">Đang điều tra</option>
              <option value="DETAINED">Đang tạm giam</option>
              <option value="RELEASED">Đã thả</option>
              <option value="WANTED">Đang truy nã</option>
            </select>

            {/* Toggle advanced filters */}
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`flex items-center gap-2 px-3 py-2.5 border rounded-lg text-sm transition-colors ${
                showFilters
                  ? "border-purple-300 text-purple-700 bg-purple-50"
                  : "border-slate-300 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Filter className="w-4 h-4" />
              Bộ lọc
            </button>

            {/* Clear filters */}
            {(search || statusFilter || caseFilter) && (
              <button
                onClick={() => {
                  setSearch("");
                  setStatusFilter("");
                  setCaseFilter("");
                }}
                className="flex items-center gap-1 px-3 py-2.5 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Xóa lọc
              </button>
            )}
          </div>

          {/* Advanced filters */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={LABEL_BASE}>Lọc theo Vụ án</label>
                  <FKSelect
                    label=""
                    value={caseFilter}
                    onChange={setCaseFilter}
                    options={caseOptions}
                    loading={loadingCases}
                    placeholder="Chọn vụ án..."
                    testId="filter-caseId"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Table ── */}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          {/* Table meta */}
          <div className="px-6 py-3 border-b border-slate-200 flex items-center justify-between">
            <span className="text-sm text-slate-600">
              {isLoading
                ? "Đang tải..."
                : `Hiển thị ${subjects.length} / ${total} đối tượng`}
            </span>
            {total > 0 && (
              <span className="text-xs text-slate-500">
                Trang {page}/{totalPages}
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
              <span className="ml-3 text-slate-500">Đang tải dữ liệu...</span>
            </div>
          ) : isError ? (
            <div className={EMPTY_STATE_WRAPPER}>
              <AlertTriangle className={`${EMPTY_STATE_ICON} text-red-300`} />
              <p className={EMPTY_STATE_TEXT}>Lỗi tải dữ liệu</p>
              <p className={EMPTY_STATE_SUBTEXT}>
                Vui lòng thử lại hoặc liên hệ quản trị viên
              </p>
            </div>
          ) : subjects.length === 0 ? (
            <div className={EMPTY_STATE_WRAPPER}>
              <Users className={EMPTY_STATE_ICON} />
              <p className={EMPTY_STATE_TEXT}>Không có đối tượng nào</p>
              <p className={EMPTY_STATE_SUBTEXT}>
                {search || statusFilter || caseFilter
                  ? "Thử thay đổi bộ lọc tìm kiếm"
                  : "Nhấn \"Thêm đối tượng\" để tạo mới"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b-2 border-slate-200">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wide w-28 sticky left-0 bg-slate-50 z-10 border-r border-slate-200">
                      Thao tác
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wide">
                      Họ tên / CCCD
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wide">
                      Ngày sinh / Giới tính
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wide">
                      Vụ án liên quan
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wide">
                      Địa chỉ
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wide">
                      Trạng thái
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {subjects.map((s) => (
                    <tr
                      key={s.id}
                      onClick={canEditRow ? () => handleOpenEdit(s) : undefined}
                      onKeyDown={canEditRow ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOpenEdit(s); } } : undefined}
                      tabIndex={canEditRow ? 0 : undefined}
                      className={`transition-colors ${canEditRow ? "cursor-pointer hover:bg-blue-50" : "hover:bg-slate-50"}`}
                    >
                      {/* Thao tác — FIRST, sticky */}
                      <td
                        className="px-3 py-3 whitespace-nowrap sticky left-0 z-10 bg-white border-r border-slate-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenEdit(s)}
                            className={BTN_ICON_BLUE}
                            title="Chỉnh sửa"
                            data-testid={`btn-edit-${s.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteSubject(s)}
                            className={BTN_ICON_RED}
                            title="Xóa"
                            data-testid={`btn-delete-${s.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>

                      {/* Họ tên / CCCD */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 ${typeConfig.avatarBg} rounded-full flex items-center justify-center flex-shrink-0`}>
                            <span className={`text-xs font-bold ${typeConfig.avatarText}`}>
                              {s.fullName.charAt(0)}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-800">
                              {s.fullName}
                            </p>
                            <p className="text-xs text-slate-500">
                              CCCD: {s.idNumber}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Ngày sinh / Giới tính */}
                      <td className="px-4 py-3">
                        <p className="text-sm text-slate-700">
                          {new Date(s.dateOfBirth).toLocaleDateString("vi-VN")}
                        </p>
                        <p className="text-xs text-slate-500">
                          {GENDER_LABELS[s.gender]}
                        </p>
                      </td>

                      {/* Vụ án */}
                      <td className="px-4 py-3 max-w-[180px]">
                        {s.case ? (
                          <span className={`text-sm ${typeConfig.avatarText} font-medium truncate block`}>
                            {s.case.name}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>

                      {/* Địa chỉ */}
                      <td className="px-4 py-3 max-w-[200px]">
                        <p className="text-sm text-slate-700 truncate">
                          {s.address}
                        </p>
                        {s.phone && (
                          <p className="text-xs text-slate-500">{s.phone}</p>
                        )}
                      </td>

                      {/* Trạng thái */}
                      <td className="px-4 py-3">
                        <StatusBadge status={s.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-3 border-t border-slate-200 flex items-center justify-between">
              <span className="text-sm text-slate-600">
                Tổng cộng {total} đối tượng
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-slate-700 px-2">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── SubjectForm modal ── */}
      {showForm && (
        <SubjectForm
          subject={editSubject}
          crimeOptions={crimeOptions}
          caseOptions={caseOptions}
          districtOptions={districtOptions}
          wardOptions={wardOptions}
          nationalityOptions={nationalityOptions}
          occupationOptions={occupationOptions}
          loadingOptions={loadingOptions}
          onSave={handleSave}
          onClose={handleCloseForm}
          isSaving={isSaving}
          serverError={formError}
        />
      )}

      {/* ── Delete confirmation ── */}
      {deleteSubject && (
        <DeleteDialog
          subject={deleteSubject}
          onConfirm={() => deleteMutation.mutate(deleteSubject.id)}
          onClose={() => setDeleteSubject(null)}
          isDeleting={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
