import { useState, useEffect, useCallback } from "react";
import { FileText, X, Loader2, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import { extractApiError } from "@/lib/api-errors";
import { DOC_TYPES, parseBlobError } from "@/features/petitions/docTypes";
import {
  ExportReadinessChecklist,
  type ReadinessItem,
} from "@/features/document-templates/components/ExportReadinessChecklist";

/**
 * Popup "Xuất chứng từ" cho 1 đơn thư — chọn nhiều mẫu → gộp/zip.
 * Mỗi mẫu THIẾU thông tin để in → tự bỏ check + "Thiếu: X, Y"; nhập bổ sung ngay → lưu vào đơn →
 * mẫu check lại → xuất. Readiness: GET /petitions/:id/export-readiness (1 nguồn sự thật backend).
 */
interface Props {
  petitionId: string;
  onClose: () => void;
  /** Báo form cha cập nhật recordUpdatedAt + formData sau khi popup PUT bổ sung (tránh 409). */
  onPetitionPatched?: (updatedAt: string | undefined, fields: Record<string, string>) => void;
}

export function ExportDocumentsModal({ petitionId, onClose, onPetitionPatched }: Props) {
  const [readiness, setReadiness] = useState<Record<string, ReadinessItem>>({});
  const [recordUpdatedAt, setRecordUpdatedAt] = useState<string | undefined>(undefined);
  const [loadingReadiness, setLoadingReadiness] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [fillValues, setFillValues] = useState<Record<string, string>>({});
  const [savingFill, setSavingFill] = useState(false);
  const [mode, setMode] = useState<"merged" | "zip">("merged");
  const [isExporting, setIsExporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchReadiness = useCallback(async () => {
    const res = await api.get(`/petitions/${petitionId}/export-readiness`);
    const data = (res?.data as { data?: { items?: Array<{ docType: string; ready: boolean; missing: ReadinessItem["missing"] }>; updatedAt?: string } })?.data;
    const map: Record<string, ReadinessItem> = {};
    const readyKeys: string[] = [];
    for (const it of data?.items ?? []) {
      map[it.docType] = { key: it.docType, ready: it.ready, missing: it.missing };
      if (it.ready) readyKeys.push(it.docType);
    }
    setReadiness(map);
    setRecordUpdatedAt(data?.updatedAt);
    setSelected(new Set(readyKeys)); // chỉ mẫu ĐỦ được tick (mẫu thiếu auto bỏ check)
  }, [petitionId]);

  useEffect(() => {
    setLoadingReadiness(true);
    fetchReadiness().catch(() => setReadiness({})).finally(() => setLoadingReadiness(false));
  }, [fetchReadiness]);

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });

  // Lưu các trường bổ sung vào đơn (PUT) → refresh readiness → mẫu đủ tự mở lại.
  async function handleSaveFill() {
    if (savingFill) return;
    const payload = Object.fromEntries(Object.entries(fillValues).filter(([, v]) => v && v.trim() !== ""));
    if (Object.keys(payload).length === 0) { setErrorMsg("Chưa nhập thông tin bổ sung nào."); return; }
    setSavingFill(true);
    setErrorMsg(null);
    try {
      const res = await api.put(`/petitions/${petitionId}`, { ...payload, expectedUpdatedAt: recordUpdatedAt });
      const newUpdatedAt = (res?.data as { data?: { updatedAt?: string } } | undefined)?.data?.updatedAt;
      onPetitionPatched?.(newUpdatedAt, payload as Record<string, string>);
      await fetchReadiness();
      setFillValues({});
    } catch (err) {
      setErrorMsg(extractApiError(err, "Không lưu được thông tin bổ sung.").messages.join(". "));
    } finally {
      setSavingFill(false);
    }
  }

  async function handleExport() {
    if (selected.size === 0 || isExporting) return;
    setIsExporting(true);
    setErrorMsg(null);
    let url: string | null = null;
    try {
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
      setErrorMsg(extractApiError(parsed, "Không xuất được chứng từ. Vui lòng kiểm tra các trường nghiệp vụ bắt buộc.").messages.join(". "));
    } finally {
      if (url) URL.revokeObjectURL(url);
      setIsExporting(false);
    }
  }

  return (
    <div data-testid="export-documents-modal" role="dialog" aria-modal="true" className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <FileText className="w-5 h-5 text-amber-600" /> Xuất chứng từ
          </h2>
          <button type="button" data-testid="btn-export-close-x" onClick={onClose} disabled={isExporting} className="p-1 rounded hover:bg-slate-100" aria-label="Đóng">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4">
          <span className="text-sm font-medium text-slate-700 mb-2 block">Chọn mẫu chứng từ (mẫu thiếu thông tin sẽ bị khoá — bổ sung bên dưới)</span>
          <ExportReadinessChecklist
            templates={DOC_TYPES.map((d) => ({ key: d.value, label: d.label, description: d.description }))}
            readiness={readiness}
            loading={loadingReadiness}
            selected={selected}
            onToggle={toggle}
            fillValues={fillValues}
            onFillChange={(field, value) => setFillValues((p) => ({ ...p, [field]: value }))}
            onSaveFill={() => void handleSaveFill()}
            saving={savingFill}
            idPrefix="export-doc"
          />
        </div>

        <fieldset className="mt-4">
          <legend className="text-sm font-medium text-slate-700 mb-1">Định dạng xuất</legend>
          <label className="flex items-center gap-2 py-1 cursor-pointer text-sm">
            <input type="radio" name="export-mode" data-testid="export-mode-merged" checked={mode === "merged"} onChange={() => setMode("merged")} className="accent-amber-600" />
            Gộp 1 file Word <span className="text-xs text-slate-500">(nhiều mẫu → 1 file, ngắt trang)</span>
          </label>
          <label className="flex items-center gap-2 py-1 cursor-pointer text-sm">
            <input type="radio" name="export-mode" data-testid="export-mode-zip" checked={mode === "zip"} onChange={() => setMode("zip")} className="accent-amber-600" />
            Tách – file ZIP <span className="text-xs text-slate-500">(mỗi mẫu 1 file Word)</span>
          </label>
        </fieldset>

        {errorMsg && (
          <div data-testid="export-error" role="alert" className="mt-3 flex items-start gap-2 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="mt-2 text-xs text-slate-500">Đã chọn {selected.size}/{DOC_TYPES.length} mẫu</div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" data-testid="btn-export-close" onClick={onClose} disabled={isExporting} className="px-4 py-2.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            Đóng
          </button>
          <button type="button" data-testid="btn-export-confirm" onClick={() => void handleExport()} disabled={selected.size === 0 || isExporting} className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium disabled:opacity-50">
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            {isExporting ? "Đang xuất..." : "Xuất file"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ExportDocumentsModal;
