import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Upload,
  X,
  AlertCircle,
  CheckCircle,
  Loader2,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import {
  adminBulkApi,
  type BulkImportPreviewResult,
  type BulkImportPreviewRow,
  type BulkImportJobStatus,
} from '@/lib/api';
import { authStore } from '@/stores/auth.store';

interface Props {
  open: boolean;
  onClose: () => void;
  onComplete?: () => void;
  roles: { id: string; name: string }[];
}

type Step = 'upload' | 'preview' | 'processing' | 'result';

/**
 * Bulk user import wizard (v0.25.0.0).
 *
 * 4-step flow:
 * 1. Upload xlsx/csv → POST /admin/users/bulk-import/preview
 * 2. Preview table với inline edit + per-row validation
 * 3. Processing với progress polling (backoff + Page Visibility pause)
 * 4. Result: enriched Excel download (primary) + ZIP PDF (secondary)
 *
 * Desktop-only (≥768px) — autoplan Design S3 decision.
 */
export function BulkImportWizard({ open, onClose, onComplete, roles }: Props) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [preview, setPreview] = useState<BulkImportPreviewResult | null>(null);
  const [editedRows, setEditedRows] = useState<BulkImportPreviewRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<BulkImportJobStatus | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setStep('upload');
    setFile(null);
    setUploadError(null);
    setPreview(null);
    setEditedRows([]);
    setSubmitError(null);
    setJobId(null);
    setJobStatus(null);
  }, []);

  const handleClose = useCallback(() => {
    if (step === 'processing' && jobStatus?.status === 'processing') {
      if (!window.confirm('Job đang xử lý. Đóng modal? Job vẫn tiếp tục chạy ở server.')) return;
    }
    reset();
    onClose();
  }, [step, jobStatus, reset, onClose]);

  // Polling Step 3 — start at 2s, backoff to 8s after 1 min, pause when tab hidden
  useEffect(() => {
    if (step !== 'processing' || !jobId) return;
    let interval = 2000;
    let elapsed = 0;
    let timer: number | null = null;

    const poll = async () => {
      if (document.visibilityState === 'hidden') {
        timer = window.setTimeout(poll, 4000);
        return;
      }
      try {
        const res = await adminBulkApi.getJob(jobId);
        setJobStatus(res.data);
        if (res.data.status === 'done' || res.data.status === 'failed' || res.data.status === 'cancelled') {
          setStep('result');
          onComplete?.();
          return;
        }
        elapsed += interval;
        if (elapsed > 60000) interval = 8000;
        timer = window.setTimeout(poll, interval);
      } catch {
        timer = window.setTimeout(poll, 5000);
      }
    };
    poll();
    return () => {
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [step, jobId, onComplete]);

  if (!open) return null;

  const handleFileSelect = (f: File | null) => {
    if (!f) return;
    const lowerName = f.name.toLowerCase();
    if (!lowerName.endsWith('.xlsx') && !lowerName.endsWith('.csv')) {
      setUploadError('Chỉ chấp nhận file .xlsx hoặc .csv');
      return;
    }
    if (f.size > 2 * 1024 * 1024) {
      setUploadError('File quá lớn (>2MB). Vui lòng chia nhỏ.');
      return;
    }
    setFile(f);
    setUploadError(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFileSelect(e.dataTransfer.files?.[0] ?? null);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const res = await adminBulkApi.preview(file);
      setPreview(res.data);
      setEditedRows(res.data.rows);
      setStep('preview');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Lỗi parse file. Vui lòng kiểm tra format.';
      setUploadError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setUploading(false);
    }
  };

  const updateRow = (rowIndex: number, patch: Partial<BulkImportPreviewRow>) => {
    setEditedRows((prev) =>
      prev.map((r) => (r.rowIndex === rowIndex ? { ...r, ...patch, errors: [] } : r)),
    );
  };

  const errorRows = useMemo(() => editedRows.filter((r) => r.errors.length > 0).length, [editedRows]);
  const warningRows = useMemo(() => editedRows.filter((r) => r.warnings.length > 0).length, [editedRows]);

  const handleConfirm = async () => {
    if (!preview) return;
    if (errorRows > 0) {
      setSubmitError(`Còn ${errorRows} dòng lỗi. Vui lòng sửa hoặc xóa trước khi tiếp tục.`);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await adminBulkApi.confirm(preview.previewToken, editedRows);
      setJobId(res.data.jobId);
      setStep('processing');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Lỗi xử lý. Vui lòng thử lại.';
      setSubmitError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setSubmitting(false);
    }
  };

  const authedDownload = async (url: string) => {
    const token = authStore.getAccessToken();
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      alert('Tải file thất bại. Vui lòng thử lại.');
      return;
    }
    const blob = await res.blob();
    const dispMatch = res.headers.get('Content-Disposition')?.match(/filename="?([^";]+)"?/);
    const filename = dispMatch?.[1] ?? 'download';
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-5xl max-h-[90vh] overflow-y-auto" role="dialog" aria-modal="true">
        {/* Mobile guard per Design S3 */}
        <div className="md:hidden p-6 text-center">
          <FileSpreadsheet className="w-10 h-10 text-slate-400 mx-auto mb-3" aria-hidden="true" />
          <p className="text-sm text-slate-700 mb-2">Tính năng import yêu cầu màn hình desktop ≥768px.</p>
          <button onClick={handleClose} className="px-4 py-2 bg-[#003973] text-white rounded-lg text-sm">Đóng</button>
        </div>

        <div className="hidden md:block">
          {/* Header với steps indicator */}
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-[#003973]" aria-hidden="true" />
              <h3 className="text-base font-bold text-slate-800">Import danh sách cán bộ</h3>
              <span className="text-xs text-slate-500 ml-2">
                Bước {step === 'upload' ? 1 : step === 'preview' ? 2 : step === 'processing' ? 3 : 4}/4
              </span>
            </div>
            <button onClick={handleClose} aria-label="Đóng" className="text-slate-400 hover:text-slate-600 min-h-[44px] min-w-[44px] flex items-center justify-center">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-600">Upload file Excel (.xlsx) hoặc CSV chứa danh sách cán bộ.</p>
                <a href={adminBulkApi.templateUrl} download className="text-xs text-[#003973] underline hover:text-[#002a5c]">
                  Tải template mẫu
                </a>
              </div>

              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  dragging
                    ? 'border-[#003973] bg-blue-50'
                    : 'border-slate-300 hover:border-[#003973] hover:bg-slate-50'
                }`}
              >
                <Upload className="w-10 h-10 text-slate-400 mx-auto mb-2" aria-hidden="true" />
                {file ? (
                  <div>
                    <p className="text-sm font-medium text-slate-800">{file.name}</p>
                    <p className="text-xs text-slate-500 mt-1">{(file.size / 1024).toFixed(1)} KB · click để chọn file khác</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-slate-700">Kéo thả file vào đây hoặc click để chọn</p>
                    <p className="text-xs text-slate-500 mt-1">.xlsx hoặc .csv · tối đa 2MB · 100 dòng</p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.csv"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
                />
              </div>

              {uploadError && (
                <div role="alert" className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <p>{uploadError}</p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button onClick={handleClose} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm min-h-[44px]">Hủy</button>
                <button
                  onClick={handleUpload}
                  disabled={!file || uploading}
                  className="px-4 py-2 bg-[#003973] text-white rounded-lg hover:bg-[#002a5c] disabled:opacity-40 text-sm flex items-center gap-1.5 min-h-[44px]"
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {uploading ? 'Đang parse...' : 'Tải lên và xem trước'}
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Preview */}
          {step === 'preview' && preview && (
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 flex items-center gap-4 text-sm">
                <span><strong>{preview.totalRows}</strong> dòng</span>
                <span className="text-green-700"><strong>{preview.totalRows - errorRows}</strong> sẵn sàng</span>
                {errorRows > 0 && <span className="text-red-700"><strong>{errorRows}</strong> lỗi</span>}
                {warningRows > 0 && <span className="text-amber-700"><strong>{warningRows}</strong> cảnh báo</span>}
                <span className="text-slate-500 ml-auto">Sheet: {preview.sheetName}</span>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-[50vh] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="px-2 py-2 text-left font-medium text-slate-700">#</th>
                      <th className="px-2 py-2 text-left font-medium text-slate-700">Username</th>
                      <th className="px-2 py-2 text-left font-medium text-slate-700">Họ tên</th>
                      <th className="px-2 py-2 text-left font-medium text-slate-700">Số hiệu</th>
                      <th className="px-2 py-2 text-left font-medium text-slate-700">SĐT</th>
                      <th className="px-2 py-2 text-left font-medium text-slate-700">Email</th>
                      <th className="px-2 py-2 text-left font-medium text-slate-700">Vai trò</th>
                      <th className="px-2 py-2 text-left font-medium text-slate-700">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editedRows.map((row) => (
                      <tr key={row.rowIndex} className={row.errors.length > 0 ? 'bg-red-50' : ''}>
                        <td className="px-2 py-1.5 text-slate-500">{row.rowIndex}</td>
                        <td className="px-2 py-1.5">
                          <input
                            type="text"
                            value={row.username ?? ''}
                            onChange={(e) => updateRow(row.rowIndex, { username: e.target.value })}
                            className="w-full border border-slate-200 rounded px-1.5 py-0.5"
                          />
                        </td>
                        <td className="px-2 py-1.5">{row.fullName}</td>
                        <td className="px-2 py-1.5">
                          <input
                            type="text"
                            value={row.workId ?? ''}
                            onChange={(e) => updateRow(row.rowIndex, { workId: e.target.value || null })}
                            className="w-full border border-slate-200 rounded px-1.5 py-0.5"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="text"
                            value={row.phone ?? ''}
                            onChange={(e) => updateRow(row.rowIndex, { phone: e.target.value || null })}
                            className="w-full border border-slate-200 rounded px-1.5 py-0.5"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="email"
                            value={row.email ?? ''}
                            onChange={(e) => updateRow(row.rowIndex, { email: e.target.value || null })}
                            className="w-full border border-slate-200 rounded px-1.5 py-0.5"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <select
                            value={row.roleId ?? ''}
                            onChange={(e) => updateRow(row.rowIndex, { roleId: e.target.value })}
                            className="w-full border border-slate-200 rounded px-1.5 py-0.5"
                          >
                            <option value="">— Chọn —</option>
                            {roles.map((r) => (
                              <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          {row.errors.length > 0 && (
                            <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 rounded text-xs px-1.5 py-0.5 font-medium" title={row.errors.join('; ')}>
                              <AlertCircle className="w-3 h-3" aria-hidden="true" />
                              Lỗi ({row.errors.length})
                            </span>
                          )}
                          {row.errors.length === 0 && row.warnings.length > 0 && (
                            <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 rounded text-xs px-1.5 py-0.5 font-medium" title={row.warnings.join('; ')}>
                              <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                              Cảnh báo
                            </span>
                          )}
                          {row.errors.length === 0 && row.warnings.length === 0 && (
                            <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 rounded text-xs px-1.5 py-0.5 font-medium">
                              <CheckCircle className="w-3 h-3" aria-hidden="true" />
                              OK
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {submitError && (
                <div role="alert" className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <p>{submitError}</p>
                </div>
              )}

              <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                <button onClick={() => setStep('upload')} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm min-h-[44px]">Quay lại</button>
                <button
                  onClick={handleConfirm}
                  disabled={submitting || errorRows > 0}
                  className="px-4 py-2 bg-[#003973] text-white rounded-lg hover:bg-[#002a5c] disabled:opacity-40 text-sm flex items-center gap-1.5 min-h-[44px]"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Tạo {editedRows.length - errorRows} user{warningRows > 0 ? ` (${warningRows} cảnh báo)` : ''}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Processing */}
          {step === 'processing' && (
            <div className="p-8 text-center space-y-4">
              <Loader2 className="w-12 h-12 text-[#003973] mx-auto animate-spin" aria-hidden="true" />
              <h4 className="text-base font-semibold text-slate-800">Đang xử lý...</h4>
              {jobStatus && (
                <div className="max-w-md mx-auto">
                  <div className="bg-slate-100 rounded-full h-2 overflow-hidden" role="progressbar" aria-live="polite" aria-valuenow={jobStatus.progress} aria-valuemin={0} aria-valuemax={jobStatus.totalRows}>
                    <div className="bg-[#003973] h-full transition-all" style={{ width: `${(jobStatus.progress / jobStatus.totalRows) * 100}%` }} />
                  </div>
                  <p className="text-sm text-slate-600 mt-2">
                    {jobStatus.progress} / {jobStatus.totalRows} dòng ·
                    <span className="text-green-700 ml-1">{jobStatus.successRows} thành công</span>
                    {jobStatus.errorRows > 0 && <span className="text-red-700 ml-1">· {jobStatus.errorRows} lỗi</span>}
                  </p>
                </div>
              )}
              <p className="text-xs text-slate-500">Tạo user và gen enrollment link cho từng dòng. Đừng đóng tab.</p>
            </div>
          )}

          {/* Step 4: Result */}
          {step === 'result' && jobStatus && (
            <div className="p-6 space-y-4">
              {jobStatus.status === 'done' && jobStatus.errorRows === 0 ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2 text-sm">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <p className="text-green-900"><strong>{jobStatus.successRows} user</strong> đã tạo thành công. Link đăng ký đã được nhúng vào file Excel.</p>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2 text-sm">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <p className="text-amber-900">
                    <strong>{jobStatus.successRows}</strong> tạo OK, <strong>{jobStatus.errorRows}</strong> thất bại. Chi tiết lỗi từng dòng có trong file Excel kết quả.
                  </p>
                </div>
              )}

              {/* Primary CTA — enriched Excel */}
              <div className="bg-blue-50 border-2 border-[#003973] rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <FileSpreadsheet className="w-6 h-6 text-[#003973] flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="flex-1">
                    <h4 className="text-base font-bold text-slate-800">Tải file Excel đã có link</h4>
                    <p className="text-xs text-slate-600 mt-0.5">File gốc + 2 cột Link đăng ký + Hết hạn. Mở Excel → copy link → paste vào Zalo gửi cán bộ.</p>
                  </div>
                  <button
                    onClick={() => jobId && authedDownload(adminBulkApi.downloadEnrichedUrl(jobId))}
                    className="px-4 py-2.5 bg-[#003973] text-white rounded-lg hover:bg-[#002a5c] text-sm font-medium flex items-center gap-1.5 min-h-[44px]"
                  >
                    <Download className="w-4 h-4" />
                    Tải Excel
                  </button>
                </div>
              </div>

              <button
                onClick={() => jobId && authedDownload(adminBulkApi.downloadZipUrl(jobId))}
                className="w-full px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm flex items-center justify-center gap-1.5 min-h-[44px]"
              >
                <Download className="w-4 h-4" />
                Tải ZIP {jobStatus.successRows} phiếu PDF (để in giao tay)
              </button>

              <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                <button onClick={reset} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm flex items-center gap-1.5 min-h-[44px]">
                  <RefreshCw className="w-4 h-4" />
                  Import file khác
                </button>
                <button onClick={handleClose} className="px-4 py-2 bg-[#003973] text-white rounded-lg hover:bg-[#002a5c] text-sm min-h-[44px]">Đóng</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
