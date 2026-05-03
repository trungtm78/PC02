/**
 * DocumentsPage — Quản lý Hồ sơ & Tài liệu
 * TASK-2026-022601
 *
 * Features:
 * - List documents with search and pagination
 * - Upload documents with file validation (max 10MB)
 * - Link documents to Case or Incident via FKSelection
 * - Download documents
 * - Soft delete documents
 */

import { useState, useCallback, useRef } from "react";
import { api } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Plus,
  FileText,
  Trash2,
  X,
  AlertTriangle,
  Loader2,
  Download,
  File,
  Image,
  Video,
  Music,
  ChevronLeft,
  ChevronRight,
  Upload,
  FileUp,
  FolderOpen,
} from "lucide-react";
import { FKSelection } from "@/components/FKSelection";
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

interface Document {
  id: string;
  title: string;
  description?: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  filePath: string;
  documentType: 'VAN_BAN' | 'HINH_ANH' | 'VIDEO' | 'AM_THANH' | 'KHAC';
  caseId?: string;
  incidentId?: string;
  uploadedById: string;
  createdAt: string;
  updatedAt: string;
  case?: { id: string; name: string };
  incident?: { id: string; name: string };
  uploadedBy?: { id: string; firstName: string; lastName: string; username: string };
}

interface DocumentListResponse {
  success: boolean;
  data: Document[];
  total: number;
  page: number;
  pageSize: number;
}

interface CaseItem {
  id: string;
  name: string;
}

interface IncidentItem {
  id: string;
  name: string;
}

interface FKOption {
  value: string;
  label: string;
}

interface DocumentFormData {
  title: string;
  description: string;
  documentType: 'VAN_BAN' | 'HINH_ANH' | 'VIDEO' | 'AM_THANH' | 'KHAC';
  caseId: string;
  incidentId: string;
}

interface DocumentFormErrors {
  title?: string;
  file?: string;
  caseId?: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const DOCUMENT_TYPE_OPTIONS: { value: Document['documentType']; label: string }[] = [
  { value: 'VAN_BAN', label: 'Văn bản' },
  { value: 'HINH_ANH', label: 'Hình ảnh' },
  { value: 'VIDEO', label: 'Video' },
  { value: 'AM_THANH', label: 'Âm thanh' },
  { value: 'KHAC', label: 'Khác' },
];

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/gif',
  'video/mp4',
  'audio/mpeg',
  'text/plain',
];

// ─── API helpers ─────────────────────────────────────────────────────────────

function getAuthHeaders(): Record<string, string> {
  const token = sessionStorage.getItem("accessToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}


// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return Image;
  if (mimeType.startsWith('video/')) return Video;
  if (mimeType.startsWith('audio/')) return Music;
  return FileText;
}

function getDocumentTypeLabel(type: Document['documentType']): string {
  const found = DOCUMENT_TYPE_OPTIONS.find(o => o.value === type);
  return found?.label ?? type;
}

// ─── Form validation ─────────────────────────────────────────────────────────

function validateForm(data: DocumentFormData, file: File | null): DocumentFormErrors {
  const errors: DocumentFormErrors = {};
  if (!data.title.trim()) errors.title = "Tiêu đề không được để trống";
  if (!file) errors.file = "Vui lòng chọn file để upload";
  return errors;
}

const EMPTY_FORM: DocumentFormData = {
  title: "",
  description: "",
  documentType: "VAN_BAN",
  caseId: "",
  incidentId: "",
};

// ─── DocumentForm modal ──────────────────────────────────────────────────────

interface DocumentFormProps {
  onSave: (formData: DocumentFormData, file: File) => Promise<void>;
  onClose: () => void;
  isSaving: boolean;
  serverError?: string;
  caseOptions: FKOption[];
  incidentOptions: FKOption[];
  loadingOptions: boolean;
}

function DocumentForm({
  onSave,
  onClose,
  isSaving,
  serverError,
  caseOptions,
  incidentOptions,
  loadingOptions,
}: DocumentFormProps) {
  const [form, setForm] = useState<DocumentFormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<DocumentFormErrors>({});
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const setField = useCallback(
    <K extends keyof DocumentFormData>(key: K, value: DocumentFormData[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    },
    []
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    setFileError(null);

    if (!selectedFile) {
      setFile(null);
      return;
    }

    // Validate file size
    if (selectedFile.size > MAX_FILE_SIZE) {
      setFileError(`File quá lớn. Kích thước tối đa là ${formatFileSize(MAX_FILE_SIZE)}`);
      setFile(null);
      return;
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(selectedFile.type)) {
      setFileError('Loại file không được hỗ trợ. Vui lòng chọn file PDF, Word, Excel, hình ảnh, video, hoặc âm thanh.');
      setFile(null);
      return;
    }

    setFile(selectedFile);
    // Auto-fill title from filename if empty
    if (!form.title) {
      const fileNameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, "");
      setForm(prev => ({ ...prev, title: fileNameWithoutExt }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validateForm(form, file);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    if (file) {
      await onSave(form, file);
    }
  };

  const renderFileIcon = () => {
    const IconComponent = file ? getFileIcon(file.type) : FileUp;
    return <IconComponent className={`w-10 h-10 ${file ? 'text-blue-600' : 'text-slate-400'}`} />;
  };

  return (
    <div className={MODAL_OVERLAY} role="dialog" aria-modal="true" data-testid="document-upload-modal">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className={MODAL_HEADER}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Upload className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800" data-testid="modal-title">
                Upload tài liệu mới
              </h2>
              <p className="text-xs text-slate-500">
                Chọn file và liên kết với Vụ án hoặc Vụ việc
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Đóng"
            data-testid="btn-close-upload-modal"
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
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm" data-testid="upload-error-message">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {serverError}
            </div>
          )}

          {/* File Upload Area */}
          <div>
            <label className={LABEL_BASE}>
              Chọn file <span className="text-red-500">*</span>
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-6 cursor-pointer transition-colors ${fileError ? 'border-red-300 bg-red-50' : 'border-slate-300 hover:border-blue-400 bg-slate-50'
                }`}
              data-testid="file-drop-zone"
            >
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                className="hidden"
                data-testid="file-input"
              />
              <div className="flex flex-col items-center gap-2">
                {renderFileIcon()}
                {file ? (
                  <div className="text-center">
                    <p className="text-sm font-medium text-slate-800">{file.name}</p>
                    <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-slate-600">Click để chọn file hoặc kéo thả vào đây</p>
                    <p className="text-xs text-slate-400">Hỗ trợ: PDF, Word, Excel, Hình ảnh, Video, Âm thanh (Tối đa 10MB)</p>
                  </>
                )}
              </div>
            </div>
            {fileError && (
              <p className={FIELD_ERROR_TEXT} data-testid="file-error">{fileError}</p>
            )}
            {errors.file && (
              <p className={FIELD_ERROR_TEXT}>{errors.file}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Tiêu đề */}
            <div className="md:col-span-2">
              <label className={LABEL_BASE}>
                Tiêu đề tài liệu <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setField("title", e.target.value)}
                className={getInputClass(!!errors.title)}
                placeholder="Nhập tiêu đề tài liệu"
                data-testid="document-title-input"
              />
              {errors.title && (
                <p className={FIELD_ERROR_TEXT}>{errors.title}</p>
              )}
            </div>

            {/* Loại tài liệu */}
            <div>
              <label className={LABEL_BASE}>Loại tài liệu</label>
              <select
                value={form.documentType}
                onChange={(e) => setField("documentType", e.target.value as Document['documentType'])}
                className={INPUT_BASE}
                data-testid="document-type-select"
              >
                {DOCUMENT_TYPE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Vụ án — FKSelection */}
            <div>
              <FKSelection
                label="Liên kết Vụ án"
                value={form.caseId}
                onChange={(v) => setField("caseId", v)}
                options={caseOptions}
                placeholder="Chọn vụ án (tuỳ chọn)"
                resource="cases"
                loading={loadingOptions}
                testId="document-case-select"
              />
            </div>

            {/* Vụ việc — FKSelection */}
            <div>
              <FKSelection
                label="Liên kết Vụ việc"
                value={form.incidentId}
                onChange={(v) => setField("incidentId", v)}
                options={incidentOptions}
                placeholder="Chọn vụ việc (tuỳ chọn)"
                resource="incidents"
                loading={loadingOptions}
                testId="document-incident-select"
              />
            </div>

            {/* Mô tả */}
            <div className="md:col-span-2">
              <label className={LABEL_BASE}>Mô tả</label>
              <textarea
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                className={`${INPUT_BASE} min-h-[80px] resize-none`}
                placeholder="Mô tả nội dung tài liệu (tuỳ chọn)"
                rows={3}
                data-testid="document-description-input"
              />
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className={MODAL_FOOTER}>
          <button onClick={onClose} className={BTN_SECONDARY} disabled={isSaving} data-testid="btn-cancel-upload">
            Hủy
          </button>
          <button
            onClick={handleSubmit as unknown as React.MouseEventHandler<HTMLButtonElement>}
            className={`${BTN_PRIMARY} flex items-center gap-2`}
            disabled={isSaving || !file}
            data-testid="btn-submit-upload"
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            <Upload className="w-4 h-4" />
            Upload tài liệu
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showUpload, setShowUpload] = useState(false);
  const [deleteDocument, setDeleteDocument] = useState<Document | null>(null);
  const [formError, setFormError] = useState<string | undefined>();

  // ── Fetch documents ──
  const { data, isLoading, isError } = useQuery<DocumentListResponse>({
    queryKey: ["documents", search, page],
    queryFn: () => {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String((page - 1) * PAGE_SIZE),
      });
      if (search) params.set("search", search);
      return api.get(`/documents?${params}`).then((r) => r.data);
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

  // ── Fetch incidents for FK select ──
  const { data: incidentsData, isLoading: loadingIncidents } = useQuery<{
    success: boolean;
    data: IncidentItem[];
  }>({
    queryKey: ["incidents-fk"],
    queryFn: () => api.get('/incidents?limit=100').then((r) => r.data),
    staleTime: 10 * 60 * 1000,
  });

  const loadingOptions = loadingCases || loadingIncidents;

  const caseOptions: FKOption[] =
    casesData?.data.map((c) => ({ value: c.id, label: c.name })) ?? [];
  const incidentOptions: FKOption[] =
    incidentsData?.data.map((i) => ({ value: i.id, label: i.name })) ?? [];

  const documents = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // ── Mutations ──
  const uploadMutation = useMutation({
    mutationFn: async ({ formData, file }: { formData: DocumentFormData; file: File }) => {
      const uploadFormData = new FormData();
      uploadFormData.append("file", file);
      uploadFormData.append("title", formData.title);
      uploadFormData.append("documentType", formData.documentType);
      if (formData.description) uploadFormData.append("description", formData.description);
      if (formData.caseId) uploadFormData.append("caseId", formData.caseId);
      if (formData.incidentId) uploadFormData.append("incidentId", formData.incidentId);

      const res = await fetch("/api/v1/documents", {
        method: "POST",
        headers: getAuthHeaders(),
        body: uploadFormData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message ?? `Lỗi ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      setShowUpload(false);
      setFormError(undefined);
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete(`/documents/${id}`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      setDeleteDocument(null);
    },
  });

  // ── Handlers ──
  const handleUpload = async (formData: DocumentFormData, file: File) => {
    await uploadMutation.mutateAsync({ formData, file });
  };

  const handleDownload = async (doc: Document) => {
    try {
      const res = await fetch(`/api/v1/documents/${doc.id}/download`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Download failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.originalName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      alert('Không thể tải xuống tài liệu');
    }
  };

  const isUploading = uploadMutation.isPending;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Page header ── */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <FolderOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800" data-testid="page-title">
                Hồ sơ & Tài liệu
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Quản lý tài liệu, hồ sơ liên quan đến Vụ án và Vụ việc
              </p>
            </div>
          </div>
          <button
            onClick={() => { setFormError(undefined); setShowUpload(true); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            data-testid="btn-upload-document"
          >
            <Plus className="w-4 h-4" />
            Upload tài liệu
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
              placeholder="Tìm theo tiêu đề, tên file, mô tả... (hỗ trợ tìm kiếm không dấu)"
              className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              data-testid="document-search-input"
            />
          </div>
        </div>

        {/* ── Table ── */}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="font-semibold text-slate-800">Danh sách tài liệu</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Tổng cộng {total} tài liệu
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
              Không thể tải danh sách tài liệu
            </div>
          ) : documents.length === 0 ? (
            <div className={EMPTY_STATE_WRAPPER}>
              <div className={EMPTY_STATE_ICON}>
                <File className="w-6 h-6 text-slate-400" />
              </div>
              <p className={EMPTY_STATE_TEXT}>Chưa có tài liệu nào</p>
              <p className={EMPTY_STATE_SUBTEXT}>Nhấn "Upload tài liệu" để thêm mới</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="document-list-table">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider w-24 sticky left-0 bg-slate-50 z-10 border-r border-slate-200">Thao tác</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">STT</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Tài liệu</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Loại</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Kích thước</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Vụ án</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Vụ việc</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">NgườI upload</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Ngày upload</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {documents.map((doc, idx) => {
                    const FileIcon = getFileIcon(doc.mimeType);
                    return (
                      <tr key={doc.id} className="hover:bg-slate-50 transition-colors" data-testid={`document-row-${doc.id}`}>
                        {/* Thao tác — FIRST, sticky */}
                        <td className="px-3 py-3 whitespace-nowrap sticky left-0 z-10 bg-white border-r border-slate-100">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDownload(doc)}
                              className={BTN_ICON_BLUE}
                              title="Tải xuống"
                              data-testid={`btn-download-${doc.id}`}
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteDocument(doc)}
                              className={BTN_ICON_RED}
                              title="Xóa"
                              data-testid={`btn-delete-${doc.id}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                              <FileIcon className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-800">{doc.title}</p>
                              <p className="text-xs text-slate-500">{doc.originalName}</p>
                              {doc.description && (
                                <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{doc.description}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                            {getDocumentTypeLabel(doc.documentType)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {formatFileSize(doc.size)}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {doc.case?.name ?? <span className="text-xs text-slate-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {doc.incident?.name ?? <span className="text-xs text-slate-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {doc.uploadedBy ? `${doc.uploadedBy.firstName} ${doc.uploadedBy.lastName}`.trim() || doc.uploadedBy.username : <span className="text-xs text-slate-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {new Date(doc.createdAt).toLocaleDateString('vi-VN')}
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
                Trang {page} / {totalPages} — {total} tài liệu
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

      {/* ── Upload modal ── */}
      {showUpload && (
        <DocumentForm
          onSave={handleUpload}
          onClose={() => { setShowUpload(false); setFormError(undefined); }}
          isSaving={isUploading}
          serverError={formError}
          caseOptions={caseOptions}
          incidentOptions={incidentOptions}
          loadingOptions={loadingOptions}
        />
      )}

      {/* ── Delete confirm modal ── */}
      {deleteDocument && (
        <div className={MODAL_OVERLAY} role="dialog" data-testid="delete-confirm-modal">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Xác nhận xóa tài liệu</h3>
                <p className="text-sm text-slate-600 mt-1">
                  Bạn có chắc muốn xóa tài liệu{" "}
                  <strong className="text-slate-800">{deleteDocument.title}</strong>?
                  Hành động này không thể hoàn tác.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setDeleteDocument(null)}
                className={BTN_SECONDARY}
                disabled={deleteMutation.isPending}
                data-testid="btn-cancel-delete"
              >
                Hủy
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteDocument.id)}
                className={`${BTN_DANGER} flex items-center gap-2`}
                disabled={deleteMutation.isPending}
                data-testid="btn-confirm-delete"
              >
                {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Xóa tài liệu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
