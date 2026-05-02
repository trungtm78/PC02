import { useState, useEffect, useCallback } from "react";
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

  AlertCircle,
  CheckCircle,
  FileSpreadsheet,
  Printer,

  Info,
  XCircle,
} from "lucide-react";
import { api } from "@/lib/api";

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

interface ReceiptFormData {
  receiptNumber: string;
  receiptDate: string;
  receiverName: string;
  delivererName: string;
  content: string;
}

interface ValidationErrors {
  receiptNumber?: string;
  receiptDate?: string;
  receiverName?: string;
  delivererName?: string;
  content?: string;
}

type NotificationType = "success" | "error" | "info";

interface Notification {
  type: NotificationType;
  message: string;
}

const PAGE_SIZE = 20;

export default function ExportReportsPage() {
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [notification, setNotification] = useState<Notification | null>(null);

  const [filters, setFilters] = useState<FilterData>({
    quickSearch: "",
    fromDate: "",
    toDate: "",
    unit: "",
  });

  const [receiptForm, setReceiptForm] = useState<ReceiptFormData>({
    receiptNumber: "",
    receiptDate: new Date().toISOString().split("T")[0],
    receiverName: "",
    delivererName: "",
    content: "",
  });

  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});

  const [petitions, setPetitions] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchPetitions = useCallback(async () => {
    setLoading(true);
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
        receivedDate: p.receivedDate ? new Date(p.receivedDate).toLocaleDateString("vi-VN") : "",
        sender: p.senderName ?? "",
        suspectedTarget: p.suspectedPerson ?? "",
        summary: p.summary ?? "",
        unit: p.unit ?? "",
        result: p.status ?? "",
        enteredBy: p.enteredBy ? `${p.enteredBy.firstName ?? ""} ${p.enteredBy.lastName ?? ""}`.trim() : "",
      }));
      setPetitions(data);
      setTotalCount(res.data.total ?? data.length);
    } catch {
      setPetitions([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchQuery]);

  useEffect(() => { fetchPetitions(); }, [fetchPetitions]);

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

  const validateReceiptForm = (): boolean => {
    const errors: ValidationErrors = {};

    if (!receiptForm.receiptNumber.trim()) {
      errors.receiptNumber = "Vui lòng nhập số biên nhận";
    }

    if (!receiptForm.receiptDate) {
      errors.receiptDate = "Vui lòng chọn ngày biên nhận";
    }

    if (!receiptForm.receiverName.trim()) {
      errors.receiverName = "Vui lòng nhập tên người nhận";
    }

    if (!receiptForm.delivererName.trim()) {
      errors.delivererName = "Vui lòng nhập tên người giao";
    }

    if (!receiptForm.content.trim()) {
      errors.content = "Vui lòng nhập nội dung biên nhận";
    } else if (receiptForm.content.trim().length < 10) {
      errors.content = "Nội dung phải có ít nhất 10 ký tự";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Print-based receipt handler — opens in a new window and triggers browser print
  const handleExportReceiptFromModal = () => {
    if (!validateReceiptForm()) return;

    const receiptHTML = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Biên nhận đơn thư</title>
  <style>
    body { font-family: "Times New Roman", serif; margin: 2cm; }
    .header { text-align: center; margin-bottom: 20px; }
    .title { font-size: 18px; font-weight: bold; text-transform: uppercase; }
    .field { margin: 8px 0; }
    .label { font-weight: bold; }
    .signature { margin-top: 40px; display: flex; justify-content: space-between; }
    .sig-block { text-align: center; width: 40%; }
    @media print { body { margin: 1cm; } }
  </style>
</head>
<body>
  <div class="header">
    <div style="font-size:12px">CÔNG AN THÀNH PHỐ HỒ CHÍ MINH</div>
    <div class="title">BIÊN NHẬN ĐƠN THƯ</div>
  </div>
  <div class="field"><span class="label">Số biên nhận:</span> ${receiptForm.receiptNumber}</div>
  <div class="field"><span class="label">Ngày:</span> ${receiptForm.receiptDate ? new Date(receiptForm.receiptDate).toLocaleDateString('vi-VN') : ''}</div>
  <div class="field"><span class="label">Người nhận:</span> ${receiptForm.receiverName}</div>
  <div class="field"><span class="label">Người giao:</span> ${receiptForm.delivererName}</div>
  <div class="field"><span class="label">Nội dung:</span> ${receiptForm.content}</div>
  <div class="signature">
    <div class="sig-block">
      <div>Người nộp đơn</div>
      <div style="margin-top:60px">(Ký, ghi rõ họ tên)</div>
    </div>
    <div class="sig-block">
      <div>Hồ Chí Minh, ngày ___ tháng ___ năm ___</div>
      <div style="margin-top:10px">CÁN BỘ TIẾP NHẬN</div>
      <div style="margin-top:60px">(Ký, ghi rõ họ tên)</div>
    </div>
  </div>
</body>
</html>`;

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      showNotification('error', 'Trình duyệt chặn popup. Vui lòng cho phép popup và thử lại.');
      return;
    }
    printWindow.document.write(receiptHTML);
    printWindow.document.close();
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 300);
    };

    setShowReceiptModal(false);
    setReceiptForm({
      receiptNumber: "",
      receiptDate: new Date().toISOString().split("T")[0],
      receiverName: "",
      delivererName: "",
      content: "",
    });
    setValidationErrors({});
  };

  // Print receipt for a specific petition row (no modal needed)
  const handleExportReceipt = (petition?: typeof filteredData[0]) => {
    const doc = petition || filteredData.find(d => selectedIds.includes(d.id));
    if (!doc) { showNotification('error', 'Vui lòng chọn đơn thư cần in biên nhận'); return; }

    const receiptHTML = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Biên nhận đơn thư</title>
  <style>
    body { font-family: "Times New Roman", serif; margin: 2cm; }
    .header { text-align: center; margin-bottom: 20px; }
    .title { font-size: 18px; font-weight: bold; text-transform: uppercase; }
    .field { margin: 8px 0; }
    .label { font-weight: bold; }
    .signature { margin-top: 40px; display: flex; justify-content: space-between; }
    .sig-block { text-align: center; width: 40%; }
    @media print { body { margin: 1cm; } }
  </style>
</head>
<body>
  <div class="header">
    <div style="font-size:12px">CÔNG AN THÀNH PHỐ HỒ CHÍ MINH</div>
    <div class="title">BIÊN NHẬN ĐƠN THƯ</div>
  </div>
  <div class="field"><span class="label">Số đơn:</span> ${doc.documentNumber || ''}</div>
  <div class="field"><span class="label">Ngày tiếp nhận:</span> ${doc.receivedDate ? new Date(doc.receivedDate).toLocaleDateString('vi-VN') : ''}</div>
  <div class="field"><span class="label">Người gửi:</span> ${doc.sender || ''}</div>
  <div class="field"><span class="label">Tóm tắt:</span> ${doc.summary || ''}</div>
  <div class="field"><span class="label">Đơn vị:</span> ${doc.unit || ''}</div>
  <div class="signature">
    <div class="sig-block">
      <div>Người nộp đơn</div>
      <div style="margin-top:60px">(Ký, ghi rõ họ tên)</div>
    </div>
    <div class="sig-block">
      <div>Hồ Chí Minh, ngày ___ tháng ___ năm ___</div>
      <div style="margin-top:10px">CÁN BỘ TIẾP NHẬN</div>
      <div style="margin-top:60px">(Ký, ghi rõ họ tên)</div>
    </div>
  </div>
</body>
</html>`;

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      showNotification('error', 'Trình duyệt chặn popup. Vui lòng cho phép popup và thử lại.');
      return;
    }
    printWindow.document.write(receiptHTML);
    printWindow.document.close();
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 300);
    };
  };

  const formatDate = (dateString: string) => {
    // Already formatted on fetch; return as-is or reformat if raw
    if (!dateString) return "";
    if (dateString.includes("/")) return dateString;
    const date = new Date(dateString);
    return date.toLocaleDateString("vi-VN");
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
          Xuất danh sách đơn thư ra Excel, chi tiết ra Word và in biên nhận tiếp nhận
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 mb-1">Tổng hồ sơ</p>
              <p className="text-3xl font-bold text-slate-800">{loading ? "—" : totalCount}</p>
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
              <p className="text-3xl font-bold text-blue-600">{selectedIds.length}</p>
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
                {selectedIds.length > 0 ? selectedIds.length : filteredData.length}
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

          <button
            onClick={() => {
              setShowReceiptModal(true);
              setReceiptForm({
                receiptNumber: "",
                receiptDate: new Date().toISOString().split("T")[0],
                receiverName: "",
                delivererName: "",
                content: "",
              });
              setValidationErrors({});
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <Printer className="w-4 h-4" />
            Xuất biên nhận
          </button>
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
                • <span className="font-medium">Xuất biên nhận:</span> Nhập đầy đủ thông tin sau đó
                xuất file PDF
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
                    <p className="text-slate-500 font-medium">Không tìm thấy hồ sơ nào</p>
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
                        <span className="text-sm text-slate-700">{formatDate(doc.receivedDate)}</span>
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

      {showReceiptModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Printer className="w-5 h-5 text-blue-600" />
                  Xuất biên nhận
                </h3>
                <button
                  onClick={() => {
                    setShowReceiptModal(false);
                    setValidationErrors({});
                  }}
                  className="p-1 hover:bg-slate-100 rounded transition-colors"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Số biên nhận <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={receiptForm.receiptNumber}
                    onChange={(e) =>
                      setReceiptForm({ ...receiptForm, receiptNumber: e.target.value })
                    }
                    placeholder="BN-001/2026"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                      validationErrors.receiptNumber
                        ? "border-red-300 focus:ring-red-500"
                        : "border-slate-300 focus:ring-blue-500"
                    }`}
                  />
                  {validationErrors.receiptNumber && (
                    <div className="flex items-center gap-1 mt-1 text-red-600">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <p className="text-xs">{validationErrors.receiptNumber}</p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Ngày <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="date"
                    value={receiptForm.receiptDate}
                    onChange={(e) =>
                      setReceiptForm({ ...receiptForm, receiptDate: e.target.value })
                    }
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                      validationErrors.receiptDate
                        ? "border-red-300 focus:ring-red-500"
                        : "border-slate-300 focus:ring-blue-500"
                    }`}
                  />
                  {validationErrors.receiptDate && (
                    <div className="flex items-center gap-1 mt-1 text-red-600">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <p className="text-xs">{validationErrors.receiptDate}</p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Tên người nhận <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={receiptForm.receiverName}
                    onChange={(e) =>
                      setReceiptForm({ ...receiptForm, receiverName: e.target.value })
                    }
                    placeholder="Họ và tên"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                      validationErrors.receiverName
                        ? "border-red-300 focus:ring-red-500"
                        : "border-slate-300 focus:ring-blue-500"
                    }`}
                  />
                  {validationErrors.receiverName && (
                    <div className="flex items-center gap-1 mt-1 text-red-600">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <p className="text-xs">{validationErrors.receiverName}</p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Tên người giao <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={receiptForm.delivererName}
                    onChange={(e) =>
                      setReceiptForm({ ...receiptForm, delivererName: e.target.value })
                    }
                    placeholder="Họ và tên"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                      validationErrors.delivererName
                        ? "border-red-300 focus:ring-red-500"
                        : "border-slate-300 focus:ring-blue-500"
                    }`}
                  />
                  {validationErrors.delivererName && (
                    <div className="flex items-center gap-1 mt-1 text-red-600">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <p className="text-xs">{validationErrors.delivererName}</p>
                    </div>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Nội dung <span className="text-red-600">*</span>
                  </label>
                  <textarea
                    value={receiptForm.content}
                    onChange={(e) => setReceiptForm({ ...receiptForm, content: e.target.value })}
                    rows={4}
                    placeholder="Nội dung biên nhận (tối thiểu 10 ký tự)..."
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 resize-none ${
                      validationErrors.content
                        ? "border-red-300 focus:ring-red-500"
                        : "border-slate-300 focus:ring-blue-500"
                    }`}
                  />
                  {validationErrors.content && (
                    <div className="flex items-center gap-1 mt-1 text-red-600">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <p className="text-xs">{validationErrors.content}</p>
                    </div>
                  )}
                  <p className="text-xs text-slate-500 mt-1">
                    {receiptForm.content.length} ký tự (tối thiểu 10 ký tự)
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowReceiptModal(false);
                  setValidationErrors({});
                }}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleExportReceiptFromModal}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                <Download className="w-4 h-4" />
                In biên nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
