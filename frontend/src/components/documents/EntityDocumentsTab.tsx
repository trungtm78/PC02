// Generic document upload/list tab — dùng cho Cases / Incidents / Petitions.
// Extracted từ CaseFormPage/tabs.tsx TabBusinessFiles (v0.52, Cycle 7).
// Parameterize entity key (caseId / incidentId / petitionId) + copy theo kind.

import { useState, useEffect, useRef } from "react";
import { FileText, Plus, Eye, Download, Upload, Trash2, FolderOpen, X } from "lucide-react";
import { api } from "@/lib/api";
import { extractApiError } from "@/lib/api-errors";
import { formatVNDate } from "@/lib/dates";
import { Card, CardHeader } from "@/components/shared";
import { useCatalog } from "@/hooks/useCatalog";

export type EntityKind = "case" | "incident" | "petition";

// Loại tài liệu (DOCUMENT_TYPE) nay là danh mục ĐỘNG — options + nhãn lấy từ Catalog Registry
// qua useCatalog (không hardcode). Xem migration 20260627000001_document_type_to_dynamic.

const ENTITY_COPY: Record<EntityKind, {
  idKey: "caseId" | "incidentId" | "petitionId";
  cardTitle: string;
  guardMessage: string;
  testId: string;
}> = {
  case: {
    idKey: "caseId",
    cardTitle: "Hồ sơ nghiệp vụ",
    guardMessage: "Lưu hồ sơ trước để tải lên tài liệu",
    testId: "entity-documents-case",
  },
  incident: {
    idKey: "incidentId",
    cardTitle: "Tài liệu vụ việc",
    guardMessage: "Lưu vụ việc trước để tải lên tài liệu",
    testId: "entity-documents-incident",
  },
  petition: {
    idKey: "petitionId",
    cardTitle: "Tài liệu đơn thư",
    guardMessage: "Lưu đơn trước để tải lên tài liệu",
    testId: "entity-documents-petition",
  },
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function EntityDocumentsTab({
  entityKind,
  entityId,
}: {
  entityKind: EntityKind;
  entityId?: string;
}) {
  const copy = ENTITY_COPY[entityKind];
  // Danh mục ĐỘNG: loại tài liệu lấy từ Catalog Registry (DOCUMENT_TYPE → Directory, admin thêm runtime).
  const { options: docTypeOptions } = useCatalog("DOCUMENT_TYPE");
  const docTypeLabel = Object.fromEntries(docTypeOptions.map((o) => [o.code, o.label]));
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState("VAN_BAN");
  const [description, setDescription] = useState("");
  const [queuedFiles, setQueuedFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);

  const fetchDocs = async () => {
    if (!entityId) return;
    setLoading(true);
    try {
      const res = await api.get(`/documents?${copy.idKey}=${entityId}&limit=100`);
      setDocs(res.data.data ?? []);
    } catch {
      setDocs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId, entityKind]);

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setQueuedFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name + f.size));
      const incoming = Array.from(files).filter((f) => !existing.has(f.name + f.size));
      return [...prev, ...incoming];
    });
  };

  const removeQueuedFile = (idx: number) => {
    setQueuedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpload = async () => {
    if (!title.trim()) {
      setError("Vui lòng nhập tiêu đề tài liệu");
      return;
    }
    const filesToUpload = queuedFiles.length > 0
      ? queuedFiles
      : fileRef.current?.files
        ? Array.from(fileRef.current.files)
        : [];
    if (filesToUpload.length === 0) {
      setError("Vui lòng chọn file");
      return;
    }
    if (!entityId) {
      setError(copy.guardMessage);
      return;
    }
    setError("");
    setUploading(true);
    const failed: string[] = [];
    for (let i = 0; i < filesToUpload.length; i++) {
      setUploadProgress({ current: i + 1, total: filesToUpload.length });
      const file = filesToUpload[i];
      const fileTitle = filesToUpload.length === 1 ? title : `${title} (${i + 1})`;
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("title", fileTitle);
        fd.append("documentType", docType);
        fd.append(copy.idKey, entityId);
        if (description) fd.append("description", description);
        await api.post("/documents", fd, { headers: { "Content-Type": "multipart/form-data" } });
      } catch (e: unknown) {
        failed.push(`${file.name}: ${extractApiError(e, "Upload thất bại").message}`);
      }
    }
    setUploading(false);
    setUploadProgress(null);
    setQueuedFiles([]);
    if (fileRef.current) fileRef.current.value = "";
    if (folderRef.current) folderRef.current.value = "";
    if (failed.length === filesToUpload.length) {
      setError(failed[0]);
    } else {
      setTitle("");
      setDocType("VAN_BAN");
      setDescription("");
      setShowForm(false);
      if (failed.length > 0) setError(`${failed.length} file thất bại: ${failed[0]}`);
      await fetchDocs();
    }
  };

  const handleOpen = async (doc: any) => {
    try {
      const res = await api.get(`/documents/${doc.id}/download`, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data], { type: doc.mimeType ?? res.data.type }));
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      alert("Không thể mở tài liệu");
    }
  };

  const handleDownload = async (doc: any) => {
    try {
      const res = await api.get(`/documents/${doc.id}/download`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.originalName ?? doc.title;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Tải xuống thất bại");
    }
  };

  const handleDelete = async (doc: any) => {
    if (!confirm(`Xóa tài liệu "${doc.title}"?`)) return;
    try {
      await api.delete(`/documents/${doc.id}`);
      await fetchDocs();
    } catch {
      alert("Xóa thất bại");
    }
  };

  return (
    <Card data-testid={copy.testId}>
      <CardHeader
        title={copy.cardTitle}
        actions={
          entityId ? (
            <button
              type="button"
              onClick={() => {
                setShowForm((v) => {
                  if (v) {
                    setQueuedFiles([]);
                    setTitle("");
                    setDocType("VAN_BAN");
                    setDescription("");
                    if (fileRef.current) fileRef.current.value = "";
                    if (folderRef.current) folderRef.current.value = "";
                  }
                  return !v;
                });
                setError("");
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Tải lên tài liệu
            </button>
          ) : undefined
        }
      />

      {showForm && (
        <div className="mb-5 p-4 border border-blue-200 bg-blue-50 rounded-lg space-y-3">
          <p className="text-sm font-semibold text-blue-800">Thêm tài liệu mới</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Tiêu đề <span className="text-red-500">*</span>
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="VD: Biên bản khám nghiệm hiện trường"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Loại tài liệu</label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {docTypeOptions.map((o) => (
                  <option key={o.code} value={o.code}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">Mô tả (tùy chọn)</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ghi chú về tài liệu..."
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                File <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <label className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  Chọn file
                  <input
                    ref={fileRef}
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.mp4,.mp3,.txt"
                    className="hidden"
                    onChange={handleFilesChange}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => folderRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  Chọn thư mục
                </button>
                <input
                  ref={folderRef}
                  type="file"
                  // @ts-expect-error webkitdirectory not in React types
                  webkitdirectory="true"
                  multiple
                  className="hidden"
                  onChange={handleFilesChange}
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Hỗ trợ: PDF, Word, Excel, Hình ảnh, Video, Audio — tối đa 10MB/file
              </p>
              {queuedFiles.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {queuedFiles.map((f, i) => (
                    <li key={f.name + i} className="flex items-center justify-between text-xs text-slate-700 bg-slate-50 px-2 py-1 rounded border border-slate-200">
                      <span className="truncate max-w-[260px]">{f.name}</span>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <span className="text-slate-400">{formatBytes(f.size)}</span>
                        <button
                          type="button"
                          onClick={() => removeQueuedFile(i)}
                          className="text-slate-400 hover:text-red-500 transition-colors"
                          title="Xóa khỏi danh sách"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setError("");
                setQueuedFiles([]);
                setTitle("");
                setDocType("VAN_BAN");
                setDescription("");
                if (fileRef.current) fileRef.current.value = "";
                if (folderRef.current) folderRef.current.value = "";
              }}
              className="px-3 py-1.5 border border-slate-300 text-slate-600 rounded-lg text-sm hover:bg-slate-50"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
            >
              <Upload className="w-3.5 h-3.5" />
              {uploading && uploadProgress
                ? `Đang tải (${uploadProgress.current}/${uploadProgress.total})...`
                : uploading ? "Đang tải..." : "Tải lên"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-500" />
        </div>
      ) : docs.length === 0 ? (
        <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-lg">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500 text-sm">Chưa có tài liệu nào</p>
          {!entityId && <p className="text-xs text-amber-600 mt-1">{copy.guardMessage}</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between p-3.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-slate-800 text-sm truncate">{doc.title}</p>
                  <p className="text-xs text-slate-500">
                    {docTypeLabel[doc.documentType] ?? doc.documentType}
                    {doc.size ? ` · ${formatBytes(doc.size)}` : ""}
                    {doc.createdAt ? ` · ${formatVNDate(doc.createdAt)}` : ""}
                  </p>
                  {doc.description && <p className="text-xs text-slate-400 truncate">{doc.description}</p>}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0 ml-3">
                <button
                  type="button"
                  onClick={() => handleOpen(doc)}
                  className="p-1.5 text-slate-600 hover:bg-slate-100 rounded transition-colors"
                  title="Mở tài liệu"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDownload(doc)}
                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  title="Tải xuống"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(doc)}
                  className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"
                  title="Xóa"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
