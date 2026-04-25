import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/lib/api";
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
  const isEditMode = !!id;

  const [activeTab, setActiveTab] = useState<TabId>("info");
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [showEvidenceModal, setShowEvidenceModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [editingEvidence, setEditingEvidence] = useState<Evidence | null>(null);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);

  const [formData, setFormData] = useState<CaseFormData>(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
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
        // metadata chứa toàn bộ fields phụ của form được lưu khi tạo/cập nhật
        const meta = (d.metadata ?? {}) as Record<string, string>;
        setFormData((prev) => ({
          ...prev,
          // ── Fields core lưu trực tiếp trong DB ──────────────────────────
          caseTitle:             d.name                ?? prev.caseTitle,
          criminalType:          d.crime               ?? prev.criminalType,
          status:                d.status              ?? prev.status,
          investigationDeadline: d.deadline
                                   ? new Date(d.deadline).toISOString().split("T")[0]
                                   : prev.investigationDeadline,
          supervisingUnit:       d.unit                ?? prev.supervisingUnit,
          handler:               d.investigatorId      ?? d.investigator?.id ?? prev.handler,
          // ── Fields phụ từ metadata JSONB ────────────────────────────────
          caseCode:                    meta.caseCode                    ?? prev.caseCode,
          receiveDate:                 meta.receiveDate                 ?? prev.receiveDate,
          receiveTime:                 meta.receiveTime                 ?? prev.receiveTime,
          caseType:                    meta.caseType                    ?? prev.caseType,
          caseClassification:          meta.caseClassification          ?? prev.caseClassification,
          capDoToiPham:                (d.capDoToiPham as string)        ?? prev.capDoToiPham,
          priority:                    meta.priority                    ?? prev.priority,
          description:                 meta.description                 ?? prev.description,
          investigationStartDate:      meta.investigationStartDate      ?? prev.investigationStartDate,
          prosecutionOfficeAssigned:   meta.prosecutionOfficeAssigned   ?? prev.prosecutionOfficeAssigned,
          relatedCaseCode:             meta.relatedCaseCode             ?? prev.relatedCaseCode,
          damageAmount:                meta.damageAmount                ?? prev.damageAmount,
          damageDescription:           meta.damageDescription           ?? prev.damageDescription,
          note:                        meta.note                        ?? prev.note,
          reporter:                    meta.reporter                    ?? prev.reporter,
          reporterIdNumber:            meta.reporterIdNumber            ?? prev.reporterIdNumber,
          reporterDateOfBirth:         meta.reporterDateOfBirth         ?? prev.reporterDateOfBirth,
          reporterGender:              meta.reporterGender              ?? prev.reporterGender,
          reporterPhone:               meta.reporterPhone               ?? prev.reporterPhone,
          reporterEmail:               meta.reporterEmail               ?? prev.reporterEmail,
          reporterAddress:             meta.reporterAddress             ?? prev.reporterAddress,
          reporterNationality:         meta.reporterNationality         ?? prev.reporterNationality,
          reporterOccupation:          meta.reporterOccupation          ?? prev.reporterOccupation,
          reporterRelationToCase:      meta.reporterRelationToCase      ?? prev.reporterRelationToCase,
          province:                    meta.province                    ?? prev.province,
          district:                    meta.district                    ?? prev.district,
          ward:                        meta.ward                        ?? prev.ward,
          specificAddress:             meta.specificAddress             ?? prev.specificAddress,
        }));
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
    if (!formData.caseType) newErrors.caseType = "Vui lòng chọn loại hồ sơ";
    if (!formData.caseTitle.trim()) newErrors.caseTitle = "Vui lòng nhập tiêu đề hồ sơ";
    if (!formData.handler) newErrors.handler = "Vui lòng chọn điều tra viên";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ─── Handlers ──────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!validateForm()) {
      alert("Vui lòng kiểm tra các trường bắt buộc!");
      return;
    }
    try {
      const payload = {
        name:           formData.caseTitle,
        crime:          formData.criminalType         || null,
        status:         formData.status               || undefined,
        deadline:       formData.investigationDeadline || null,
        unit:           formData.supervisingUnit       || null,
        investigatorId: formData.handler               || null,
        capDoToiPham:   formData.capDoToiPham          || undefined,
        // metadata chứa toàn bộ fields phụ không có column riêng trong DB
        metadata: {
          caseCode:                  formData.caseCode,
          receiveDate:               formData.receiveDate,
          receiveTime:               formData.receiveTime,
          caseType:                  formData.caseType,
          caseClassification:        formData.caseClassification,
          priority:                  formData.priority,
          description:               formData.description,
          investigationStartDate:    formData.investigationStartDate,
          prosecutionOfficeAssigned: formData.prosecutionOfficeAssigned,
          relatedCaseCode:           formData.relatedCaseCode,
          damageAmount:              formData.damageAmount,
          damageDescription:         formData.damageDescription,
          note:                      formData.note,
          petitionType:              formData.petitionType,
          reporter:                  formData.reporter,
          reporterIdNumber:          formData.reporterIdNumber,
          reporterDateOfBirth:       formData.reporterDateOfBirth,
          reporterGender:            formData.reporterGender,
          reporterPhone:             formData.reporterPhone,
          reporterEmail:             formData.reporterEmail,
          reporterAddress:           formData.reporterAddress,
          reporterNationality:       formData.reporterNationality,
          reporterOccupation:        formData.reporterOccupation,
          reporterRelationToCase:    formData.reporterRelationToCase,
          province:                  formData.province,
          district:                  formData.district,
          ward:                      formData.ward,
          specificAddress:           formData.specificAddress,
        },
      };
      if (isEditMode) {
        await api.put(`/cases/${id}`, { ...payload, expectedUpdatedAt: recordUpdatedAt ?? undefined });
      } else {
        await api.post("/cases", payload);
      }
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
    }
  };

  const handleSaveDraft = () => {
    console.log("[CaseFormPage] Lưu nháp:", formData);
    alert("Đã lưu nháp thành công!");
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
      recordDate: new Date().toISOString().split("T")[0],
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
      {/* Header */}
      <PageHeader
        title={isEditMode ? "Chỉnh sửa hồ sơ" : "Thêm mới hồ sơ"}
        subtitle={isEditMode ? "Cập nhật thông tin hồ sơ vụ án / vụ việc" : "Nhập đầy đủ thông tin hồ sơ vụ án / vụ việc"}
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
    </div>
  );
}

export default CaseFormPage;
