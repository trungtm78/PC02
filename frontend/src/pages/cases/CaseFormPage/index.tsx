import { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { useFormDefaults } from "@/hooks/useFormDefaults";
import {
  X,
  Save,
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
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { TabBar } from "@/components/shared/TabBar";
import type { TabItem } from "@/components/shared/TabBar";
import type { TabId, Subject, Evidence, MediaFile, CaseFormData } from "./types";
import { INITIAL_FORM_DATA } from "./types";
import { buildCreateCasePayload } from "./buildCreateCasePayload";
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
} from "./tabs";
import { SubjectModal, EvidenceModal } from "./modals";

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

  const [formData, setFormData] = useState<CaseFormData>(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showDraftBanner, setShowDraftBanner] = useState(false);

  const defaults = useFormDefaults();

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

  // PR 3 v0.38.2.0 — URL param hydration cho entry path 2 (button "Khởi tố thành vụ án"
  // từ IncidentDetailPage navigate /cases/new?linkedIncidentId=X&caseProvenance=FROM_INCIDENT).
  // CaseFormPage tự pre-fill state, tab Vụ việc sẽ render LinkedIncidentCard (PR 2).
  useEffect(() => {
    if (isEditMode) return;
    const linkedIncidentId = searchParams.get("linkedIncidentId");
    const urlCaseProvenance = searchParams.get("caseProvenance");
    // HOTFIX (codex P1): hydrate expectedIncidentUpdatedAt từ URL — backend require
    // khi caseProvenance=FROM_INCIDENT, nếu thiếu sẽ 400 BadRequest.
    const urlExpectedIncidentUpdatedAt = searchParams.get("expectedIncidentUpdatedAt");
    if (linkedIncidentId && urlCaseProvenance) {
      setFormData((prev) => ({
        ...prev,
        linkedIncidentId,
        caseProvenance: urlCaseProvenance,
        ...(urlExpectedIncidentUpdatedAt
          ? { expectedIncidentUpdatedAt: urlExpectedIncidentUpdatedAt }
          : {}),
      }));
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
    if (!formData.caseCode.trim()) newErrors.caseCode = "Vui lòng nhập mã hồ sơ";
    if (!formData.receiveDate) newErrors.receiveDate = "Vui lòng chọn ngày tiếp nhận";
    if (formData.receiveDate && new Date(formData.receiveDate) > new Date()) {
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
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ─── Handlers ──────────────────────────────────────────────────────────

  // PR 3 v0.38.2.0: handleSave splits into 2 phases:
  // 1. handleSave → validate + show Pre-save Summary Modal (NEW gate)
  // 2. handleConfirmSave → actual POST after user confirms
  const handleSave = async () => {
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
      if (isEditMode) {
        await api.put(`/cases/${id}`, { ...payload, expectedUpdatedAt: recordUpdatedAt ?? undefined });
      } else {
        await api.post("/cases", payload);
      }
      localStorage.removeItem('caseFormDraft');
      setShowPreSaveSummary(false);
      alert(isEditMode ? "Cập nhật hồ sơ thành công!" : "Lưu hồ sơ thành công!");
      navigate("/cases");
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        alert("Hồ sơ đã được chỉnh sửa bởi người dùng khác.\nVui lòng tải lại trang để xem phiên bản mới nhất trước khi chỉnh sửa.");
        return;
      }
      console.error("[CaseFormPage] Save error:", err);
      alert("Lưu hồ sơ thất bại. Vui lòng thử lại.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveDraft = () => {
    localStorage.setItem('caseFormDraft', JSON.stringify(formData));
    setShowDraftBanner(false);
  };

  const handleCancel = () => {
    if (confirm("Bạn có chắc muốn hủy? Các thay đổi sẽ không được lưu.")) {
      navigate("/cases");
    }
  };

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
      uploadDate: new Date().toLocaleString("vi-VN"),
      uploader: "Nguyễn Văn A",
      recordDate: defaults.today,
    };
    setMediaFiles([...mediaFiles, newFile]);
  };

  // ─── Shared tab props ──────────────────────────────────────────────────

  const tabProps = { formData, setFormData, errors, setErrors, handlerOptions, handlerLoading };

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
      {/* Header */}
      <PageHeader
        title={isEditMode ? "Chỉnh sửa vụ án" : "Khởi tố vụ án mới"}
        subtitle={isEditMode ? "Cập nhật thông tin vụ án" : "Nhập đầy đủ thông tin vụ án — chọn Nguồn vụ án (BLTTHS Đ.143) trước"}
        actions={
          <>
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
            <button
              onClick={handleSave}
              className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              data-testid="btn-save"
            >
              <Save className="w-4 h-4 inline mr-2" />
              Lưu hồ sơ
            </button>
          </>
        }
      />

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
      <TabBar tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto">
          {activeTab === "info" && <TabInfo {...tabProps} />}
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
    </div>
  );
}

export default CaseFormPage;
