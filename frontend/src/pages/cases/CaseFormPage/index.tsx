import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { documentNumbersApi } from "@/features/document-numbers/api";
import { SaveSplitButton } from "@/features/petitions/components/SaveSplitButton";
import { DynamicExportDocumentsModal } from "@/features/document-templates/components/DynamicExportDocumentsModal";
import { useFormDefaults } from "@/hooks/useFormDefaults";
import { useFormShortcuts } from "@/hooks/useFormShortcuts";
import { useDeleteResourceModalSafe } from "@/features/_shared/modals/DeleteResourceModalProvider";
import { CaseStatus } from "@/shared/enums/generated";
import {
  X,
  Clock,
  FileText,
  AlertTriangle,
  Scale,
  Users,
  Package,
  FolderOpen,
  BarChart3,
  Video,
  Shield,
  ArrowRightLeft,
} from "lucide-react";
import { TabBar } from "@/components/shared/TabBar";
import type { TabItem } from "@/components/shared/TabBar";
import type { TabId, Subject, Evidence, MediaFile, CaseFormData } from "./types";
import { INITIAL_FORM_DATA } from "./types";
import { buildCreateCasePayload } from "./buildCreateCasePayload";
import { hydrateFormFromUrl } from "./hydrateFormFromUrl"; // PR 3 + hotfix #112
import { PreSaveSummaryModal } from "./PreSaveSummaryModal"; // PR 3 v0.38.2.0
import { mergeCaseApiToFormData } from "./mergeCaseApiToFormData";
import {
  TabInfo,
  TabIncident,
  TabCase,
  TabSubjects,
  TabIncidentTDC,
  TabCaseTDC,
  TabEvidence,
  TabBusinessFiles,
  TabStatistics,
  TabMedia,
  TabUyThac,
} from "./tabs";
import { SubjectModal, EvidenceModal } from "./modals";
import { formatVNDateTime, today } from "@/lib/dates";

// ─── Tab Configuration ──────────────────────────────────────────────────────

const TABS: TabItem<TabId>[] = [
  { id: "info",           label: "Thông tin",       icon: <FileText className="w-4 h-4" /> },
  { id: "incident",       label: "Vụ việc",          icon: <AlertTriangle className="w-4 h-4" /> },
  { id: "case",           label: "Vụ án",            icon: <Scale className="w-4 h-4" /> },
  { id: "subjects",       label: "ĐTBS",             icon: <Users className="w-4 h-4" /> },
  { id: "incident-tdc",   label: "Vụ việc TĐC",      icon: <AlertTriangle className="w-4 h-4" /> },
  { id: "case-tdc",       label: "Vụ án TĐC",        icon: <Shield className="w-4 h-4" /> },
  { id: "evidence",       label: "Vật chứng",        icon: <Package className="w-4 h-4" /> },
  { id: "business-files", label: "Hồ sơ nghiệp vụ", icon: <FolderOpen className="w-4 h-4" /> },
  { id: "statistics",     label: "TK 48 trường",     icon: <BarChart3 className="w-4 h-4" /> },
  { id: "media",          label: "Ghi âm, ghi hình", icon: <Video className="w-4 h-4" /> },
];

// ─── Main Component ─────────────────────────────────────────────────────────

function CaseFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams(); // PR 3 v0.38.2.0 — URL param hydration
  const isEditMode = !!id;

  const returnPath = searchParams.get('returnPath');
  const safeReturn = ['/uy-thac-dieu-tra', '/cases'].includes(returnPath ?? '') ? returnPath! : '/cases';

  const [activeTab, setActiveTab] = useState<TabId>("info");
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [showEvidenceModal, setShowEvidenceModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [editingEvidence, setEditingEvidence] = useState<Evidence | null>(null);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  // PR 3 v0.38.2.0 — Pre-save summary modal state
  const [showPreSaveSummary, setShowPreSaveSummary] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // Export chứng từ động (epic vụ việc/vụ án PR3) — id record để mở modal sau khi lưu / In trực tiếp.
  const [exportForId, setExportForId] = useState<string | null>(null);
  // Khi mở modal qua "Lưu và xuất file" → đóng modal thì điều hướng về danh sách;
  // khi mở qua nút "In chứng từ" (edit mode) → ở lại form.
  const [exportNavigateOnClose, setExportNavigateOnClose] = useState(false);
  // intent của lượt lưu hiện tại (ref tránh stale closure khi confirm qua PreSaveSummaryModal).
  const exportAfterSaveRef = useRef(false);
  // [codex P2] guard in-flight đồng bộ: chặn lượt lưu thứ 2 chồng lấn (đổi intent / double-submit)
  // trước khi setIsSaving kịp disable nút.
  const savingRef = useRef(false);

  const [formData, setFormData] = useState<CaseFormData>(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const [isDraftCodeLoading, setIsDraftCodeLoading] = useState(!isEditMode);

  const defaults = useFormDefaults();

  // v0.42 — Fetch draft caseCode preview on create mode mount.
  // v0.68 — UTDT cases use 'UTDT' document type (separate counter + format UTDT-YYYY-NNNNN).
  useEffect(() => {
    if (isEditMode) return;
    const isUtdt = searchParams.get('caseProvenance') === 'UY_THAC_DIEU_TRA';
    const docType = isUtdt ? 'UTDT' : 'CASE';
    setIsDraftCodeLoading(true);
    documentNumbersApi.draft(docType)
      .then((r) => setFormData((prev) => ({ ...prev, caseCode: r.previewNumber })))
      .catch((err) => console.error('draft fetch failed:', err))
      .finally(() => setIsDraftCodeLoading(false));
  }, [isEditMode, searchParams]);

  // Load draft from localStorage on mount (only when creating, not editing)
  useEffect(() => {
    if (!isEditMode) {
      try {
        const saved = localStorage.getItem('caseFormDraft');
        if (saved) {
          setFormData(JSON.parse(saved));
          setShowDraftBanner(true);
        }
      } catch { /* ignore malformed draft */ }
    }
  }, [isEditMode]);

  // PR 3 v0.38.2.0 + Hotfix #112 — URL param hydration extracted to testable helper.
  // Entry path 2/3: button "Khởi tố thành vụ án" navigate với linkedIncidentId +
  // caseProvenance + expectedIncidentUpdatedAt. Helper hydrate vào formData.
  // Tested: urlHydration.test.ts (TDD red-green-restore verified).
  //
  // Bug 1 fix: Edit mode KHÔNG skip toàn bộ — chỉ skip các trường link (linkedIncidentId,
  // expectedIncidentUpdatedAt) vì chúng đã có từ API. Nhưng caseProvenance cần được set
  // ngay từ URL để tab UTDT hiển thị tức thì (không flash trống trước khi API trả về).
  // API response sau đó sẽ override đúng giá trị từ DB qua mergeCaseApiToFormData.
  useEffect(() => {
    const urlCaseProvenance = searchParams.get('caseProvenance');
    if (isEditMode) {
      // Trong edit mode: chỉ apply caseProvenance từ URL (để tab hiện ngay)
      // linkedIncidentId / expectedIncidentUpdatedAt bỏ qua — API sẽ lo
      if (urlCaseProvenance) {
        setFormData((prev) => ({ ...prev, caseProvenance: urlCaseProvenance }));
      }
      return;
    }
    const updates = hydrateFormFromUrl(searchParams);
    if (Object.keys(updates).length > 0) {
      setFormData((prev) => ({ ...prev, ...updates }));
    }
  }, [isEditMode, searchParams]);

  // Apply form defaults (today, current user, primary team) on create mode once profile is hydrated.
  // `prev.x ||` guard preserves user keystrokes if they typed before profile loaded.
  useEffect(() => {
    if (isEditMode || !defaults.isLoaded) return;
    setFormData((prev) => ({
      ...prev,
      receiveDate:     prev.receiveDate     || defaults.today,
      handler:         prev.handler         || defaults.userId            || "",
      supervisingUnit: prev.supervisingUnit || defaults.primaryTeamName   || "",
      assignedTeamId:  prev.assignedTeamId  || defaults.primaryTeamId     || "",
    }));
  }, [isEditMode, defaults.isLoaded, defaults.today, defaults.userId, defaults.primaryTeamId, defaults.primaryTeamName]);
  const [recordUpdatedAt, setRecordUpdatedAt] = useState<string | null>(null);

  // ─── Fetch danh sách điều tra viên từ API ──────────────────────────────
  const [handlerOptions, setHandlerOptions] = useState<{ value: string; label: string }[]>([]);
  const [handlerLoading, setHandlerLoading] = useState(false);

  useEffect(() => {
    setHandlerLoading(true);
    api.get<{ success: boolean; data: { id: string; firstName?: string; lastName?: string; username: string }[] }>(
      "/admin/users",
      { params: { limit: 200 } },
    )
      .then((res) => {
        const users = res.data.data ?? [];
        setHandlerOptions(
          users.map((u) => ({
            value: u.id,
            label: [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username,
          }))
        );
      })
      .catch(() => setHandlerOptions([]))
      .finally(() => setHandlerLoading(false));
  }, []);

  // ─── Fetch data in edit mode ────────────────────────────────────────────

  useEffect(() => {
    if (!isEditMode) return;
    setIsLoading(true);
    api.get(`/cases/${id}`)
      .then((res) => {
        const d = res.data.data;
        if (!d) return;
        // v0.37.2.5: extracted to mergeCaseApiToFormData helper. Now loads
        // caseProvenance + linkedPetitionId + linkedIncidentId + sourceDocumentNote
        // which were previously omitted (caused PUT 400 on EditMode submit).
        setFormData((prev) => mergeCaseApiToFormData(d, prev));
        setRecordUpdatedAt((d.updatedAt as string) ?? null);
      })
      .catch((err) => {
        console.error("[CaseFormPage] Failed to load case:", err);
      })
      .finally(() => setIsLoading(false));
  }, [id, isEditMode]);

  // ─── Validation ────────────────────────────────────────────────────────

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.receiveDate) newErrors.receiveDate = "Vui lòng chọn ngày tiếp nhận";
    if (formData.receiveDate && formData.receiveDate > today()) {
      // So chuỗi YYYY-MM-DD theo giờ VN — nhất quán default + tránh lệch biên múi giờ (CI UTC).
      newErrors.receiveDate = "Ngày tiếp nhận không được ở tương lai";
    }
    // v0.37.1 Decision 7A 10/10 — validation 10/10 (multi-channel error display)
    if (!formData.caseProvenance) {
      newErrors.caseProvenance = "Vui lòng chọn Nguồn vụ án (BLTTHS Đ.143)";
    } else if (formData.caseProvenance === "FROM_PETITION" && !formData.linkedPetitionId) {
      newErrors.linkedPetitionId = "Vui lòng chọn Đơn thư gốc";
    } else if (formData.caseProvenance === "FROM_INCIDENT" && !formData.linkedIncidentId) {
      newErrors.linkedIncidentId = "Vui lòng chọn Vụ việc gốc";
    }
    if (!formData.caseTitle.trim()) newErrors.caseTitle = "Vui lòng nhập tiêu đề hồ sơ";
    if (!formData.handler) newErrors.handler = "Vui lòng chọn điều tra viên";
    // v0.67.3 — UTDT requires donViGiao (originally enforced via throw in
    // buildCreateCasePayload, which got swallowed by handleConfirmSave's catch
    // and shown as generic "Lưu hồ sơ thất bại". Promote to validateForm so
    // the field-specific message lands in the top-of-form error banner.
    if (formData.caseProvenance === 'UY_THAC_DIEU_TRA' && !formData.utdt_donViGiao?.trim()) {
      newErrors.utdt_donViGiao = "Vui lòng nhập Đơn vị giao ủy thác (tab Thông tin Ủy thác)";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ─── Handlers ──────────────────────────────────────────────────────────

  // PR 3 v0.38.2.0: handleSave splits into 2 phases:
  // 1. handleSave → validate + show Pre-save Summary Modal (NEW gate)
  // 2. handleConfirmSave → actual POST after user confirms
  const handleSave = async () => {
    exportAfterSaveRef.current = false;
    await beginSave();
  };

  // "Lưu và xuất file" → lưu xong mở popup xuất chứng từ động (không điều hướng ngay).
  const handleSaveAndExport = async () => {
    exportAfterSaveRef.current = true;
    await beginSave();
  };

  const beginSave = async () => {
    if (!validateForm()) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    // Skip pre-save modal in edit mode (avoid friction for quick edits)
    if (isEditMode) {
      await handleConfirmSave();
      return;
    }
    setShowPreSaveSummary(true);
  };

  const handleConfirmSave = async () => {
    if (savingRef.current) return; // chống lưu chồng lấn (codex P2)
    savingRef.current = true;
    setIsSaving(true);
    try {
      // v0.37.2.3: payload helper extracted + tested.
      // PR 1 v0.38.0.0: wire sub-entity arrays (subjects/evidences/mediaFiles → documentIds)
      // để fix bug data-loss — atomic create với Case trong cùng transaction.
      const payload = buildCreateCasePayload(formData, {
        subjects,
        evidences,
        // HOTFIX (codex P1): documentIds disabled. MediaFile.id local-only,
        // file chưa thực sự upload. Truyền fake IDs sẽ throw 400 ở backend.
        // Future PR: implement actual upload trong handleUploadMedia.
        // documentIds: mediaFiles.map((m) => m.id),
      });
      let savedId: string | null;
      let savedUpdatedAt: string | undefined;
      if (isEditMode) {
        const res = await api.put(`/cases/${id}`, { ...payload, expectedUpdatedAt: recordUpdatedAt ?? undefined });
        savedId = id ?? null;
        savedUpdatedAt = (res?.data as { data?: { updatedAt?: string } } | undefined)?.data?.updatedAt;
      } else {
        const res = await api.post("/cases", payload);
        // Envelope {success, data:{id,updatedAt}} (cases.service.create) → bắt id + updatedAt.
        const data = (res?.data as { data?: { id?: string; updatedAt?: string } } | undefined)?.data;
        savedId = data?.id ?? null;
        savedUpdatedAt = data?.updatedAt;
      }
      // Refresh optimistic-lock baseline từ response → lưu lần 2 (sau "Lưu và xuất file" ở lại form)
      // không gửi recordUpdatedAt cũ gây 409 "đã được chỉnh sửa bởi người dùng khác".
      if (savedUpdatedAt) setRecordUpdatedAt(savedUpdatedAt);
      localStorage.removeItem('caseFormDraft');
      setShowPreSaveSummary(false);
      // "Lưu và xuất file" → mở popup xuất chứng từ động (không alert/điều hướng ngay).
      if (exportAfterSaveRef.current && savedId) {
        setExportNavigateOnClose(true);
        setExportForId(savedId);
        return;
      }
      alert(isEditMode ? "Cập nhật hồ sơ thành công!" : "Lưu hồ sơ thành công!");
      navigate(safeReturn);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        alert("Hồ sơ đã được chỉnh sửa bởi người dùng khác.\nVui lòng tải lại trang để xem phiên bản mới nhất trước khi chỉnh sửa.");
        return;
      }
      // v0.67.3 — surface client-side Errors (no `response` field) with their
      // own message instead of swallowing them into the generic alert.
      const isHttpError = !!(err as { response?: unknown })?.response;
      if (!isHttpError && err instanceof Error && err.message) {
        console.error("[CaseFormPage] Save error:", err);
        alert(err.message);
        return;
      }
      console.error("[CaseFormPage] Save error:", err);
      alert("Lưu hồ sơ thất bại. Vui lòng thử lại.");
    } finally {
      setIsSaving(false);
      savingRef.current = false;
    }
  };

  const handleSaveDraft = () => {
    localStorage.setItem('caseFormDraft', JSON.stringify(formData));
    setShowDraftBanner(false);
  };

  const handleCancel = () => {
    if (confirm("Bạn có chắc muốn hủy? Các thay đổi sẽ không được lưu.")) {
      navigate(safeReturn);
    }
  };

  // Phím tắt form: F2 Lưu, Esc Hủy, F4 In chứng từ, F3 Xóa (chỉ khi SỬA).
  const deleteModal = useDeleteResourceModalSafe();
  useFormShortcuts({
    onSave: () => void handleSave(),
    onCancel: handleCancel,
    onExportDocs: () => {
      if (id) { setExportNavigateOnClose(false); setExportForId(id); }
      else void handleSaveAndExport();
    },
    onDelete: () => {
      if (id && deleteModal) {
        deleteModal.open({ resourceType: "cases", recordId: id, onSuccess: () => navigate("/cases") });
      }
    },
    // Đồng bộ rule với danh sách: chỉ xóa khi trạng thái = Tiếp nhận (cases/row-actions.ts).
    canDelete: isEditMode && formData.status === CaseStatus.TIEP_NHAN,
    onReset: () => {
      // EDIT → route tạo mới (tránh ghi đè bản ghi cũ + sót ĐTBS/vật chứng/media).
      // CREATE → xoá draft + reload để sạch mọi state phụ.
      if (!confirm("Làm trống form và nhập lại từ đầu? Dữ liệu chưa lưu sẽ mất.")) return;
      if (isEditMode) { navigate("/cases/new"); return; }
      localStorage.removeItem("caseFormDraft");
      window.location.reload();
    },
  });

  const handleSaveSubject = (subject: Subject) => {
    if (editingSubject) {
      setSubjects(subjects.map((s) => (s.id === subject.id ? subject : s)));
    } else {
      setSubjects([...subjects, { ...subject, id: `SUB-${Date.now()}` }]);
    }
    setShowSubjectModal(false);
    setEditingSubject(null);
  };

  const handleSaveEvidence = (evidence: Evidence) => {
    if (editingEvidence) {
      setEvidences(evidences.map((e) => (e.id === evidence.id ? evidence : e)));
    } else {
      setEvidences([...evidences, { ...evidence, id: `EV-${Date.now()}` }]);
    }
    setShowEvidenceModal(false);
    setEditingEvidence(null);
  };

  const handleUploadMedia = (file: File) => {
    const newFile: MediaFile = {
      id: `MF-${Date.now()}`,
      name: file.name,
      type: file.type,
      size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
      uploadDate: formatVNDateTime(new Date()),
      uploader: "Nguyễn Văn A",
      recordDate: defaults.today,
    };
    setMediaFiles([...mediaFiles, newFile]);
  };

  // ─── Dynamic tab list — UTDT tab inserted at position 2 when relevant ──

  const visibleTabs: TabItem<TabId>[] = formData.caseProvenance === 'UY_THAC_DIEU_TRA'
    ? [
        TABS[0],
        { id: 'uy-thac' as TabId, label: 'Thông tin Ủy thác', icon: <ArrowRightLeft className="w-4 h-4" /> },
        ...TABS.slice(1),
      ]
    : TABS;

  // Reset to "info" if UTDT tab becomes invisible (e.g. caseProvenance changed)
  useEffect(() => {
    if (activeTab === 'uy-thac' && !visibleTabs.find((t) => t.id === 'uy-thac')) {
      setActiveTab('info');
    }
  }, [visibleTabs, activeTab]);

  // ─── Shared tab props ──────────────────────────────────────────────────

  const tabProps = { formData, setFormData, errors, setErrors, handlerOptions, handlerLoading, isDraftCodeLoading };

  // ─── Render ────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50">
        <p className="text-slate-500">Đang tải dữ liệu...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50" data-testid="case-form-page">
      {showDraftBanner && !isEditMode && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center justify-between">
          <span className="text-sm text-amber-800">Bản nháp được tìm thấy từ lần trước — dữ liệu đã được khôi phục.</span>
          <button onClick={() => { localStorage.removeItem('caseFormDraft'); setFormData(INITIAL_FORM_DATA); setShowDraftBanner(false); }} className="text-xs text-amber-600 hover:text-amber-800 underline ml-4">Bỏ qua</button>
        </div>
      )}
      {/* Header — F4 inline (was <PageHeader /> wrapper, deleted in this PR) */}
      <div className="bg-white border-b border-slate-200 px-6 py-4" data-testid="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              {formData.caseProvenance === 'UY_THAC_DIEU_TRA'
                ? (isEditMode ? "Chỉnh sửa ủy thác điều tra" : "Ủy thác điều tra — Tạo mới")
                : (isEditMode ? "Chỉnh sửa vụ án" : "Khởi tố vụ án mới")}
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              {formData.caseProvenance === 'UY_THAC_DIEU_TRA'
                ? (isEditMode ? "Cập nhật thông tin ủy thác điều tra" : "Nhập thông tin theo Điều 171 BLTTHS 2015")
                : (isEditMode ? "Cập nhật thông tin vụ án" : "Nhập đầy đủ thông tin vụ án — chọn Nguồn vụ án (BLTTHS Đ.143) trước")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleCancel}
              className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              data-testid="btn-cancel"
            >
              <X className="w-4 h-4 inline mr-2" />
              Hủy
            </button>
            <button
              onClick={handleSaveDraft}
              className="px-4 py-2.5 border border-blue-300 text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
              data-testid="btn-save-draft"
            >
              <Clock className="w-4 h-4 inline mr-2" />
              Lưu tạm
            </button>
            {isEditMode && id && (
              <button
                onClick={() => { setExportNavigateOnClose(false); setExportForId(id); }}
                className="px-4 py-2.5 border border-amber-300 text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors font-medium"
                data-testid="btn-print-docs"
              >
                <FileText className="w-4 h-4 inline mr-2" />
                In chứng từ
              </button>
            )}
            <SaveSplitButton
              onSave={handleSave}
              onSaveAndExport={handleSaveAndExport}
              isSubmitting={isSaving}
              label="Lưu hồ sơ"
              idPrefix="btn-save"
              mainTestId="btn-save"
            />
          </div>
        </div>
      </div>

      {/* v0.37.2.5 Decision 7A: top-level validation summary (aria-assertive) */}
      {Object.keys(errors).length > 0 && (
        <div
          role="alert"
          aria-live="assertive"
          className="mx-6 mt-4 rounded-lg border border-red-300 bg-red-50 p-4"
          data-testid="form-error-summary"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-red-700 mb-2">
                Vui lòng kiểm tra các lỗi sau:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-sm text-red-700">
                {Object.entries(errors).map(([field, msg]) => (
                  <li key={field}>{msg}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <TabBar tabs={visibleTabs} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto">
          {activeTab === "info" && <TabInfo {...tabProps} />}
          {activeTab === "uy-thac" && <TabUyThac {...tabProps} />}
          {activeTab === "incident" && <TabIncident {...tabProps} />}
          {activeTab === "case" && <TabCase {...tabProps} />}
          {activeTab === "subjects" && (
            <TabSubjects
              subjects={subjects}
              onAdd={() => { setEditingSubject(null); setShowSubjectModal(true); }}
              onEdit={(s) => { setEditingSubject(s); setShowSubjectModal(true); }}
              onDelete={(id) => {
                if (confirm("Bạn có chắc muốn xóa đối tượng này?")) {
                  setSubjects(subjects.filter((s) => s.id !== id));
                }
              }}
            />
          )}
          {activeTab === "incident-tdc" && <TabIncidentTDC {...tabProps} />}
          {activeTab === "case-tdc" && <TabCaseTDC {...tabProps} />}
          {activeTab === "evidence" && (
            <TabEvidence
              evidences={evidences}
              onAdd={() => { setEditingEvidence(null); setShowEvidenceModal(true); }}
              onEdit={(e) => { setEditingEvidence(e); setShowEvidenceModal(true); }}
              onDelete={(id) => {
                if (confirm("Bạn có chắc muốn xóa vật chứng này?")) {
                  setEvidences(evidences.filter((e) => e.id !== id));
                }
              }}
            />
          )}
          {activeTab === "business-files" && <TabBusinessFiles caseId={isEditMode ? id : undefined} />}
          {activeTab === "statistics" && <TabStatistics {...tabProps} />}
          {activeTab === "media" && (
            <TabMedia
              mediaFiles={mediaFiles}
              onUpload={handleUploadMedia}
              onDelete={(id) => {
                if (confirm("Bạn có chắc muốn xóa file này?")) {
                  setMediaFiles(mediaFiles.filter((f) => f.id !== id));
                }
              }}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      {showSubjectModal && (
        <SubjectModal
          subject={editingSubject}
          onClose={() => { setShowSubjectModal(false); setEditingSubject(null); }}
          onSave={handleSaveSubject}
        />
      )}
      {showEvidenceModal && (
        <EvidenceModal
          evidence={editingEvidence}
          onClose={() => { setShowEvidenceModal(false); setEditingEvidence(null); }}
          onSave={handleSaveEvidence}
        />
      )}

      {/* PR 3 v0.38.2.0 — Pre-save Summary Modal (anti-bug data-loss gate) */}
      <PreSaveSummaryModal
        open={showPreSaveSummary}
        formData={formData}
        subjects={subjects}
        evidences={evidences}
        mediaFiles={mediaFiles}
        linkedIncidentCode={formData.incidentCode || undefined}
        linkedIncidentName={formData.incidentDescription || undefined}
        isSaving={isSaving}
        onConfirm={handleConfirmSave}
        onCancel={() => setShowPreSaveSummary(false)}
      />

      {/* Epic vụ việc/vụ án PR3 — popup xuất chứng từ động (mẫu admin upload) */}
      {exportForId && (
        <DynamicExportDocumentsModal
          entity="cases"
          entityId={exportForId}
          onClose={() => {
            setExportForId(null);
            if (exportNavigateOnClose) navigate(safeReturn);
          }}
        />
      )}
    </div>
  );
}

export default CaseFormPage;
