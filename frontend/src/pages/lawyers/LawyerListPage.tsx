/**
 * LawyerListPage — Quản lý Luật sư
 * TASK-2026-261225
 *
 * Pattern: Refs/pages/LawyerList.tsx
 * Primary color: blue-600 (consistent with Refs)
 */

import { useState, useCallback } from "react";
import { api } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  X,
  AlertTriangle,
  Loader2,
  Building2,
  Phone,
  User,
  Scale,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { FKSelect, type FKOption } from "@/components/FKSelect";
import { usePermission } from "@/hooks/usePermission";
import {
  LABEL_BASE,
  INPUT_BASE,
  FIELD_ERROR_TEXT,
  BTN_PRIMARY,
  BTN_SECONDARY,
  BTN_DANGER,
  BTN_ICON_BLUE,
  BTN_ICON_RED,
  MODAL_OVERLAY,
  MODAL_HEADER,
  MODAL_FOOTER,
  EMPTY_STATE_WRAPPER,
  EMPTY_STATE_ICON,
  EMPTY_STATE_TEXT,
  EMPTY_STATE_SUBTEXT,
  getInputClass,
} from "@/constants/styles";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Lawyer {
  id: string;
  fullName: string;
  lawFirm?: string;
  barNumber: string;
  phone?: string;
  caseId: string;
  subjectId?: string;
  createdAt: string;
  updatedAt: string;
  case?: { id: string; name: string; status: string };
  subject?: { id: string; fullName: string; type: string };
}

interface LawyerListResponse {
  success: boolean;
  data: Lawyer[];
  total: number;
  page: number;
  pageSize: number;
}

interface LawyerFormData {
  fullName: string;
  lawFirm: string;
  barNumber: string;
  phone: string;
  caseId: string;
  subjectId: string;
}

interface LawyerFormErrors {
  fullName?: string;
  barNumber?: string;
  caseId?: string;
}

interface CaseItem {
  id: string;
  name: string;
  status: string;
}

// ─── API helpers ─────────────────────────────────────────────────────────────


// ─── Form validation ──────────────────────────────────────────────────────────

function validateForm(data: LawyerFormData): LawyerFormErrors {
  const errors: LawyerFormErrors = {};
  if (!data.fullName.trim()) errors.fullName = "Họ tên không được để trống";
  if (!data.barNumber.trim()) errors.barNumber = "Số thẻ luật sư không được để trống";
  if (!data.caseId) errors.caseId = "Vụ án không được để trống";
  return errors;
}

const EMPTY_FORM: LawyerFormData = {
  fullName: "",
  lawFirm: "",
  barNumber: "",
  phone: "",
  caseId: "",
  subjectId: "",
};

// ─── LawyerForm modal ─────────────────────────────────────────────────────────

interface LawyerFormProps {
  lawyer?: Lawyer | null;
  caseOptions: FKOption[];
  subjectOptions: FKOption[];
  loadingOptions: boolean;
  onSave: (data: LawyerFormData) => Promise<void>;
  onClose: () => void;
  isSaving: boolean;
  serverError?: string;
}

function LawyerForm({
  lawyer,
  caseOptions,
  subjectOptions,
  loadingOptions,
  onSave,
  onClose,
  isSaving,
  serverError,
}: LawyerFormProps) {
  const [form, setForm] = useState<LawyerFormData>(() => {
    if (lawyer) {
      return {
        fullName: lawyer.fullName,
        lawFirm: lawyer.lawFirm ?? "",
        barNumber: lawyer.barNumber,
        phone: lawyer.phone ?? "",
        caseId: lawyer.caseId,
        subjectId: lawyer.subjectId ?? "",
      };
    }
    return EMPTY_FORM;
  });
  const [errors, setErrors] = useState<LawyerFormErrors>({});

  const setField = useCallback(
    <K extends keyof LawyerFormData>(key: K, value: LawyerFormData[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      setErrors((prev) => ({ ...prev, [key]: undefined }));
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
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className={MODAL_HEADER}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Scale className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">
                {lawyer ? "Chỉnh sửa luật sư" : "Thêm luật sư mới"}
              </h2>
              <p className="text-xs text-slate-500">
                {lawyer ? `ID: ${lawyer.id}` : "Nhập thông tin luật sư"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Đóng"
            data-testid="btn-close-lawyer-form"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-6 space-y-5"
          noValidate
        >
          {/* Server error */}
          {serverError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {serverError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Họ tên */}
            <div className="md:col-span-2">
              <label className={LABEL_BASE}>
                Họ và tên luật sư <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.fullName}
                onChange={(e) => setField("fullName", e.target.value)}
                className={getInputClass(!!errors.fullName)}
                placeholder="Luật sư Nguyễn Văn A"
                data-testid="lawyer-fullName"
              />
              {errors.fullName && (
                <p className={FIELD_ERROR_TEXT}>{errors.fullName}</p>
              )}
            </div>

            {/* Số thẻ luật sư */}
            <div>
              <label className={LABEL_BASE}>
                Số thẻ luật sư <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.barNumber}
                onChange={(e) => setField("barNumber", e.target.value)}
                className={getInputClass(!!errors.barNumber)}
                placeholder="LS-12345/HCM"
                data-testid="lawyer-barNumber"
              />
              {errors.barNumber && (
                <p className={FIELD_ERROR_TEXT}>{errors.barNumber}</p>
              )}
            </div>

            {/* Văn phòng luật sư */}
            <div>
              <label className={LABEL_BASE}>Văn phòng luật sư</label>
              <input
                type="text"
                value={form.lawFirm}
                onChange={(e) => setField("lawFirm", e.target.value)}
                className={INPUT_BASE}
                placeholder="Văn phòng Luật sư Công Lý"
                data-testid="lawyer-lawFirm"
              />
            </div>

            {/* Điện thoại */}
            <div>
              <label className={LABEL_BASE}>Điện thoại</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setField("phone", e.target.value)}
                className={INPUT_BASE}
                placeholder="0901234567"
                data-testid="lawyer-phone"
              />
            </div>

            {/* Vụ án — FK Select (AC-02) */}
            <div>
              <label className={LABEL_BASE}>
                Vụ án <span className="text-red-500">*</span>
              </label>
              <FKSelect
                label=""
                resource="cases"
                value={form.caseId}
                onChange={(v) => setField("caseId", v)}
                options={caseOptions}
                loading={loadingOptions}
                searchPlaceholder="Tìm vụ án..."
                placeholder="Chọn vụ án"
                data-testid="lawyer-caseId"
                error={errors.caseId}
              />
              {errors.caseId && (
                <p className={FIELD_ERROR_TEXT}>{errors.caseId}</p>
              )}
            </div>

            {/* Bị can — FK Select (AC-02: link to suspect ID) */}
            <div>
              <label className={LABEL_BASE}>Bị can bào chữa</label>
              <FKSelect
                label=""
                resource="subjects"
                value={form.subjectId}
                onChange={(v) => setField("subjectId", v)}
                options={subjectOptions}
                loading={loadingOptions}
                searchPlaceholder="Tìm bị can..."
                placeholder="Chọn bị can (tuỳ chọn)"
                data-testid="lawyer-subjectId"
              />
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className={MODAL_FOOTER}>
          <button onClick={onClose} className={BTN_SECONDARY} disabled={isSaving} data-testid="btn-cancel-lawyer">
            Hủy
          </button>
          <button
            onClick={handleSubmit as unknown as React.MouseEventHandler<HTMLButtonElement>}
            className={`${BTN_PRIMARY} flex items-center gap-2`}
            disabled={isSaving}
            data-testid="lawyer-submit"
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            {lawyer ? "Cập nhật" : "Tạo mới"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

export default function LawyerListPage() {
  const queryClient = useQueryClient();
  const { canEdit } = usePermission();
  const canEditRow = canEdit('lawyers');

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editLawyer, setEditLawyer] = useState<Lawyer | null>(null);
  const [deleteLawyer, setDeleteLawyer] = useState<Lawyer | null>(null);
  const [formError, setFormError] = useState<string | undefined>();

  // ── Fetch lawyers ──
  const { data, isLoading, isError } = useQuery<LawyerListResponse>({
    queryKey: ["lawyers", search, page],
    queryFn: () => {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String((page - 1) * PAGE_SIZE),
      });
      if (search) params.set("search", search);
      return api.get(`/lawyers?${params}`).then((r) => r.data);
    },
  });

  // ── Fetch cases for FK select ──
  const { data: casesData, isLoading: loadingCases } = useQuery<{
    success: boolean;
    data: CaseItem[];
  }>({
    queryKey: ["cases-fk"],
    queryFn: () => api.get('/cases?limit=100').then((r) => r.data),
    staleTime: 10 * 60 * 1000,
  });

  // ── Fetch suspects for FK select (subject type SUSPECT) ──
  const { data: suspectsData, isLoading: loadingSuspects } = useQuery<{
    success: boolean;
    data: Array<{ id: string; fullName: string }>;
  }>({
    queryKey: ["subjects-suspects-fk"],
    queryFn: () => api.get('/subjects?type=SUSPECT&limit=100').then((r) => r.data),
    staleTime: 10 * 60 * 1000,
  });

  const loadingOptions = loadingCases || loadingSuspects;

  const caseOptions: FKOption[] =
    casesData?.data.map((c) => ({ value: c.id, label: c.name })) ?? [];
  const subjectOptions: FKOption[] =
    suspectsData?.data.map((s) => ({ value: s.id, label: s.fullName })) ?? [];

  const lawyers = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: (dto: LawyerFormData) =>
      api.post("/lawyers", {
          ...dto,
          lawFirm: dto.lawFirm || undefined,
          phone: dto.phone || undefined,
          subjectId: dto.subjectId || undefined,
        }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lawyers"] });
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
      queryClient.invalidateQueries({ queryKey: ["lawyers"] });
      setShowForm(false);
      setEditLawyer(null);
      setFormError(undefined);
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete(`/lawyers/${id}`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lawyers"] });
      setDeleteLawyer(null);
    },
  });

  // ── Handlers ──
  const handleSave = async (formData: LawyerFormData) => {
    if (editLawyer) {
      await updateMutation.mutateAsync({ id: editLawyer.id, dto: formData });
    } else {
      await createMutation.mutateAsync(formData);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Page header ── */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Scale className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800" data-testid="page-title">
                Quản lý Luật sư
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Danh sách luật sư bào chữa trong các vụ án — Phòng PC02
              </p>
            </div>
          </div>
          <button
            onClick={() => { setEditLawyer(null); setFormError(undefined); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            data-testid="btn-add-lawyer"
          >
            <Plus className="w-4 h-4" />
            Thêm luật sư
          </button>
        </div>
      </div>

      <div className="px-6 py-6 space-y-5">
        {/* ── Search bar ── */}
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Tìm theo tên, số thẻ, văn phòng, điện thoại..."
              className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              data-testid="lawyer-search-input"
            />
          </div>
        </div>

        {/* ── Table ── */}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="font-semibold text-slate-800">Danh sách luật sư</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Tổng cộng {total} luật sư
            </p>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <span className="ml-2 text-slate-500">Đang tải...</span>
            </div>
          ) : isError ? (
            <div className="flex items-center justify-center py-12 text-red-500 gap-2">
              <AlertTriangle className="w-5 h-5" />
              Không thể tải danh sách luật sư
            </div>
          ) : lawyers.length === 0 ? (
            <div className={EMPTY_STATE_WRAPPER}>
              <div className={EMPTY_STATE_ICON}>
                <Scale className="w-6 h-6 text-slate-400" />
              </div>
              <p className={EMPTY_STATE_TEXT}>Chưa có luật sư nào</p>
              <p className={EMPTY_STATE_SUBTEXT}>Nhấn "Thêm luật sư" để bắt đầu</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="lawyer-list-table">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider w-28 sticky left-0 bg-slate-50 z-10 border-r border-slate-200">Thao tác</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">STT</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Số thẻ LS</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Họ và tên</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Văn phòng</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Điện thoại</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Vụ án</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Bị can</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {lawyers.map((lawyer, idx) => {
                    const handleEditLawyer = () => { setEditLawyer(lawyer); setFormError(undefined); setShowForm(true); };
                    return (
                    <tr
                      key={lawyer.id}
                      onClick={canEditRow ? handleEditLawyer : undefined}
                      onKeyDown={canEditRow ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleEditLawyer(); } } : undefined}
                      tabIndex={canEditRow ? 0 : undefined}
                      className={`transition-colors ${canEditRow ? "cursor-pointer hover:bg-blue-50" : "hover:bg-slate-50"}`}
                      data-testid={`lawyer-row-${lawyer.id}`}
                    >
                      {/* Thao tác — FIRST, sticky */}
                      <td
                        className="px-3 py-3 whitespace-nowrap sticky left-0 z-10 bg-white border-r border-slate-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-1">
                          <button
                            onClick={handleEditLawyer}
                            className={BTN_ICON_BLUE}
                            title="Chỉnh sửa"
                            data-testid={`btn-edit-lawyer-${lawyer.id}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteLawyer(lawyer)}
                            className={BTN_ICON_RED}
                            title="Xóa"
                            data-testid={`btn-delete-lawyer-${lawyer.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-blue-600">{lawyer.barNumber}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4 text-blue-600" />
                          </div>
                          <span className="text-sm font-medium text-slate-800">{lawyer.fullName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {lawyer.lawFirm ? (
                          <div className="flex items-center gap-1 text-sm text-slate-700">
                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            {lawyer.lawFirm}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {lawyer.phone ? (
                          <div className="flex items-center gap-1 text-sm text-slate-700">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            {lawyer.phone}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {lawyer.case?.name ?? <span className="text-xs text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {lawyer.subject?.fullName ?? <span className="text-xs text-slate-400">Chưa gán</span>}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Pagination ── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200">
              <p className="text-sm text-slate-500">
                Trang {page} / {totalPages} — {total} luật sư
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 text-slate-500 hover:text-slate-700 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 text-slate-500 hover:text-slate-700 disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Form modal ── */}
      {showForm && (
        <LawyerForm
          lawyer={editLawyer}
          caseOptions={caseOptions}
          subjectOptions={subjectOptions}
          loadingOptions={loadingOptions}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditLawyer(null); setFormError(undefined); }}
          isSaving={isSaving}
          serverError={formError}
        />
      )}

      {/* ── Delete confirm modal ── */}
      {deleteLawyer && (
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
                  <strong className="text-slate-800">{deleteLawyer.fullName}</strong>?
                  Hành động này không thể hoàn tác.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setDeleteLawyer(null)}
                className={BTN_SECONDARY}
                disabled={deleteMutation.isPending}
              >
                Hủy
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteLawyer.id)}
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
