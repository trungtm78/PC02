import { DynamicLegacyFields } from "@/components/DynamicLegacyFields";
import { LegacyParityFields } from "@/components/LegacyParityFields";
import { LEGACY_PARITY_FIELDS } from "@/shared/legacy/legacyParityFields.generated";
import { LEGACY_FORM_OWNED_COLUMNS } from "@/features/cases/legacy-form-layout.def";
import { inMainForm } from "@/shared/legacy/shownFieldKeys";
import { LegacyRawPanel } from "@/components/LegacyRawPanel";
import { useState, useEffect, useMemo, useRef } from "react";
import { applyCaseFormDefaults } from './case-form-defaults';
import { caseDraftKey, clearCaseDraft, decodeCaseDraft, encodeCaseDraft, keepEditedCaseCode, legacyDraftMatches, LEGACY_CASE_DRAFT_KEY } from './draft-identity';
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { loiXungDot } from "@/lib/api-errors";
import { documentNumbersApi } from "@/features/document-numbers/api";
import { BangChiXem } from "@/components/shared/BangChiXem";
import { SaveSplitButton } from "@/features/petitions/components/SaveSplitButton";
import { DynamicExportDocumentsModal } from "@/features/document-templates/components/DynamicExportDocumentsModal";
import { PetitionCreateDocumentsStage, type PetitionStageHandle } from "@/features/petitions/components/PetitionCreateDocumentsStage";
import { RecordDuplicateReview, type RecordDuplicateReviewHandle } from "@/components/inputs/RecordDuplicateReview";
import { useFormDefaults } from "@/hooks/useFormDefaults";
import { useFormShortcuts } from "@/hooks/useFormShortcuts";
import { useFormErrorNavigation } from "@/hooks/useFormErrorNavigation";
import { useDeleteResourceModalSafe } from "@/features/_shared/modals/DeleteResourceModalContext";
import { CaseStatus } from "@/shared/enums/generated";
import { useOfficerOptions } from "@/hooks/useOfficerOptions";
import { usePermission } from "@/hooks/usePermission";
import { PERMISSION_RESOURCE } from "@/shared/enums/permissions";
import { caseForm as caseFormLabels } from "@/locales/vi";
import { cloneCaseState, hasUnchangedClonedDecisionNumber, mapPersistedCaseChildren } from "./clone-case";
import type { CaseCloneState, PersistedEvidence, PersistedSubject } from "./clone-case";
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
  CopyPlus,
} from "lucide-react";
import { TabBar } from "@/components/shared/TabBar";
import type { TabItem } from "@/components/shared/TabBar";
import type { TabId, Subject, Evidence, MediaFile, CaseFormData } from "./types";
import { INITIAL_FORM_DATA } from "./types";
import { buildCreateCasePayload } from "./buildCreateCasePayload";
import { hydrateFormFromUrl } from "./hydrateFormFromUrl"; // PR 3 + hotfix #112
import { PreSaveSummaryModal } from "./PreSaveSummaryModal"; // PR 3 v0.38.2.0
import { mergeCaseApiToFormData } from "./mergeCaseApiToFormData";
import { loadCaseMediaDocuments, prepareMediaFile, uploadPendingMedia } from './media-upload';
import { taiMucConDaCo } from "./taiMucConDaCo";
import type { MucDaCo } from "./tabs";
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
  const location = useLocation();
  const { canCreate } = usePermission();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams(); // PR 3 v0.38.2.0 — URL param hydration
  const isEditMode = !!id;
  const routeClone = (location.state as { cloneCase?: unknown } | null)?.cloneCase;
  const cloneInput = !isEditMode && routeClone && typeof routeClone === 'object' && 'formData' in routeClone
    ? routeClone as CaseCloneState
    : null;
  const draftProvenance = searchParams.get('caseProvenance');
  const draftKey = caseDraftKey(draftProvenance);
  // Máy chủ: người mở có GHI được hồ sơ không (luật checkWriteScope, 20/09/2026). false → chỉ xem: ẩn nút ghi, chặn lưu.
  // Thiếu trường (máy chủ cũ) → như trước.
  const [quyenGhi, setQuyenGhi] = useState<boolean | undefined>(undefined);
  const chiXem = isEditMode && quyenGhi === false;

  const returnPath = searchParams.get('returnPath');
  const safeReturn = ['/uy-thac-dieu-tra', '/cases'].includes(returnPath ?? '') ? returnPath! : '/cases';

  const [activeTab, setActiveTab] = useState<TabId>("info");
  const [manualCaseCodeState, setManualCaseCodeState] = useState({ routeKey: location.key, manual: false });
  const manualCaseCode = manualCaseCodeState.routeKey === location.key && manualCaseCodeState.manual;
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [showEvidenceModal, setShowEvidenceModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [editingEvidence, setEditingEvidence] = useState<Evidence | null>(null);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  // Form SỬA: mục con ĐÃ CÓ của vụ án (chỉ xem). `subjects`/`evidences` ở trên chỉ là mục THÊM trong lần sửa này.
  // undefined = đang tải, null = tải hỏng.
  const [doiTuongDaCo, setDoiTuongDaCo] = useState<MucDaCo[] | null | undefined>(undefined);
  const [vatChungDaCo, setVatChungDaCo] = useState<MucDaCo[] | null | undefined>(undefined);
  const napMucConDaCo = (caseId: string) => {
    setDoiTuongDaCo(undefined);
    setVatChungDaCo(undefined);
    void taiMucConDaCo(caseId).then((kq) => {
      setDoiTuongDaCo(kq.doiTuong);
      setVatChungDaCo(kq.vatChung);
    });
  };
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [mediaError, setMediaError] = useState('');
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const load = async () => {
      try {
        const documents = await loadCaseMediaDocuments(id, async (url) => {
          const response = await api.get<{ data: Array<{ id: string; originalName: string; mimeType: string; size: number; createdAt: string; recordedAt?: string | null; uploadedBy?: { firstName?: string; lastName?: string } }>; total: number }>(url);
          return response.data;
        });
        if (cancelled) return;
        setMediaFiles(documents.map((doc) => ({
          id: doc.id,
          name: doc.originalName,
          type: doc.mimeType,
          size: `${(doc.size / 1024 / 1024).toFixed(2)} MB`,
          uploadDate: formatVNDateTime(new Date(doc.createdAt)),
          uploader: [doc.uploadedBy?.firstName, doc.uploadedBy?.lastName].filter(Boolean).join(' '),
          recordDate: doc.recordedAt ?? undefined,
        })));
        setMediaError('');
      } catch {
        if (!cancelled) setMediaError(caseFormLabels.media.listFailed);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [id]);
  // PR 3 v0.38.2.0 — Pre-save summary modal state
  const [showPreSaveSummary, setShowPreSaveSummary] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const documentStageRef = useRef<PetitionStageHandle>(null);
  const duplicateReviewRef = useRef<RecordDuplicateReviewHandle>(null);
  const [isCloning, setIsCloning] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);
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
  const manualCaseCodeInput = manualCaseCode || (isEditMode && !!formData.caseCode && !/^\d{4}-\d+$/.test(formData.caseCode));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const [isDraftCodeLoading, setIsDraftCodeLoading] = useState(!isEditMode);

  const defaults = useFormDefaults();

  useEffect(() => {
    if (!cloneInput) return;
    setFormData(cloneInput.formData);
    setParityState(cloneInput.parityState);
    setMetaState(cloneInput.metaState);
    setSubjects(cloneInput.subjects);
    setEvidences(cloneInput.evidences);
    setShowDraftBanner(false);
  }, [cloneInput]);

  // v0.42 — Fetch draft caseCode preview on create mode mount.
  useEffect(() => {
    if (isEditMode) return;
    setIsDraftCodeLoading(true);
    documentNumbersApi.draft('CASE')
      .then((r) => setFormData((prev) => ({ ...prev, caseCode: keepEditedCaseCode(prev.caseCode, r.previewNumber) })))
      .catch((err) => console.error('draft fetch failed:', err))
      .finally(() => setIsDraftCodeLoading(false));
  }, [isEditMode, searchParams]);

  // Load draft from localStorage on mount (only when creating, not editing)
  useEffect(() => {
    if (!isEditMode && !cloneInput) {
      try {
        const saved = localStorage.getItem(draftKey);
        if (saved) {
          const restored = decodeCaseDraft(saved);
          if (restored) {
            setFormData(restored.formData);
            setParityState(restored.parityState);
            setMetaState(restored.metaState);
            setSubjects(restored.subjects);
            setEvidences(restored.evidences);
            setShowDraftBanner(true);
          }
        } else {
          const legacy = localStorage.getItem(LEGACY_CASE_DRAFT_KEY);
          if (legacy) {
            const parsed: unknown = JSON.parse(legacy);
            if (legacyDraftMatches(parsed, draftProvenance)) {
              const restored = decodeCaseDraft(legacy);
              if (restored) {
                setFormData(restored.formData);
                setParityState(restored.parityState);
                setMetaState(restored.metaState);
                setSubjects(restored.subjects);
                setEvidences(restored.evidences);
                setShowDraftBanner(true);
              }
            }
          }
        }
      } catch (error) { console.warn('Unable to restore case draft', error); }
    }
  }, [isEditMode, draftKey, draftProvenance, cloneInput]);

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
    setFormData((prev) => applyCaseFormDefaults(prev, {
      today: defaults.today,
      userId: defaults.userId,
      primaryTeamName: defaults.primaryTeamName,
      primaryTeamId: defaults.primaryTeamId,
    }));
  }, [isEditMode, defaults.isLoaded, defaults.today, defaults.userId, defaults.primaryTeamId, defaults.primaryTeamName]);
  const [recordUpdatedAt, setRecordUpdatedAt] = useState<string | null>(null);
  const [legacyRaw, setLegacyRaw] = useState<Record<string, unknown> | null>(null);
  const [metaState, setMetaState] = useState<Record<string, unknown>>({});
  const [parityState, setParityState] = useState<Record<string, unknown>>({});

  /**
   * MỘT nguồn cán bộ duy nhất cho cả ứng dụng, gom nhóm theo Tổ.
   *
   * Bản cũ tự gọi `/admin/users?limit=200` ngay tại đây — cùng lỗi đã vá ở màn Đơn thư và
   * Vụ việc: prod có 245 tài khoản đang hoạt động nên ô chọn THIẾU ~45 người, lại kéo cả tài
   * khoản đã khoá vào vì lời gọi riêng không lọc `status`. Hỏng im lặng.
   * Cổng `motNguonCanBoVuViec` chặn lời gọi thẳng mọc lại.
   */
  const { data: dsCanBo = [], isLoading: handlerLoading } = useOfficerOptions();

  // ─── Fetch data in edit mode ────────────────────────────────────────────

  useEffect(() => {
    if (isEditMode && id) napMucConDaCo(id);
  }, [id, isEditMode]);

  useEffect(() => {
    if (!isEditMode) return;
    setIsLoading(true);
    api.get(`/cases/${id}`)
      .then((res) => {
        const d = res.data.data;
        if (!d) return;
        setQuyenGhi(d.quyenGhi as boolean | undefined);
        // v0.37.2.5: extracted to mergeCaseApiToFormData helper. Now loads
        // caseProvenance + linkedPetitionId + linkedIncidentId + sourceDocumentNote
        // which were previously omitted (caused PUT 400 on EditMode submit).
        setFormData((prev) => mergeCaseApiToFormData(d, prev));
        setRecordUpdatedAt((d.updatedAt as string) ?? null);
        setLegacyRaw((d.legacyRaw as Record<string, unknown>) ?? null);
        setMetaState((d.metadata as Record<string, unknown>) ?? {});
        // CHỈ giữ cột mà form KHÔNG có ô. `parityState` được spread SAU payload khi lưu, nên
        // cột nào tab đã có ô mà vẫn nằm ở đây thì giá trị cán bộ vừa gõ bị hoàn nguyên về
        // giá trị lúc mở hồ sơ — màn hình vẫn báo lưu thành công. Ẩn ô ở panel là CHƯA ĐỦ:
        // ô ẩn nhưng giá trị vẫn nằm trong `parityState` và vẫn ghi đè.
        const ps: Record<string, unknown> = {};
        for (const f of LEGACY_PARITY_FIELDS.case) {
          if (LEGACY_FORM_OWNED_COLUMNS.has(f.col) || inMainForm('case', f.col)) continue;
          if ((d as Record<string, unknown>)[f.col] != null) ps[f.col] = (d as Record<string, unknown>)[f.col];
        }
        setParityState(ps);
      })
      .catch((err) => {
        console.error("[CaseFormPage] Failed to load case:", err);
      })
      .finally(() => setIsLoading(false));
  }, [id, isEditMode]);

  // ─── Validation ────────────────────────────────────────────────────────

  // Map field lỗi → data-testid để focus (field tab chính; utdt ở tab khác → bỏ qua, fallback scroll).
  const ERROR_FIELD_TESTID: Record<string, string> = {
    receiveDate: "input-receive-date",
    caseProvenance: "select-case-provenance",
    linkedPetitionId: "select-case-provenance",
    linkedIncidentId: "select-case-provenance",
    caseTitle: "input-case-title",
    handler: "fk-handler",
    utdt_donViGiao: "field-utdt_donViGiao",
    utdt_soQuyetDinhUyThac: "field-utdt_soQuyetDinhUyThac",
  };
  // Lỗi + testid theo THỨ TỰ hiển thị → dùng chung msgs (banner) + điều hướng ô lỗi.
  const buildErrors = (): { errors: Record<string, string>; fields: string[] } => {
    const errs: Record<string, string> = {};
    const order: string[] = [];
    const add = (key: string, msg: string) => { errs[key] = msg; order.push(key); };
    if (!formData.receiveDate) add("receiveDate", "Vui lòng chọn ngày tiếp nhận");
    else if (formData.receiveDate > today()) add("receiveDate", "Ngày tiếp nhận không được ở tương lai");
    // v0.37.1 Decision 7A 10/10 — validation 10/10 (multi-channel error display)
    if (!formData.caseProvenance) add("caseProvenance", "Vui lòng chọn Nguồn vụ án (BLTTHS Đ.143)");
    else if (formData.caseProvenance === "FROM_PETITION" && !formData.linkedPetitionId) add("linkedPetitionId", "Vui lòng chọn Đơn thư gốc");
    else if (formData.caseProvenance === "FROM_INCIDENT" && !formData.linkedIncidentId) add("linkedIncidentId", "Vui lòng chọn Vụ việc gốc");
    if (!formData.caseTitle.trim()) add("caseTitle", "Vui lòng nhập tiêu đề hồ sơ");
    if (!formData.handler) add("handler", "Vui lòng chọn điều tra viên");
    // v0.67.3 — UTDT requires donViGiao (field-specific message ở banner; field ở tab Ủy thác).
    if (formData.caseProvenance === 'UY_THAC_DIEU_TRA' && !formData.utdt_donViGiao?.trim())
      add("utdt_donViGiao", "Vui lòng nhập Đơn vị giao ủy thác (tab Thông tin Ủy thác)");
    if (hasUnchangedClonedDecisionNumber(
      formData.caseProvenance,
      formData.utdt_soQuyetDinhUyThac ?? '',
      cloneInput?.originalDecisionNumber,
    )) add('utdt_soQuyetDinhUyThac', caseFormLabels.clone.decisionNumberRequired);
    const fields = [...new Set(order.map((k) => ERROR_FIELD_TESTID[k]).filter(Boolean))];
    return { errors: errs, fields };
  };
  const validateForm = () => {
    const { errors: errs } = buildErrors();
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };
  // Focus ô lỗi đầu khi lưu + phím "Lỗi tiếp theo" (Shift+Enter) nhảy ô lỗi kế.
  const { focusFirstError, handleFormKeyDown } = useFormErrorNavigation(() => buildErrors().fields);

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
    if (chiXem) return; // chỉ xem: máy chủ sẽ 403 — không gửi
    if (!validateForm()) {
      const firstError = Object.keys(buildErrors().errors)[0];
      if (firstError?.startsWith('utdt_') && activeTab !== 'uy-thac') {
        setActiveTab('uy-thac');
        const testId = ERROR_FIELD_TESTID[firstError];
        requestAnimationFrame(() => {
          const field = testId ? document.querySelector<HTMLElement>(`[data-testid="${testId}"]`) : null;
          field?.focus();
          field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
        return;
      }
      if (!focusFirstError()) window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    // Reuse the saved record when an upload needs another attempt.
    if (isEditMode || createdId) {
      await handleConfirmSave();
      return;
    }
    setShowPreSaveSummary(true);
  };

  const handleConfirmSave = async () => {
    if (savingRef.current) return; // chống lưu chồng lấn (codex P2)
    if (chiXem) return;
    savingRef.current = true;
    setIsSaving(true);
    // Thu thập mục bị loại khỏi danh sách đối tượng để báo lại sau khi lưu xong.
    const subjectBiLoai: string[] = [];
    try {
      const duplicateReview = await duplicateReviewRef.current?.verify();
      if (!duplicateReview?.ok) {
        setShowPreSaveSummary(false);
        return;
      }
      // v0.37.2.3: payload helper extracted + tested.
      // Subjects and evidence are saved with the case; media bytes upload after the record exists.
      const payload = {
        ...buildCreateCasePayload(formData, {
          subjects,
          evidences,
          includeFalseStatisticFlags: Boolean(id || createdId),
          includeClearedArrays: Boolean(id || createdId),
          manualCaseCode,
          // Mục nào không gửi lên được thì phải nói ra. Loại im lặng là cách chắc chắn nhất
          // để dữ liệu biến mất mà cán bộ vẫn tưởng đã lưu.
          onSubjectBiLoai: (ten, lyDo) => subjectBiLoai.push(`${ten} — ${lyDo}`),
          legacyMetadata: metaState, // gộp trường hệ cũ động (editable) — form field thắng, giữ phần còn lại
        }),
        // Cột typed field-parity (di trú) → ghi thẳng cột (top-level)
        ...parityState,
        acknowledgedDuplicateIds: duplicateReview.acknowledgedIds,
      };
      let savedId: string | null;
      let savedUpdatedAt: string | undefined;
      if (id || createdId) {
        savedId = id ?? createdId;
        const res = await api.put(`/cases/${savedId}`, { ...payload, expectedUpdatedAt: recordUpdatedAt ?? undefined });
        savedUpdatedAt = (res?.data as { data?: { updatedAt?: string } } | undefined)?.data?.updatedAt;
      } else {
        const res = await api.post("/cases", payload);
        // Envelope {success, data:{id,updatedAt}} (cases.service.create) → bắt id + updatedAt.
        const data = (res?.data as { data?: { id?: string; updatedAt?: string } } | undefined)?.data;
        savedId = data?.id ?? null;
        savedUpdatedAt = data?.updatedAt;
        if (savedId) {
          setCreatedId(savedId);
          setSubjects([]);
          setEvidences([]);
          napMucConDaCo(savedId);
        }
      }
      // Refresh optimistic-lock baseline từ response → lưu lần 2 (sau "Lưu và xuất file" ở lại form)
      // không gửi recordUpdatedAt cũ gây 409 "đã được chỉnh sửa bởi người dùng khác".
      if (savedUpdatedAt) setRecordUpdatedAt(savedUpdatedAt);
      const documentUploadFailed = savedId && documentStageRef.current?.hasStaged()
        ? (await documentStageRef.current.uploadAll(savedId)).failed.length
        : 0;
      const mediaResult = savedId && mediaFiles.some((media) => media.file)
        ? await uploadPendingMedia(savedId, mediaFiles, async (body) => {
          const response = await api.post<{ data: { id: string } }>('/documents', body, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          return response.data.data;
        })
        : null;
      if (mediaResult) setMediaFiles(mediaResult.files);
      if (mediaResult) setMediaError(mediaResult.failed ? caseFormLabels.uploadFailed.replace('{count}', String(mediaResult.failed)) : '');
      const uploadFailed = documentUploadFailed + (mediaResult?.failed ?? 0);
      if (uploadFailed) {
        setShowPreSaveSummary(false);
        setErrors({ documents: caseFormLabels.uploadFailed.replace('{count}', String(uploadFailed)) });
        return;
      }
      // Sửa xong: mục vừa thêm đã thành mục ĐÃ CÓ. Xoá khỏi danh sách "thêm mới" và nạp lại danh sách đã có —
      // nếu cán bộ ở lại form ("Lưu và xuất file") rồi lưu lần nữa, mục ấy không bị gửi lại thành bản TRÙNG.
      if (isEditMode && id) {
        setSubjects([]);
        setEvidences([]);
        napMucConDaCo(id);
      }
      clearCaseDraft(localStorage, formData.caseProvenance || draftProvenance);
      setShowPreSaveSummary(false);
      // Cảnh báo mục bị loại phải hiện ở CẢ HAI nhánh. Nhánh "Lưu và xuất file" thoát sớm
      // nên trước đây nuốt luôn cảnh báo — đúng thứ mà `onSubjectBiLoai` sinh ra để chặn.
      if (subjectBiLoai.length > 0) {
        alert(["Các mục sau KHÔNG được lưu vào danh sách đối tượng:", ...subjectBiLoai].join("\n"));
      }
      // "Lưu và xuất file" → mở popup xuất chứng từ động (không alert/điều hướng ngay).
      if (exportAfterSaveRef.current && savedId) {
        setExportNavigateOnClose(true);
        setExportForId(savedId);
        return;
      }
      alert(isEditMode ? "Cập nhật hồ sơ thành công!" : "Lưu hồ sơ thành công!");
      navigate(safeReturn);
    } catch (err: unknown) {
      const response = (err as { response?: { status?: number; data?: { code?: string } } })?.response;
      const status = response?.status;
      if (status === 409 && response?.data?.code === 'DUPLICATE_REVIEW_REQUIRED') {
        setShowPreSaveSummary(false);
        await duplicateReviewRef.current?.verify();
        return;
      }
      if (status === 409) {
        // Lời của máy chủ: trùng giá trị khác với "người khác vừa sửa" — không gộp làm một.
        alert(loiXungDot(err, "Hồ sơ đã được chỉnh sửa bởi người dùng khác.\nVui lòng tải lại trang để xem phiên bản mới nhất trước khi chỉnh sửa."));
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
    localStorage.setItem(caseDraftKey(formData.caseProvenance || draftProvenance), encodeCaseDraft({ formData, parityState, metaState, subjects, evidences }));
    setShowDraftBanner(false);
  };

  const handleClone = async () => {
    if (!id || !canCreate(PERMISSION_RESOURCE.CASES) || isCloning) return;
    setCloneError(null);
    setIsCloning(true);
    try {
      const [subjectResponse, evidenceResponse] = await Promise.all([
        api.get<{ data: PersistedSubject[] }>(`/cases/${id}/subjects`),
        api.get<{ data: PersistedEvidence[] }>(`/cases/${id}/evidences`),
      ]);
      const persisted = mapPersistedCaseChildren(
        subjectResponse.data.data ?? [],
        evidenceResponse.data.data ?? [],
      );
      const cloned = cloneCaseState({
        formData,
        metaState,
        parityState,
        subjects: [...persisted.subjects, ...subjects],
        evidences: [...persisted.evidences, ...evidences],
      }, (kind) => `${kind}-${crypto.randomUUID()}`);
      navigate(`/cases/new?caseProvenance=${encodeURIComponent(formData.caseProvenance)}`, {
        state: { cloneCase: cloned },
      });
    } catch (error) {
      console.error('[CaseFormPage] Failed to load clone children', error);
      setCloneError(caseFormLabels.clone.loadError);
    } finally {
      setIsCloning(false);
    }
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
    canDelete: isEditMode && !chiXem && formData.status === CaseStatus.TIEP_NHAN,
    onReset: () => {
      // EDIT → route tạo mới (tránh ghi đè bản ghi cũ + sót ĐTBS/vật chứng/media).
      // CREATE → xoá draft + reload để sạch mọi state phụ.
      if (!confirm("Làm trống form và nhập lại từ đầu? Dữ liệu chưa lưu sẽ mất.")) return;
      if (isEditMode) { navigate("/cases/new"); return; }
      clearCaseDraft(localStorage, draftProvenance);
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

  const handleUploadMedia = (file: File, recordDate: string) => {
    const prepared = prepareMediaFile(file);
    const newFile: MediaFile = {
      id: `MF-${crypto.randomUUID()}`,
      name: prepared.name,
      type: prepared.type,
      size: `${(prepared.size / 1024 / 1024).toFixed(2)} MB`,
      uploadDate: formatVNDateTime(new Date()),
      uploader: "Nguyễn Văn A",
      recordDate,
      file: prepared,
    };
    setMediaFiles((previous) => [...previous, newFile]);
  };

  // ─── Dynamic tab list — UTDT tab inserted at position 2 when relevant ──

  const visibleTabs: TabItem<TabId>[] = useMemo(() => (
    formData.caseProvenance === 'UY_THAC_DIEU_TRA'
      ? [
          TABS[0],
          { id: 'uy-thac' as TabId, label: 'Thông tin Ủy thác', icon: <ArrowRightLeft className="w-4 h-4" /> },
          ...TABS.slice(1),
        ]
      : TABS
  ), [formData.caseProvenance]);

  // Reset to "info" if UTDT tab becomes invisible (e.g. caseProvenance changed)
  useEffect(() => {
    if (activeTab === 'uy-thac' && !visibleTabs.find((t) => t.id === 'uy-thac')) {
      setActiveTab('info');
    }
  }, [visibleTabs, activeTab]);

  // ─── Shared tab props ──────────────────────────────────────────────────

  const tabProps = { formData, setFormData, errors, setErrors, dsCanBo, handlerLoading, isDraftCodeLoading, isManualCaseCode: manualCaseCodeInput, onCaseCodeOverride: () => setManualCaseCodeState({ routeKey: location.key, manual: true }) };

  // ─── Render ────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50">
        <p className="text-slate-500">Đang tải dữ liệu...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50" data-testid="case-form-page" onKeyDown={handleFormKeyDown}>
      {cloneInput && !isEditMode && (
        <div role="status" className="bg-amber-50 border-b border-amber-200 px-6 py-3 text-sm text-amber-800" data-testid="case-clone-review">
          {caseFormLabels.clone.reviewNotice}
        </div>
      )}
      {cloneError && <div role="alert" className="bg-red-50 border-b border-red-200 px-6 py-3 text-sm text-red-700">{cloneError}</div>}
      {showDraftBanner && !isEditMode && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center justify-between">
          <span className="text-sm text-amber-800">Bản nháp được tìm thấy từ lần trước — dữ liệu đã được khôi phục.</span>
          <button onClick={() => { clearCaseDraft(localStorage, draftProvenance); setFormData(INITIAL_FORM_DATA); setShowDraftBanner(false); }} className="text-xs text-amber-600 hover:text-amber-800 underline ml-4">Bỏ qua</button>
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
            {isEditMode && canCreate(PERMISSION_RESOURCE.CASES) && (
              <button
                type="button"
                onClick={() => void handleClone()}
                disabled={isCloning || isLoading}
                className="px-4 py-2.5 border border-blue-300 text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors"
                data-testid="btn-clone-case"
              >
                <CopyPlus className="w-4 h-4 inline mr-2" />
                {isCloning ? caseFormLabels.clone.loading : caseFormLabels.clone.action}
              </button>
            )}
            <button
              onClick={handleCancel}
              className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              data-testid="btn-cancel"
            >
              <X className="w-4 h-4 inline mr-2" />
              Hủy
            </button>
            {!chiXem && <button
              onClick={handleSaveDraft}
              className="px-4 py-2.5 border border-blue-300 text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
              data-testid="btn-save-draft"
            >
              <Clock className="w-4 h-4 inline mr-2" />
              Lưu tạm
            </button>}
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
            {!chiXem && <SaveSplitButton
              onSave={handleSave}
              onSaveAndExport={handleSaveAndExport}
              isSubmitting={isSaving}
              label="Lưu hồ sơ"
              idPrefix="btn-save"
              mainTestId="btn-save"
            />}
          </div>
        </div>
      </div>

      {chiXem && <div className="mx-6 mt-4"><BangChiXem loai="Vụ án" /></div>}

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
      {!chiXem && <div className="px-6 pt-4">
        <RecordDuplicateReview
          ref={duplicateReviewRef}
          kind={formData.caseProvenance === 'UY_THAC_DIEU_TRA' ? 'delegation' : 'case'}
          name={formData.caseTitle}
          decisionNumber={formData.utdt_soQuyetDinhUyThac}
          excludeId={id}
        />
      </div>}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <fieldset disabled={chiXem} className="max-w-6xl mx-auto min-w-0 border-0 p-0">
          {activeTab === "info" && <TabInfo {...tabProps} />}
          {activeTab === "uy-thac" && <TabUyThac {...tabProps} />}
          {activeTab === "incident" && <TabIncident {...tabProps} />}
          {activeTab === "case" && <TabCase {...tabProps} />}
          {activeTab === "subjects" && (
            <TabSubjects
              {...tabProps}
              caseId={id ?? createdId ?? undefined}
              chiXem={chiXem || isSaving}
              cheDoSua={!!(id || createdId)}
              mucDaCo={doiTuongDaCo}
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
              {...tabProps}
              cheDoSua={!!(id || createdId)}
              mucDaCo={vatChungDaCo}
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
          {isEditMode ? (
            activeTab === "business-files" && <TabBusinessFiles caseId={id} chiXem={chiXem} />
          ) : (
            <div className={activeTab === "business-files" ? "" : "hidden"}>
              <PetitionCreateDocumentsStage ref={documentStageRef} entityKind="case" />
            </div>
          )}
          {activeTab === "statistics" && <TabStatistics {...tabProps} />}
          {activeTab === "media" && (
            <TabMedia
              {...tabProps}
              mediaFiles={mediaFiles}
              onUpload={handleUploadMedia}
              chiXem={chiXem}
              error={mediaError}
              onDownload={(documentId) => {
                void api.get<Blob>(`/documents/${documentId}/download`, { responseType: 'blob' })
                  .then((response) => {
                    const url = URL.createObjectURL(response.data);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = mediaFiles.find((item) => item.id === documentId)?.name ?? 'media';
                    link.click();
                    URL.revokeObjectURL(url);
                  })
                  .catch(() => setMediaError(caseFormLabels.media.downloadFailed));
              }}
              onDelete={(documentId) => {
                const media = mediaFiles.find((item) => item.id === documentId);
                if (media?.file) {
                  setMediaFiles((previous) => previous.filter((item) => item.id !== documentId));
                  return;
                }
                void api.delete(`/documents/${documentId}`)
                  .then(() => setMediaFiles((previous) => previous.filter((item) => item.id !== documentId)))
                  .catch(() => setMediaError(caseFormLabels.media.deleteFailed));
              }}
            />
          )}
          {/* Cột typed field-parity (di trú) — ô nhập chính thức, ghi thẳng cột */}
          {(isEditMode || !!cloneInput || Object.keys(parityState).length > 0) && (
            <LegacyParityFields
              entity="case"
              values={parityState}
              onChange={(col, v) => setParityState((prev) => ({ ...prev, [col]: v }))}
            />
          )}
          {/* Dữ liệu gốc hệ cũ — đầy đủ, tham khảo (pháp lý: không sót field) */}
          {(isEditMode || !!cloneInput || Object.keys(metaState).length > 0) && (
            <DynamicLegacyFields
              entity="case"
              values={metaState}
              onChange={(k, v) => setMetaState((prev) => ({ ...prev, [k]: v }))}
            />
          )}
          {isEditMode && <LegacyRawPanel raw={legacyRaw} />}
        </fieldset>
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
          chiXem={chiXem}
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
