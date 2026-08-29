import { useState, useEffect, useCallback, useRef } from "react";
import { resolveFilename } from "@/features/document-templates/export.api";
import {
  Search,
  Download,
  RotateCcw,
  Filter,
  ChevronDown,
  ChevronUp,
  FileText,
  Calendar,
  Building2,
  User,
  X,
  CheckCircle,
  FileSpreadsheet,
  Loader2,
  Info,
  XCircle,
} from "lucide-react";
import { extractApiError } from "@/lib/api-errors";
import { api } from "@/lib/api";
import { soLieuHienThi } from "@/lib/soLieuHienThi";
import { LoadErrorBanner } from "@/components/shared/LoadErrorBanner";
import { formatVNDate, toDateInput } from "@/lib/dates";

interface Document {
  id: string;
  documentNumber: string;
  receivedDate: string;
  sender: string;
  suspectedTarget: string;
  summary: string;
  unit: string;
  result: string;
  enteredBy: string;
}

interface FilterData {
  quickSearch: string;
  fromDate: string;
  toDate: string;
  unit: string;
}

// 7 docTypes — khớp với DOCUMENT_TYPES backend (docx-loader.service.ts)
const BATCH_DOC_TYPES = [
  { value: "BIEN_NHAN", label: "Biên nhận", description: "Biên nhận tiếp nhận đơn thư" },
  { value: "PHIEU_DE_XUAT", label: "Phiếu đề xuất", description: "Báo cáo đề xuất xử lý đơn thư" },
  { value: "PHIEU_CHUYEN_NGUON_TIN", label: "Phiếu chuyển nguồn tin", description: "Mẫu 03 TT 128/2025/TT-BCA" },
  { value: "PHIEU_CHUYEN_DON", label: "Phiếu chuyển đơn", description: "Chuyển đơn theo thẩm quyền" },
  { value: "THONG_BAO_CHUYEN", label: "Thông báo chuyển đơn", description: "Thông báo cho người gửi" },
  { value: "THONG_BAO_HUONG_DAN", label: "Thông báo hướng dẫn", description: "Hướng dẫn khởi kiện ra Tòa" },
  { value: "THONG_BAO_TRA_LAI", label: "Thông báo trả lại đơn", description: "Trả lại đơn để bổ sung" },
] as const;

type NotificationType = "success" | "error" | "info";

interface Notification {
  type: NotificationType;
  message: string;
}

const PAGE_SIZE = 20;

export default function ExportReportsPage() {
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [showBatchDocDropdown, setShowBatchDocDropdown] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [notification, setNotification] = useState<Notification | null>(null);
  const [isBatchExportingDoc, setIsBatchExportingDoc] = useState(false);
  const batchDropdownRef = useRef<HTMLDivElement>(null);

  const [filters, setFilters] = useState<FilterData>({
    quickSearch: "",
    fromDate: "",
    toDate: "",
    unit: "",
  });

  const [petitions, setPetitions] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchPetitions = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String((currentPage - 1) * PAGE_SIZE),
      });
      if (searchQuery) params.set("search", searchQuery);
      const res = await api.get(`/petitions?${params}`);
      const data = (res.data.data ?? []).map((p: any) => ({
        id: p.id,
        documentNumber: p.stt ?? "",
        receivedDate: toDateInput(p.receivedDate),
        sender: p.senderName ?? "",
        suspectedTarget: p.suspectedPerson ?? "",
        summary: p.summary ?? "",
        unit: p.unit ?? "",
        result: p.status ?? "",
        enteredBy: p.enteredBy ? `${p.enteredBy.firstName ?? ""} ${p.enteredBy.lastName ?? ""}`.trim() : "",
      }));
      setPetitions(data);
      setTotalCount(res.data.total ?? data.length);
    } catch (e) {
      // KHÔNG biến "không hỏi được máy chủ" thành "không có gì cả": mảng rỗng làm mọi thẻ
      // thống kê ra số 0, và số 0 đọc như một câu trả lời. Giữ lỗi lại để giao diện nói ra.
      setPetitions([]);
      setLoadError(extractApiError(e, "Không tải được dữ liệu. Vui lòng thử lại.").messages.join(", "));
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchQuery]);

  useEffect(() => { fetchPetitions(); }, [fetchPetitions]);

  // Đóng batch dropdown khi click ngoài
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (batchDropdownRef.current && !batchDropdownRef.current.contains(e.target as Node)) {
        setShowBatchDocDropdown(false);
      }
    }
    if (showBatchDocDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
    return undefined;
  }, [showBatchDocDropdown]);

  // Client-side filtering for date/unit filters (applied on top of server-fetched page)
  const filteredData = petitions.filter((doc) => {
    if (filters.fromDate && doc.receivedDate < filters.fromDate) return false;
    if (filters.toDate && doc.receivedDate > filters.toDate) return false;
    if (filters.unit && doc.unit !== filters.unit) return false;
    return true;
  });

  const handleResetFilters = () => {
    setFilters({
      quickSearch: "",
      fromDate: "",
      toDate: "",
      unit: "",
    });
    setSearchQuery("");
    setCurrentPage(1);
  };

  const handleSearchSubmit = () => {
    setSearchQuery(filters.quickSearch);
    setCurrentPage(1);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredData.map((doc) => doc.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter((selectedId) => selectedId !== id));
    }
  };

  const showNotification = (type: NotificationType, message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 5000);
  };

  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [exportingWordId, setExportingWordId] = useState<string | null>(null);

  const handleExportExcel = async () => {
    if (isExportingExcel) return;
    setIsExportingExcel(true);
    try {
      const ids = selectedIds.length > 0 ? selectedIds.join(',') : undefined;
      const params: Record<string, string> = {};
      if (ids) params.ids = ids;
      if (filters.fromDate) params.fromDate = filters.fromDate;
      if (filters.toDate) params.toDate = filters.toDate;
      if (filters.unit) params.unit = filters.unit;

      const response = await api.get('/petitions/export', { params, responseType: 'blob' });
      const timestamp = new Date().toISOString().replace(/[-:T]/g, '').substring(0, 14);
      const filename = `DonThu_${timestamp}.xlsx`;
      const url = URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showNotification('success', `Đã xuất ${selectedIds.length || filteredData.length} hồ sơ: ${filename}`);
    } catch {
      showNotification('error', 'Xuất Excel thất bại. Vui lòng thử lại.');
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleExportWord = async (doc: Document) => {
    if (exportingWordId) return;
    setExportingWordId(doc.id);
    try {
      const response = await api.get(`/petitions/${doc.id}/export-word`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `DonThu_${(doc.documentNumber || doc.id).replace(/\//g, '_')}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showNotification('success', `Đã xuất chi tiết ${doc.documentNumber} ra file Word`);
    } catch {
      showNotification('error', 'Xuất Word thất bại. Vui lòng thử lại.');
    } finally {
      setExportingWordId(null);
    }
  };

  const handleBatchExportDocument = async (docType: string) => {
    if (isBatchExportingDoc || selectedIds.length === 0) return;
    setIsBatchExportingDoc(true);
    setShowBatchDocDropdown(false);
    let url: string | null = null;
    try {
      const response = await api.post<Blob>(
        '/petitions/export-document-batch',
        { docType, petitionIds: selectedIds },
        { responseType: 'blob' },
      );
      const headers = response.headers ?? {};
      const filename = resolveFilename(
        headers as Record<string, unknown>,
        `${docType}_batch.zip`,
      );
      url = URL.createObjectURL(response.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Báo kết quả thật từ header backend (X-Batch-*): số đơn thành công/thất bại. Chi tiết
      // per-đơn nằm trong manifest.json của file ZIP.
      const hdr = (headers ?? {}) as Record<string, string>;
      const total = Number(hdr['x-batch-total'] ?? selectedIds.length);
      const failed = Number(hdr['x-batch-failed'] ?? 0);
      const ok = Number(hdr['x-batch-ok'] ?? selectedIds.length);
      if (failed > 0) {
        showNotification('info', `Đã xuất ${ok}/${total} đơn — tải về ${filename}. ${failed} đơn thiếu thông tin bắt buộc (xem manifest.json trong file ZIP).`);
      } else {
        showNotification('success', `Đã xuất ${ok} đơn — tải về ${filename}`);
      }
    } catch {
      showNotification('error', 'Xuất tài liệu đồng loạt thất bại. Kiểm tra các đơn đã chọn có đủ trường bắt buộc không.');
    } finally {
      if (url) URL.revokeObjectURL(url);
      setIsBatchExportingDoc(false);
    }
  };

  const isAllSelected = filteredData.length > 0 && selectedIds.length === filteredData.length;
  const isSomeSelected = selectedIds.length > 0 && selectedIds.length < filteredData.length;

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="p-6 space-y-6">
      {notification && (
        <div className="fixed top-6 right-6 z-50 animate-slide-in">
          <div
            className={`flex items-start gap-3 p-4 rounded-lg shadow-lg border-2 min-w-[400px] ${
              notification.type === "success"
                ? "bg-green-50 border-green-500"
                : notification.type === "error"
                ? "bg-red-50 border-red-500"
                : "bg-blue-50 border-blue-500"
            }`}
          >
            <div className="flex-shrink-0">
              {notification.type === "success" && (
                <CheckCircle className="w-6 h-6 text-green-600" />
              )}
              {notification.type === "error" && <XCircle className="w-6 h-6 text-red-600" />}
              {notification.type === "info" && <Info className="w-6 h-6 text-blue-600" />}
            </div>
            <div className="flex-1">
              <p
                className={`text-sm font-medium ${
                  notification.type === "success"
                    ? "text-green-900"
                    : notification.type === "error"
                    ? "text-red-900"
                    : "text-blue-900"
                }`}
              >
                {notification.type === "success" && "Thành công"}
                {notification.type === "error" && "Lỗi"}
                {notification.type === "info" && "Thông báo"}
              </p>
              <p
                className={`text-sm mt-1 ${
                  notification.type === "success"
                    ? "text-green-800"
                    : notification.type === "error"
                    ? "text-red-800"
                    : "text-blue-800"
                }`}
              >
                {notification.message}
              </p>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="flex-shrink-0 p-1 hover:bg-white/50 rounded transition-colors"
            >
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-slate-800">Xuất hồ sơ đơn thư</h1>
        <p className="text-slate-600 text-sm mt-1">
          Xuất danh sách đơn thư ra Excel; xuất đồng loạt biểu mẫu Word (ZIP) cho các đơn đã chọn
        </p>
      </div>

      <LoadErrorBanner error={loadError} what="danh sách đơn thư để xuất" data-testid="export-reports-load-error" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 mb-1">Tổng hồ sơ</p>
              <p className="text-3xl font-bold text-slate-800">{soLieuHienThi(loading ? null : totalCount, !!loadError)}</p>
            </div>
            <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-slate-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border-2 border-blue-200 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-700 font-medium mb-1">Đã chọn</p>
              <p className="text-3xl font-bold text-blue-600">{soLieuHienThi(selectedIds.length, !!loadError)}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 mb-1">Sẵn sàng xuất</p>
              <p className="text-3xl font-bold text-green-600">
                {soLieuHienThi(
                  selectedIds.length > 0 ? selectedIds.length : filteredData.length,
                  !!loadError,
                )}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Download className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportExcel}
            disabled={isExportingExcel}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isExportingExcel ? (
              <>
                <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Đang xuất...
              </>
            ) : (
              <>
                <FileSpreadsheet className="w-4 h-4" />
                Xuất Excel
              </>
            )}
          </button>

          {/* Batch Word export dropdown — enabled khi đã chọn ít nhất 1 đơn */}
          <div ref={batchDropdownRef} className="relative inline-block">
            <button
              type="button"
              onClick={() => setShowBatchDocDropdown((v) => !v)}
              disabled={isBatchExportingDoc || selectedIds.length === 0}
              title={selectedIds.length === 0 ? "Chọn ít nhất 1 đơn thư để xuất đồng loạt" : "Xuất tài liệu đồng loạt (ZIP)"}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isBatchExportingDoc ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              {isBatchExportingDoc ? "Đang xuất..." : "Xuất tài liệu đồng loạt"}
              {!isBatchExportingDoc && <ChevronDown className="w-4 h-4" />}
            </button>
            {showBatchDocDropdown && (
              <div
                role="menu"
                className="absolute left-0 mt-2 w-72 bg-white border border-slate-200 rounded-lg shadow-lg z-30 overflow-hidden"
              >
                <div className="px-3 py-2 text-xs text-slate-500 border-b border-slate-100">
                  Xuất {selectedIds.length} đơn đã chọn → ZIP
                </div>
                <ul>
                  {BATCH_DOC_TYPES.map((dt) => (
                    <li key={dt.value}>
                      <button
                        type="button"
                        onClick={() => handleBatchExportDocument(dt.value)}
                        className="w-full text-left px-3 py-2.5 hover:bg-amber-50 transition-colors border-b border-slate-100 last:border-b-0"
                        role="menuitem"
                      >
                        <div className="flex items-start gap-2">
                          <FileText className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <div className="text-sm font-medium text-slate-800">{dt.label}</div>
                            <div className="text-xs text-slate-500">{dt.description}</div>
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAdvancedFilter(!showAdvancedFilter)}
            className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg transition-colors ${
              showAdvancedFilter
                ? "bg-blue-50 border-blue-300 text-blue-700"
                : "border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
          >
            <Filter className="w-4 h-4" />
            Bộ lọc
            {showAdvancedFilter ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          <button
            onClick={handleResetFilters}
            className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Làm mới
          </button>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-2 text-sm text-blue-900">
            <p className="font-medium">Hướng dẫn xuất báo cáo:</p>
            <ul className="space-y-1 ml-4">
              <li>
                • <span className="font-medium">Xuất Excel:</span> Không chọn dòng nào sẽ xuất tất
                cả hồ sơ. Tên file: <code className="px-1.5 py-0.5 bg-blue-100 rounded text-xs">DonThu_YYYYMMDD_HHmmss.xlsx</code>
              </li>
              <li>
                • <span className="font-medium">Xuất Word (chi tiết):</span> Thực hiện trong màn hình
                "Xem" hồ sơ. Tên file: <code className="px-1.5 py-0.5 bg-blue-100 rounded text-xs">HoSo_DonThu_&#123;STT&#125;_YYYYMMDD.docx</code>
              </li>
              <li>
                • <span className="font-medium">Xuất tài liệu đồng loạt:</span> Chọn ít nhất 1 đơn
                thư → nhấn "Xuất tài liệu đồng loạt" → chọn loại biểu mẫu → tải về file ZIP chứa toàn bộ .docx
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={filters.quickSearch}
              onChange={(e) => setFilters({ ...filters, quickSearch: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && handleSearchSubmit()}
              placeholder="Tìm kiếm theo STT, người gửi, nghi vấn đối tượng, tóm tắt..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={handleSearchSubmit}
            className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>

        {showAdvancedFilter && (
          <div className="pt-4 border-t border-slate-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Từ ngày</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="date"
                    value={filters.fromDate}
                    onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })}
                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Đến ngày</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="date"
                    value={filters.toDate}
                    onChange={(e) => setFilters({ ...filters, toDate: e.target.value })}
                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Đơn vị</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select
                    value={filters.unit}
                    onChange={(e) => setFilters({ ...filters, unit: e.target.value })}
                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">Tất cả</option>
                    <option value="Đội Điều tra tổng hợp">Đội Điều tra tổng hợp</option>
                    <option value="Thanh tra Công an">Thanh tra Công an</option>
                    <option value="Văn phòng Cơ quan">Văn phòng Cơ quan</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b-2 border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    ref={(el) => {
                      if (el) {
                        el.indeterminate = isSomeSelected;
                      }
                    }}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-2 focus:ring-blue-500"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                  STT
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Ngày tiếp nhận
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Tên người gửi
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Nghi vấn đối tượng
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Tóm tắt
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Đơn vị
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Kết quả
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Người nhập
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-16 text-center">
                    <div className="flex items-center justify-center gap-3">
                      <div className="w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-slate-500">Đang tải dữ liệu...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-16 text-center">
                    <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">{loadError ? 'Chưa hỏi được máy chủ — xem thông báo phía trên' : 'Không tìm thấy hồ sơ nào'}</p>
                    <p className="text-sm text-slate-400 mt-1">Thử điều chỉnh bộ lọc</p>
                  </td>
                </tr>
              ) : (
                filteredData.map((doc) => (
                  <tr
                    key={doc.id}
                    className={`hover:bg-slate-50 transition-colors ${
                      selectedIds.includes(doc.id) ? "bg-blue-50" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(doc.id)}
                        onChange={(e) => handleSelectOne(doc.id, e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-2 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-bold text-blue-600">{doc.documentNumber}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-sm text-slate-700">{formatVNDate(doc.receivedDate)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-sm font-medium text-slate-800">{doc.sender}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-700">{doc.suspectedTarget}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-slate-700 line-clamp-2 max-w-md">{doc.summary}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-sm text-slate-700">{doc.unit}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          doc.result === "Đã giải quyết"
                            ? "bg-green-100 text-green-800"
                            : doc.result === "Đang xử lý"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {doc.result}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-700">{doc.enteredBy}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleExportWord(doc)}
                        disabled={exportingWordId === doc.id}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-green-600 hover:bg-green-50 rounded transition-colors text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Xuất Word chi tiết"
                      >
                        {exportingWordId === doc.id ? (
                          <svg className="animate-spin w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                          </svg>
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                        Word
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
            <p className="text-sm text-slate-600">
              Trang {currentPage} / {totalPages} • Tổng {totalCount} hồ sơ
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Trước
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
