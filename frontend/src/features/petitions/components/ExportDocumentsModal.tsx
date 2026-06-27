import { useState } from "react";
import { FileText, X, Loader2, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import { extractApiError } from "@/lib/api-errors";
import { DOC_TYPES, parseBlobError } from "@/features/petitions/docTypes";

/**
 * Popup "Xuất chứng từ" cho 1 đơn thư — chọn nhiều mẫu (mặc định tick hết) →
 * gộp 1 file Word (mặc định) hoặc ZIP. Hiện sau khi "Lưu và xuất file".
 * Backend: POST /petitions/:id/export-documents { docTypes[], mode }.
 */
interface Props {
  petitionId: string;
  onClose: () => void;
}

export function ExportDocumentsModal({ petitionId, onClose }: Props) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(DOC_TYPES.map((d) => d.value)),
  );
  const [mode, setMode] = useState<"merged" | "zip">("merged");
  const [isExporting, setIsExporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const allSelected = selected.size === DOC_TYPES.length;

  function toggle(value: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(DOC_TYPES.map((d) => d.value)));
  }

  async function handleExport() {
    if (selected.size === 0 || isExporting) return;
    setIsExporting(true);
    setErrorMsg(null);
    let url: string | null = null;
    try {
      // Giữ THỨ TỰ DOC_TYPES (khớp kỳ vọng backend + test).
      const docTypes = DOC_TYPES.filter((d) => selected.has(d.value)).map((d) => d.value);
      const response = await api.post(
        `/petitions/${petitionId}/export-documents`,
        { docTypes, mode },
        { responseType: "blob" },
      );
      const cd = String((response.headers ?? {})["content-disposition"] ?? "");
      const m = cd.match(/filename="([^"]+)"/);
      const filename = m?.[1] ?? (mode === "merged" ? "ChungTu.docx" : "ChungTu.zip");
      url = URL.createObjectURL(response.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      onClose();
    } catch (err) {
      const parsed = await parseBlobError(err);
      setErrorMsg(
        extractApiError(
          parsed,
          "Không xuất được chứng từ. Vui lòng kiểm tra các trường nghiệp vụ bắt buộc.",
        ).messages.join(". "),
      );
    } finally {
      if (url) URL.revokeObjectURL(url);
      setIsExporting(false);
    }
  }

  return (
    <div
      data-testid="export-documents-modal"
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <FileText className="w-5 h-5 text-amber-600" />
            Xuất chứng từ
          </h2>
          <button
            type="button"
            data-testid="btn-export-close-x"
            onClick={onClose}
            disabled={isExporting}
            className="p-1 rounded hover:bg-slate-100"
            aria-label="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700">Chọn mẫu chứng từ</span>
            <button
              type="button"
              data-testid="btn-toggle-all"
              onClick={toggleAll}
              className="text-xs text-amber-700 hover:underline"
            >
              {allSelected ? "Bỏ chọn tất cả" : "Chọn tất cả"}
            </button>
          </div>
          <ul className="border border-slate-200 rounded-lg divide-y divide-slate-100">
            {DOC_TYPES.map((d) => (
              <li key={d.value}>
                <label className="flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-amber-50">
                  <input
                    type="checkbox"
                    data-testid={`export-doc-checkbox-${d.value}`}
                    checked={selected.has(d.value)}
                    onChange={() => toggle(d.value)}
                    className="mt-1 h-4 w-4 accent-amber-600"
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-slate-800">{d.label}</span>
                    <span className="block text-xs text-slate-500">{d.description}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>

        <fieldset className="mt-4">
          <legend className="text-sm font-medium text-slate-700 mb-1">Định dạng xuất</legend>
          <label className="flex items-center gap-2 py-1 cursor-pointer text-sm">
            <input
              type="radio"
              name="export-mode"
              data-testid="export-mode-merged"
              checked={mode === "merged"}
              onChange={() => setMode("merged")}
              className="accent-amber-600"
            />
            Gộp 1 file Word <span className="text-xs text-slate-500">(nhiều mẫu → 1 file, ngắt trang)</span>
          </label>
          <label className="flex items-center gap-2 py-1 cursor-pointer text-sm">
            <input
              type="radio"
              name="export-mode"
              data-testid="export-mode-zip"
              checked={mode === "zip"}
              onChange={() => setMode("zip")}
              className="accent-amber-600"
            />
            Tách – file ZIP <span className="text-xs text-slate-500">(mỗi mẫu 1 file Word)</span>
          </label>
        </fieldset>

        {errorMsg && (
          <div
            data-testid="export-error"
            role="alert"
            className="mt-3 flex items-start gap-2 rounded bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="mt-2 text-xs text-slate-500">Đã chọn {selected.size}/{DOC_TYPES.length} mẫu</div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            data-testid="btn-export-close"
            onClick={onClose}
            disabled={isExporting}
            className="px-4 py-2.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Đóng
          </button>
          <button
            type="button"
            data-testid="btn-export-confirm"
            onClick={() => void handleExport()}
            disabled={selected.size === 0 || isExporting}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium disabled:opacity-50"
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            {isExporting ? "Đang xuất..." : "Xuất file"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ExportDocumentsModal;
