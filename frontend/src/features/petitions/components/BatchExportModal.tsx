/**
 * v0.47 PR3.1 T13/T14 — Batch export ZIP modal.
 * POST /api/v1/petitions/export-document-batch { docType, petitionIds[] }
 * → archiver stream of N docx + manifest.json
 */

import { useState } from "react";
import { X, FileText, Loader2, Download } from "lucide-react";
import { api } from "@/lib/api";
import { extractApiError } from "@/lib/api-errors";

interface DocTypeOption {
  value: string;
  label: string;
}

const DOC_TYPES: DocTypeOption[] = [
  { value: "PHIEU_DE_XUAT", label: "Phiếu đề xuất" },
  { value: "PHIEU_CHUYEN_NGUON_TIN", label: "Phiếu chuyển nguồn tin" },
  { value: "PHIEU_CHUYEN_DON", label: "Phiếu chuyển đơn" },
  { value: "THONG_BAO_CHUYEN", label: "Thông báo chuyển đơn" },
  { value: "THONG_BAO_HUONG_DAN", label: "Thông báo hướng dẫn" },
  { value: "THONG_BAO_TRA_LAI", label: "Thông báo trả lại đơn" },
];

interface Props {
  petitionIds: string[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function BatchExportModal({ petitionIds, isOpen, onClose, onSuccess }: Props) {
  const [docType, setDocType] = useState<string>("PHIEU_DE_XUAT");
  const [isExporting, setIsExporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleExport() {
    setIsExporting(true);
    setErrorMsg(null);
    try {
      const response = await api.post<Blob>(
        "/petitions/export-document-batch",
        { docType, petitionIds },
        { responseType: "blob" },
      );

      const headers = response.headers ?? {};
      const cd = String(headers["content-disposition"] || "");
      const m = cd.match(/filename="([^"]+)"/);
      const filename = m?.[1] ?? `batch-${docType}.zip`;

      const url = URL.createObjectURL(response.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      onSuccess();
    } catch (err: unknown) {
      const msg = extractApiError(err, "Không xuất được file ZIP. Một số đơn có thể thiếu trường bắt buộc — xem manifest.json trong ZIP.").messages.join(". ");
      setErrorMsg(msg);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="batch-export-title"
      data-testid="batch-export-modal"
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3 id="batch-export-title" className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-600" />
            Xuất tài liệu hàng loạt
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
            className="p-1 text-slate-400 hover:text-slate-600 rounded disabled:opacity-50"
            aria-label="Đóng"
            data-testid="btn-batch-export-close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          <p className="text-sm text-slate-600">
            Sẽ xuất <strong data-testid="batch-export-count">{petitionIds.length}</strong> tài liệu thành 1 file ZIP. Mỗi đơn render trong giao dịch riêng — đơn nào lỗi sẽ ghi vào <code>manifest.json</code> trong ZIP, không huỷ cả batch.
          </p>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Loại tài liệu</label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              disabled={isExporting}
              className="w-full px-3 py-2.5 text-base sm:text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              data-testid="batch-export-doctype"
            >
              {DOC_TYPES.map((dt) => (
                <option key={dt.value} value={dt.value}>{dt.label}</option>
              ))}
            </select>
          </div>

          {petitionIds.length > 100 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800" data-testid="batch-export-limit-warning">
              Vượt quá 100 đơn/lần. Hãy chọn tối đa 100 đơn.
            </div>
          )}

          {errorMsg && (
            <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800" data-testid="batch-export-error">
              {errorMsg}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
            className="px-4 py-2.5 min-h-[44px] border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
            data-testid="btn-batch-export-cancel"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting || petitionIds.length === 0 || petitionIds.length > 100}
            className="flex items-center gap-2 px-4 py-2.5 min-h-[44px] bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium disabled:opacity-50"
            data-testid="btn-batch-export-confirm"
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {isExporting ? "Đang xuất..." : "Tải ZIP"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default BatchExportModal;
