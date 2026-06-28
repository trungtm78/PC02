// PR2 — Cho phép ĐÍNH FILE khi TẠO MỚI đơn thư (stage-then-upload).
// Tài liệu cần petitionId (đơn phải tồn tại) → ở create mode ta STAGE file vào state tạm;
// sau khi Lưu (đơn được tạo, có id) PetitionFormPage gọi uploadAll(id) → POST /documents tuần tự.
// KHÔNG sửa EntityDocumentsTab shared (case/incident dùng chung) — tránh hồi quy.
// Upload-fail một phần: GIỮ lại file lỗi trong queue + nút "Thử lại" (không mất staged file).

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Upload, X, FileText, RotateCcw } from "lucide-react";
import { api } from "@/lib/api";
import { extractApiError } from "@/lib/api-errors";
import { Card, CardHeader } from "@/components/shared";
import { useCatalog } from "@/hooks/useCatalog";

export interface PetitionStageHandle {
  /** Có file đang chờ upload không. */
  hasStaged: () => boolean;
  /** Upload toàn bộ file đã stage vào đơn thư id. Giữ lại file lỗi trong queue để retry. */
  uploadAll: (petitionId: string) => Promise<{ uploaded: number; failed: string[] }>;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export const PetitionCreateDocumentsStage = forwardRef<PetitionStageHandle>(function PetitionCreateDocumentsStage(_props, ref) {
  const { options: docTypeOptions } = useCatalog("DOCUMENT_TYPE");
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState("VAN_BAN");
  const [description, setDescription] = useState("");
  const [queued, setQueued] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [error, setError] = useState("");
  const [hasFailure, setHasFailure] = useState(false);
  const lastIdRef = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Khoá upload ĐỒNG BỘ — chặn retry() và uploadAll() chạy song song trên cùng queue → POST trùng (Codex PR2).
  const uploadingRef = useRef(false);

  const addFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (uploadingRef.current) return; // đang upload → không thêm (tránh mất file khi setQueued ghi đè)
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setQueued((prev) => {
      const seen = new Set(prev.map((f) => f.name + f.size));
      return [...prev, ...Array.from(files).filter((f) => !seen.has(f.name + f.size))];
    });
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeAt = (idx: number) => setQueued((prev) => prev.filter((_, i) => i !== idx));

  // Upload tuần tự; trả về danh sách lỗi + GIỮ file lỗi trong queue (file ok bị loại khỏi queue).
  const doUpload = async (petitionId: string, files: File[]): Promise<{ uploaded: number; failed: string[] }> => {
    if (files.length === 0) return { uploaded: 0, failed: [] };
    if (uploadingRef.current) return { uploaded: 0, failed: [] }; // đang upload → bỏ qua call trùng
    uploadingRef.current = true;
    lastIdRef.current = petitionId;
    setUploading(true);
    setError("");
    const failedNames: string[] = [];
    const remaining: File[] = [];
    for (let i = 0; i < files.length; i++) {
      setProgress({ current: i + 1, total: files.length });
      const file = files[i];
      const baseTitle = title.trim() || file.name;
      const fileTitle = files.length === 1 ? baseTitle : `${baseTitle} (${i + 1})`;
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("title", fileTitle);
        fd.append("documentType", docType);
        fd.append("petitionId", petitionId);
        if (description) fd.append("description", description);
        await api.post("/documents", fd, { headers: { "Content-Type": "multipart/form-data" } });
      } catch (e: unknown) {
        failedNames.push(`${file.name}: ${extractApiError(e, "Upload thất bại").message}`);
        remaining.push(file);
      }
    }
    uploadingRef.current = false;
    setUploading(false);
    setProgress(null);
    // Chỉ thay những file vừa upload: giữ file mới (nếu có) thêm trong lúc upload không bị mất.
    setQueued((prev) => [...remaining, ...prev.filter((p) => !files.includes(p))]);
    setHasFailure(failedNames.length > 0);
    if (failedNames.length > 0) {
      setError(`${failedNames.length}/${files.length} file lỗi — bấm "Thử lại" để upload lại file còn lại.`);
    }
    return { uploaded: files.length - remaining.length, failed: failedNames };
  };

  useImperativeHandle(
    ref,
    () => ({
      hasStaged: () => queued.length > 0,
      uploadAll: (petitionId: string) => doUpload(petitionId, queued),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queued, title, docType, description],
  );

  const retry = () => {
    if (lastIdRef.current) void doUpload(lastIdRef.current, queued);
  };

  return (
    <Card data-testid="petition-create-documents-stage">
      <CardHeader title="Tài liệu đính kèm" />
      <p className="text-xs text-amber-600 mb-3" data-testid="stage-hint">
        Chọn file ngay khi tạo mới — hệ thống sẽ tự tải lên sau khi bấm Lưu đơn thư.
      </p>

      <div className="mb-4 p-4 border border-blue-200 bg-blue-50 rounded-lg space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Tiêu đề (mặc định = tên file)</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
              data-testid="stage-title"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="VD: Đơn tố cáo bản gốc"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Loại tài liệu</label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              data-testid="stage-doctype"
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
              data-testid="stage-description"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ghi chú về tài liệu..."
            />
          </div>
        </div>
        <label className={`inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded text-sm text-slate-700 transition-colors ${uploading ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-slate-50"}`}>
          <Upload className="w-3.5 h-3.5" />
          Chọn file
          <input
            ref={fileRef}
            type="file"
            multiple
            disabled={uploading}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.mp4,.mp3,.txt"
            className="hidden"
            data-testid="stage-file-input"
            onChange={addFiles}
          />
        </label>
        <p className="text-xs text-slate-400">Hỗ trợ: PDF, Word, Excel, Hình ảnh, Video, Audio — tối đa 10MB/file</p>

        {queued.length > 0 && (
          <ul className="space-y-1" data-testid="stage-queued-list">
            {queued.map((f, i) => (
              <li key={f.name + i} className="flex items-center justify-between text-xs text-slate-700 bg-white px-2 py-1 rounded border border-slate-200">
                <span className="truncate max-w-[260px]">{f.name}</span>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  <span className="text-slate-400">{formatBytes(f.size)}</span>
                  <button type="button" onClick={() => removeAt(i)} disabled={uploading} className="text-slate-400 hover:text-red-500 transition-colors" title="Xóa khỏi danh sách">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {progress && (
          <p className="text-xs text-blue-600" data-testid="stage-progress">Đang tải ({progress.current}/{progress.total})...</p>
        )}
        {error && <p className="text-sm text-red-600" data-testid="stage-error">{error}</p>}
        {hasFailure && queued.length > 0 && !uploading && (
          <button type="button" onClick={retry} data-testid="stage-retry" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700">
            <RotateCcw className="w-3.5 h-3.5" />
            Thử lại tải lên
          </button>
        )}
      </div>

      {queued.length === 0 && !hasFailure && (
        <div className="py-8 text-center border-2 border-dashed border-slate-200 rounded-lg">
          <FileText className="w-9 h-9 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500 text-sm">Chưa chọn file nào</p>
        </div>
      )}
    </Card>
  );
});
