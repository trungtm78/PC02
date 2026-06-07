/**
 * v0.47 PR3.1 T12 — Dropdown "Xuất tài liệu" với 6 doc types.
 * Trigger backend endpoint GET /api/v1/petitions/:id/export-document?docType=...
 * Stream docx về browser qua window.open + token (existing auth pattern).
 */

import { useState, useRef, useEffect } from "react";
import { FileText, ChevronDown, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { extractApiError } from "@/lib/api-errors";

interface DocTypeOption {
  value: string;
  label: string;
  description: string;
}

// Khớp với DOCUMENT_TYPES backend (backend/src/document-templates/docx-loader.service.ts).
const DOC_TYPES: DocTypeOption[] = [
  { value: "BIEN_NHAN", label: "Biên nhận", description: "Biên nhận tiếp nhận đơn thư — xác nhận đã nhận hồ sơ" },
  { value: "PHIEU_DE_XUAT", label: "Phiếu đề xuất", description: "Báo cáo đề xuất xử lý đơn thư lên Ban CH PC02 + Ban CH Đội" },
  { value: "PHIEU_CHUYEN_NGUON_TIN", label: "Phiếu chuyển nguồn tin", description: "Chuyển nguồn tin về tội phạm (Mẫu 03 TT 128/2025/TT-BCA)" },
  { value: "PHIEU_CHUYEN_DON", label: "Phiếu chuyển đơn", description: "Chuyển đơn cho Tổ công tác giải quyết theo thẩm quyền" },
  { value: "THONG_BAO_CHUYEN", label: "Thông báo chuyển đơn", description: "Thông báo cho người gửi: đơn đã được chuyển đến đơn vị có thẩm quyền" },
  { value: "THONG_BAO_HUONG_DAN", label: "Thông báo hướng dẫn", description: "Hướng dẫn người gửi khởi kiện ra Tòa án nhân dân" },
  { value: "THONG_BAO_TRA_LAI", label: "Thông báo trả lại đơn", description: "Trả lại đơn cho người gửi để bổ sung, hoàn thiện" },
];

interface Props {
  petitionId: string;
  /** v0.47 PR3.1 review fix: block export when form has unsaved edits — backend
   * re-fetches the petition from DB, so dirty edits would render with stale data. */
  isDirty?: boolean;
  onError?: (msg: string) => void;
}

async function parseBlobError(err: unknown): Promise<unknown> {
  const e = err as { response?: { data?: unknown } };
  const data = e?.response?.data;
  if (data instanceof Blob && data.type.includes('json')) {
    try {
      const text = await data.text();
      (e as { response: { data: unknown } }).response.data = JSON.parse(text);
    } catch {
      /* ignore — extractApiError fallback will fire */
    }
  }
  return err;
}

export function ExportDocumentDropdown({ petitionId, isDirty, onError }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [busyDocType, setBusyDocType] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
    return undefined;
  }, [isOpen]);

  async function handleExport(docType: string) {
    if (isDirty) {
      const msg = "Có nội dung chưa lưu. Hãy lưu đơn thư trước khi xuất tài liệu để đảm bảo nội dung phiếu phản ánh đúng các trường nghiệp vụ vừa nhập.";
      if (onError) onError(msg);
      else window.alert(msg);
      return;
    }
    setBusyDocType(docType);
    setIsOpen(false);
    let url: string | null = null;
    try {
      const response = await api.get<Blob>(`/petitions/${petitionId}/export-document`, {
        params: { docType },
        responseType: "blob",
      });
      const headers = response.headers ?? {};
      const cd = String(headers["content-disposition"] || "");
      const m = cd.match(/filename="([^"]+)"/);
      const filename = m?.[1] ?? `${docType}.docx`;

      url = URL.createObjectURL(response.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: unknown) {
      const parsed = await parseBlobError(err);
      const msg = extractApiError(parsed, "Không xuất được tài liệu. Vui lòng kiểm tra các trường nghiệp vụ bắt buộc.").messages.join(". ");
      if (onError) onError(msg);
      else window.alert(msg);
    } finally {
      if (url) URL.revokeObjectURL(url);
      setBusyDocType(null);
    }
  }

  const isAnyBusy = busyDocType !== null;

  return (
    <div ref={containerRef} className="relative inline-block" data-testid="export-document-dropdown">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        disabled={isAnyBusy}
        className="flex items-center gap-2 px-4 sm:px-6 py-2.5 min-h-[44px] bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium disabled:opacity-60"
        data-testid="btn-export-document"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        {isAnyBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
        <span className="hidden sm:inline">{isAnyBusy ? "Đang xuất..." : "Xuất tài liệu"}</span>
        <span className="sm:hidden">{isAnyBusy ? "Đang xuất" : "Xuất"}</span>
        <ChevronDown className="w-4 h-4" />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-80 sm:w-96 max-w-[calc(100vw-2rem)] bg-white border border-slate-200 rounded-lg shadow-lg z-30 overflow-hidden"
          data-testid="export-document-menu"
        >
          <ul>
            {DOC_TYPES.map((dt) => (
              <li key={dt.value}>
                <button
                  type="button"
                  onClick={() => handleExport(dt.value)}
                  disabled={isAnyBusy}
                  className="w-full text-left px-4 py-3 hover:bg-amber-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-b border-slate-100 last:border-b-0"
                  data-testid={`export-option-${dt.value}`}
                  role="menuitem"
                >
                  <div className="flex items-start gap-2">
                    <FileText className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-800 text-sm">{dt.label}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{dt.description}</div>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default ExportDocumentDropdown;
