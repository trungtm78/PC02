import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import {
  Plus, Search, SlidersHorizontal, Download, RotateCcw, Eye, Edit, MoreVertical,
  Scale, AlertTriangle, X, Calendar, User, AlertCircle, ArrowRightLeft, FileText,
  ChevronLeft, ChevronRight, Loader2,
} from "lucide-react";

// ─────────────────────────────────────────────────────────
// Status types & labels
// ─────────────────────────────────────────────────────────

type IncidentStatus =
  | 'TIEP_NHAN' | 'DANG_XAC_MINH' | 'DA_PHAN_CONG' | 'DA_GIAI_QUYET'
  | 'TAM_DINH_CHI' | 'QUA_HAN' | 'DA_CHUYEN_VU_AN' | 'KHONG_KHOI_TO'
  | 'CHUYEN_XPHC' | 'TDC_HET_THOI_HIEU' | 'TDC_HTH_KHONG_KT'
  | 'PHUC_HOI_NGUON_TIN' | 'DA_CHUYEN_DON_VI' | 'DA_NHAP_VU_KHAC' | 'PHAN_LOAI_DAN_SU';

const STATUS_LABELS: Record<IncidentStatus, string> = {
  TIEP_NHAN: "Tiep nhan",
  DANG_XAC_MINH: "Dang xac minh",
  DA_PHAN_CONG: "Da phan cong",
  DA_GIAI_QUYET: "Da giai quyet",
  TAM_DINH_CHI: "Tam dinh chi",
  QUA_HAN: "Qua han",
  DA_CHUYEN_VU_AN: "Da khoi to",
  KHONG_KHOI_TO: "Khong khoi to",
  CHUYEN_XPHC: "Chuyen XPHC",
  TDC_HET_THOI_HIEU: "TDC het thoi hieu",
  TDC_HTH_KHONG_KT: "TDC HTH khong KT",
  PHUC_HOI_NGUON_TIN: "Phuc hoi nguon tin",
  DA_CHUYEN_DON_VI: "Da chuyen don vi",
  DA_NHAP_VU_KHAC: "Da nhap vu khac",
  PHAN_LOAI_DAN_SU: "Phan loai dan su",
};

// Vietnamese with diacritics for display
const STATUS_LABELS_VI: Record<IncidentStatus, string> = {
  TIEP_NHAN: "Tiếp nhận",
  DANG_XAC_MINH: "Đang xác minh",
  DA_PHAN_CONG: "Đã phân công",
  DA_GIAI_QUYET: "Đã giải quyết",
  TAM_DINH_CHI: "Tạm đình chỉ",
  QUA_HAN: "Quá hạn",
  DA_CHUYEN_VU_AN: "Đã khởi tố",
  KHONG_KHOI_TO: "Không khởi tố",
  CHUYEN_XPHC: "Chuyển XPHC",
  TDC_HET_THOI_HIEU: "TĐC hết thời hiệu",
  TDC_HTH_KHONG_KT: "TĐC HTH không KT",
  PHUC_HOI_NGUON_TIN: "Phục hồi nguồn tin",
  DA_CHUYEN_DON_VI: "Đã chuyển đơn vị",
  DA_NHAP_VU_KHAC: "Đã nhập vụ khác",
  PHAN_LOAI_DAN_SU: "Phân loại dân sự",
};

const STATUS_COLORS: Record<IncidentStatus, string> = {
  TIEP_NHAN: "bg-slate-800 text-white",
  DANG_XAC_MINH: "bg-amber-500 text-white",
  DA_PHAN_CONG: "bg-blue-600 text-white",
  DA_GIAI_QUYET: "bg-green-600 text-white",
  TAM_DINH_CHI: "bg-orange-500 text-white",
  QUA_HAN: "bg-red-600 text-white",
  DA_CHUYEN_VU_AN: "bg-purple-600 text-white",
  KHONG_KHOI_TO: "bg-gray-600 text-white",
  CHUYEN_XPHC: "bg-cyan-600 text-white",
  TDC_HET_THOI_HIEU: "bg-rose-500 text-white",
  TDC_HTH_KHONG_KT: "bg-rose-400 text-white",
  PHUC_HOI_NGUON_TIN: "bg-teal-600 text-white",
  DA_CHUYEN_DON_VI: "bg-indigo-500 text-white",
  DA_NHAP_VU_KHAC: "bg-violet-500 text-white",
  PHAN_LOAI_DAN_SU: "bg-lime-600 text-white",
};

// ─────────────────────────────────────────────────────────
// Status filter buttons
// ─────────────────────────────────────────────────────────

const STATUS_BUTTONS: { value: string; label: string; color: string; activeColor: string }[] = [
  { value: "all",                 label: "Tất cả",              color: "bg-slate-100 text-slate-700 hover:bg-slate-200",     activeColor: "bg-slate-700 text-white" },
  { value: "TIEP_NHAN",          label: "Tiếp nhận",           color: "bg-slate-50 text-slate-700 hover:bg-slate-100",      activeColor: "bg-slate-800 text-white" },
  { value: "DANG_XAC_MINH",      label: "Đang xác minh",       color: "bg-amber-50 text-amber-700 hover:bg-amber-100",     activeColor: "bg-amber-500 text-white" },
  { value: "DA_PHAN_CONG",       label: "Đã phân công",        color: "bg-blue-50 text-blue-700 hover:bg-blue-100",        activeColor: "bg-blue-600 text-white" },
  { value: "DA_GIAI_QUYET",      label: "Đã giải quyết",       color: "bg-green-50 text-green-700 hover:bg-green-100",     activeColor: "bg-green-600 text-white" },
  { value: "TAM_DINH_CHI",       label: "Tạm đình chỉ",        color: "bg-orange-50 text-orange-700 hover:bg-orange-100",  activeColor: "bg-orange-500 text-white" },
  { value: "QUA_HAN",            label: "Quá hạn",             color: "bg-red-50 text-red-700 hover:bg-red-100",           activeColor: "bg-red-600 text-white" },
  { value: "DA_CHUYEN_VU_AN",    label: "Đã khởi tố",          color: "bg-purple-50 text-purple-700 hover:bg-purple-100",  activeColor: "bg-purple-600 text-white" },
  { value: "KHONG_KHOI_TO",      label: "Không khởi tố",       color: "bg-gray-50 text-gray-700 hover:bg-gray-100",        activeColor: "bg-gray-600 text-white" },
  { value: "CHUYEN_XPHC",        label: "Chuyển XPHC",         color: "bg-cyan-50 text-cyan-700 hover:bg-cyan-100",        activeColor: "bg-cyan-600 text-white" },
  { value: "TDC_HET_THOI_HIEU",  label: "TĐC hết thời hiệu",  color: "bg-rose-50 text-rose-700 hover:bg-rose-100",        activeColor: "bg-rose-500 text-white" },
  { value: "TDC_HTH_KHONG_KT",   label: "TĐC HTH không KT",   color: "bg-rose-50 text-rose-600 hover:bg-rose-100",        activeColor: "bg-rose-400 text-white" },
  { value: "PHUC_HOI_NGUON_TIN", label: "Phục hồi nguồn tin",  color: "bg-teal-50 text-teal-700 hover:bg-teal-100",        activeColor: "bg-teal-600 text-white" },
  { value: "DA_CHUYEN_DON_VI",   label: "Đã chuyển đơn vị",    color: "bg-indigo-50 text-indigo-700 hover:bg-indigo-100",  activeColor: "bg-indigo-500 text-white" },
  { value: "DA_NHAP_VU_KHAC",    label: "Đã nhập vụ khác",     color: "bg-violet-50 text-violet-700 hover:bg-violet-100",  activeColor: "bg-violet-500 text-white" },
  { value: "PHAN_LOAI_DAN_SU",   label: "Phân loại dân sự",    color: "bg-lime-50 text-lime-700 hover:bg-lime-100",        activeColor: "bg-lime-600 text-white" },
];

// ─────────────────────────────────────────────────────────
// Valid status transitions
// ─────────────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  TIEP_NHAN:          ["DANG_XAC_MINH", "DA_PHAN_CONG", "DA_CHUYEN_DON_VI"],
  DANG_XAC_MINH:      ["DA_PHAN_CONG", "DA_GIAI_QUYET", "TAM_DINH_CHI", "DA_CHUYEN_VU_AN", "KHONG_KHOI_TO", "CHUYEN_XPHC", "PHAN_LOAI_DAN_SU"],
  DA_PHAN_CONG:       ["DANG_XAC_MINH", "DA_GIAI_QUYET", "TAM_DINH_CHI"],
  DA_GIAI_QUYET:      [],
  TAM_DINH_CHI:       ["PHUC_HOI_NGUON_TIN", "TDC_HET_THOI_HIEU", "TDC_HTH_KHONG_KT"],
  QUA_HAN:            ["DANG_XAC_MINH", "TAM_DINH_CHI"],
  DA_CHUYEN_VU_AN:    [],
  KHONG_KHOI_TO:      ["PHUC_HOI_NGUON_TIN"],
  CHUYEN_XPHC:        [],
  TDC_HET_THOI_HIEU:  ["PHUC_HOI_NGUON_TIN"],
  TDC_HTH_KHONG_KT:   ["PHUC_HOI_NGUON_TIN"],
  PHUC_HOI_NGUON_TIN: ["DANG_XAC_MINH"],
  DA_CHUYEN_DON_VI:   [],
  DA_NHAP_VU_KHAC:    [],
  PHAN_LOAI_DAN_SU:   [],
};

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

interface Incident {
  id: string;
  code: string;
  name: string;
  incidentType?: string;
  deadline?: string;
  status: IncidentStatus;
  description?: string;
  doiTuongCaNhan?: string;
  doiTuongToChuc?: string;
  donViGiaiQuyet?: string;
  ketQuaXuLy?: string;
  ngayDeXuat?: string;
  createdAt: string;
  investigator?: { id: string; firstName?: string; lastName?: string; username: string };
}

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

function isOverdue(deadline?: string): boolean {
  if (!deadline) return false;
  return new Date(deadline) < new Date(new Date().setHours(0, 0, 0, 0));
}

function formatDate(d?: string): string {
  if (!d) return "\u2014";
  try { return new Date(d).toLocaleDateString("vi-VN"); } catch { return d; }
}

// ─────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────

export function IncidentListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlStatus = searchParams.get("status") ?? "all";

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [quickSearch, setQuickSearch] = useState("");
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState<string | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showProsecuteModal, setShowProsecuteModal] = useState(false);
  const [showTransitionModal, setShowTransitionModal] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

  // Advanced filters
  const [advancedFilters, setAdvancedFilters] = useState({
    keyword: "",
    loaiDonVu: "",
    benVu: "",
    tinhTrangHoSo: "",
    tinhTrangThoiHieu: "",
    canBoNhap: "",
    fromDate: "",
    toDate: "",
  });

  const selectedStatus = urlStatus;

  const setSelectedStatus = (value: string) => {
    setPage(0);
    if (value === "all") {
      searchParams.delete("status");
    } else {
      searchParams.set("status", value);
    }
    setSearchParams(searchParams);
  };

  const fetchIncidents = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string | number> = {
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      };
      if (selectedStatus !== "all") {
        params.status = selectedStatus;
      }
      if (quickSearch.trim()) {
        params.search = quickSearch.trim();
      }
      const res = await api.get<{ success: boolean; data: Incident[]; total: number }>('/incidents', { params });
      setIncidents(res.data.data ?? []);
      setTotal(res.data.total ?? 0);
    } catch {
      setIncidents([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [page, selectedStatus, quickSearch]);

  useEffect(() => { void fetchIncidents(); }, [fetchIncidents]);
  useEffect(() => {
    const h = () => setShowActionMenu(null);
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, []);

  // Reset page when status changes from URL
  useEffect(() => { setPage(0); }, [urlStatus]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const overdueCount = incidents.filter((i) => isOverdue(i.deadline)).length;

  const handleActionClick = useCallback((incident: Incident, action: string) => {
    setSelectedIncident(incident);
    setShowActionMenu(null);
    if (action === "assign") setShowAssignModal(true);
    else if (action === "prosecute") setShowProsecuteModal(true);
    else if (action === "transition") setShowTransitionModal(true);
  }, []);

  const handleSuccess = useCallback(() => { void fetchIncidents(); }, [fetchIncidents]);

  const clearAdvancedFilters = () => {
    setAdvancedFilters({ keyword: "", loaiDonVu: "", benVu: "", tinhTrangHoSo: "", tinhTrangThoiHieu: "", canBoNhap: "", fromDate: "", toDate: "" });
  };

  return (
    <div className="p-6 space-y-6" data-testid="incident-list-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Quản lý Vụ việc</h1>
          <p className="text-slate-600 text-sm mt-1">Tiếp nhận, xử lý và quản lý các vụ việc điều tra</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => void fetchIncidents()} className="p-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors" title="Làm mới" data-testid="btn-refresh">
            <RotateCcw className="w-4 h-4" />
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700" data-testid="btn-export">
            <Download className="w-4 h-4" />Xuất Excel
          </button>
          <button onClick={() => navigate("/vu-viec/new")} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium" data-testid="btn-add-incident">
            <Plus className="w-4 h-4" />Thêm mới
          </button>
        </div>
      </div>

      {/* Overdue warning */}
      {overdueCount > 0 && (
        <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 flex items-center gap-3" data-testid="overdue-warning">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <p className="text-sm font-medium text-red-800">Cảnh báo: Có <span className="font-bold">{overdueCount}</span> vụ việc đã quá hạn xử lý</p>
        </div>
      )}

      {/* Status tabs */}
      <div className="bg-white rounded-lg border border-slate-200 p-4" data-testid="status-filter-bar">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Lọc theo trạng thái</p>
        <div className="flex flex-wrap gap-2">
          {STATUS_BUTTONS.map((btn) => (
            <button
              key={btn.value}
              onClick={() => setSelectedStatus(btn.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                selectedStatus === btn.value
                  ? `${btn.activeColor} border-transparent`
                  : `${btn.color} border-slate-200`
              }`}
              data-testid={`status-btn-${btn.value}`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search + advanced filters */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={quickSearch}
              onChange={(e) => { setQuickSearch(e.target.value); setPage(0); }}
              placeholder="Tìm kiếm theo Mã, Tên vụ việc, Điều tra viên..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="search-input"
            />
          </div>
          <button onClick={() => setShowAdvancedSearch(!showAdvancedSearch)} className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg ${showAdvancedSearch ? 'border-blue-500 text-blue-700 bg-blue-50' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`} data-testid="btn-advanced-search">
            <SlidersHorizontal className="w-4 h-4" />Tìm kiếm nâng cao
          </button>
        </div>

        {showAdvancedSearch && (
          <div className="mt-4 pt-4 border-t border-slate-200" data-testid="advanced-search-panel">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-slate-800 flex items-center gap-2"><SlidersHorizontal className="w-4 h-4" />Bộ lọc nâng cao</h3>
              <button onClick={() => setShowAdvancedSearch(false)} className="p-1 hover:bg-slate-100 rounded"><X className="w-4 h-4 text-slate-600" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Từ khóa</label>
                <input type="text" value={advancedFilters.keyword} onChange={(e) => setAdvancedFilters({ ...advancedFilters, keyword: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Nhập từ khóa..." data-testid="filter-keyword" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Loại đơn vụ</label>
                <input type="text" value={advancedFilters.loaiDonVu} onChange={(e) => setAdvancedFilters({ ...advancedFilters, loaiDonVu: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Loại đơn vụ..." data-testid="filter-loaiDonVu" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Bên vụ</label>
                <input type="text" value={advancedFilters.benVu} onChange={(e) => setAdvancedFilters({ ...advancedFilters, benVu: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Bên vụ..." data-testid="filter-benVu" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Tình trạng hồ sơ</label>
                <input type="text" value={advancedFilters.tinhTrangHoSo} onChange={(e) => setAdvancedFilters({ ...advancedFilters, tinhTrangHoSo: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Tình trạng hồ sơ..." data-testid="filter-tinhTrangHoSo" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Tình trạng thời hiệu</label>
                <input type="text" value={advancedFilters.tinhTrangThoiHieu} onChange={(e) => setAdvancedFilters({ ...advancedFilters, tinhTrangThoiHieu: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Tình trạng thời hiệu..." data-testid="filter-tinhTrangThoiHieu" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Cán bộ nhập</label>
                <input type="text" value={advancedFilters.canBoNhap} onChange={(e) => setAdvancedFilters({ ...advancedFilters, canBoNhap: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Cán bộ nhập..." data-testid="filter-canBoNhap" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Từ ngày</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="date" value={advancedFilters.fromDate} onChange={(e) => setAdvancedFilters({ ...advancedFilters, fromDate: e.target.value })}
                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" data-testid="filter-fromDate" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Đến ngày</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="date" value={advancedFilters.toDate} onChange={(e) => setAdvancedFilters({ ...advancedFilters, toDate: e.target.value })}
                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" data-testid="filter-toDate" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={clearAdvancedFilters} className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm">Xóa bộ lọc</button>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="font-bold text-slate-800">Danh sách Vụ việc</h2>
          <p className="text-sm text-slate-600 mt-1">
            Hiển thị {incidents.length} / {total} vụ việc
            {selectedStatus !== "all" && <span className="ml-2 text-blue-600">(Lọc: {STATUS_LABELS_VI[selectedStatus as IncidentStatus] ?? selectedStatus})</span>}
            {overdueCount > 0 && <span className="ml-2 text-red-600">(<span className="font-medium">{overdueCount}</span> quá hạn)</span>}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full" data-testid="incident-table">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase w-12">STT</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Mã vụ việc</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Tên vụ việc</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Đối tượng</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Tóm tắt</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Loại</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">ĐTV Thụ lý</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Đơn vị GQ</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Kết quả XL</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Ngày đề xuất</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Hạn xử lý</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Trạng thái</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase w-32">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {isLoading ? (
                <tr>
                  <td colSpan={13} className="px-6 py-16 text-center">
                    <Loader2 className="w-8 h-8 text-blue-500 mx-auto mb-3 animate-spin" />
                    <p className="text-slate-500 font-medium">Đang tải dữ liệu...</p>
                  </td>
                </tr>
              ) : incidents.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-6 py-16 text-center">
                    <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-600 font-medium">Không tìm thấy vụ việc nào</p>
                    <p className="text-sm text-slate-400 mt-1">
                      {selectedStatus !== "all" ? "Thử thay đổi bộ lọc trạng thái" : "Bắt đầu bằng cách thêm vụ việc mới"}
                    </p>
                  </td>
                </tr>
              ) : (
                incidents.map((incident, index) => {
                  const overdue = isOverdue(incident.deadline);
                  const doiTuong = [incident.doiTuongCaNhan, incident.doiTuongToChuc].filter(Boolean).join(", ") || "\u2014";
                  return (
                    <tr key={incident.id} className={`hover:bg-slate-50 ${overdue ? "bg-red-50/40" : ""}`} data-testid="incident-row">
                      <td className="px-4 py-3 text-sm text-slate-700 font-medium">{page * PAGE_SIZE + index + 1}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-blue-600">{incident.code}</span>
                          {overdue && <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full" data-testid="overdue-badge">Quá hạn</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700 max-w-[200px] truncate">{incident.name}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 max-w-[150px] truncate">{doiTuong}</td>
                      <td className="px-4 py-3 text-sm text-slate-500 max-w-[180px] truncate">{incident.description || "\u2014"}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{incident.incidentType ?? "\u2014"}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{incident.investigator ? `${incident.investigator.firstName ?? ""} ${incident.investigator.lastName ?? ""}`.trim() || incident.investigator.username : "\u2014"}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{incident.donViGiaiQuyet ?? "\u2014"}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{incident.ketQuaXuLy ?? "\u2014"}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">{formatDate(incident.ngayDeXuat)}</td>
                      <td className="px-4 py-3 whitespace-nowrap"><span className={`text-sm ${overdue ? "text-red-600 font-medium" : "text-slate-700"}`}>{formatDate(incident.deadline)}</span></td>
                      <td className="px-4 py-3 whitespace-nowrap"><span className={`px-3 py-1.5 rounded-md text-xs font-medium ${STATUS_COLORS[incident.status] ?? "bg-slate-200 text-slate-700"}`}>{STATUS_LABELS_VI[incident.status] ?? incident.status}</span></td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <button onClick={() => navigate(`/vu-viec/${incident.id}`)} className="p-2 text-blue-600 hover:bg-blue-50 rounded" title="Xem" data-testid={`btn-view-${incident.id}`}><Eye className="w-4 h-4" /></button>
                          <button onClick={() => navigate(`/vu-viec/${incident.id}/edit`)} className="p-2 text-slate-600 hover:bg-slate-100 rounded" title="Sửa" data-testid={`btn-edit-${incident.id}`}><Edit className="w-4 h-4" /></button>
                          <div className="relative">
                            <button onClick={(e) => { e.stopPropagation(); setShowActionMenu(showActionMenu === incident.id ? null : incident.id); }} className="p-2 text-slate-600 hover:bg-slate-100 rounded" title="Thao tác" data-testid="btn-action-menu"><MoreVertical className="w-4 h-4" /></button>
                            {showActionMenu === incident.id && (
                              <div className="absolute right-0 top-full mt-1 w-60 bg-white border border-slate-200 rounded-lg shadow-lg z-10" onClick={(e) => e.stopPropagation()}>
                                <button onClick={() => handleActionClick(incident, "assign")} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 text-left" data-testid="btn-assign"><User className="w-4 h-4 text-blue-600" />Phân công</button>
                                {VALID_TRANSITIONS[incident.status]?.length > 0 && (
                                  <button onClick={() => handleActionClick(incident, "transition")} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 text-left border-t border-slate-100" data-testid="btn-transition">
                                    <ArrowRightLeft className="w-4 h-4 text-indigo-600" />Chuyển trạng thái
                                  </button>
                                )}
                                {incident.status === "DANG_XAC_MINH" && (
                                  <button onClick={() => handleActionClick(incident, "prosecute")} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 text-left border-t border-slate-100" data-testid="btn-prosecute"><Scale className="w-4 h-4 text-red-600" />Khởi tố</button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!isLoading && total > PAGE_SIZE && (
          <div className="border-t border-slate-200 px-6 py-4 flex items-center justify-between">
            <p className="text-sm text-slate-600">
              Trang {page + 1} / {totalPages} ({total} kết quả)
            </p>
            <div className="flex items-center gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="flex items-center gap-1 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />Trước
              </button>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                className="flex items-center gap-1 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Sau<ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showAssignModal && selectedIncident && <AssignInvestigatorModal incident={selectedIncident} onClose={() => setShowAssignModal(false)} onSuccess={handleSuccess} />}
      {showProsecuteModal && selectedIncident && <ProsecuteModal incident={selectedIncident} onClose={() => setShowProsecuteModal(false)} onSuccess={handleSuccess} />}
      {showTransitionModal && selectedIncident && <StatusTransitionModal incident={selectedIncident} onClose={() => setShowTransitionModal(false)} onSuccess={handleSuccess} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Status Transition Modal
// ─────────────────────────────────────────────────────────

function StatusTransitionModal({ incident, onClose, onSuccess }: { incident: Incident; onClose: () => void; onSuccess: () => void }) {
  const [selectedStatus, setSelectedStatus] = useState<IncidentStatus | "">("");
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validTargets = VALID_TRANSITIONS[incident.status] ?? [];

  const handleSubmit = async () => {
    if (!selectedStatus) { setErrors(["Vui lòng chọn trạng thái mới"]); return; }
    setIsSubmitting(true);
    try {
      await api.patch(`/incidents/${incident.id}`, { status: selectedStatus });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      if (Array.isArray(msg)) setErrors(msg);
      else if (typeof msg === "string") setErrors([msg]);
      else setErrors(["Có lỗi xảy ra khi chuyển trạng thái"]);
    } finally { setIsSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-800">Chuyển trạng thái</h2>
            <p className="text-sm text-slate-600 mt-1">{incident.code} - {incident.name}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded"><X className="w-5 h-5 text-slate-600" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="mb-2">
            <p className="text-sm text-slate-600">Trạng thái hiện tại: <span className={`inline-block px-3 py-1 rounded-md text-xs font-medium ${STATUS_COLORS[incident.status]}`}>{STATUS_LABELS_VI[incident.status]}</span></p>
          </div>
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <ul className="list-disc list-inside">{errors.map((e, i) => <li key={i} className="text-sm text-red-700">{e}</li>)}</ul>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Chuyển sang <span className="text-red-500">*</span></label>
            {validTargets.length === 0 ? (
              <p className="text-sm text-slate-500 italic">Không có trạng thái nào có thể chuyển từ trạng thái hiện tại.</p>
            ) : (
              <div className="space-y-2">
                {validTargets.map((st) => (
                  <label key={st} className={`flex items-center gap-3 px-4 py-3 border rounded-lg cursor-pointer transition-colors ${selectedStatus === st ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                    <input type="radio" name="targetStatus" value={st} checked={selectedStatus === st} onChange={() => setSelectedStatus(st)} className="accent-blue-600" />
                    <span className={`inline-block px-3 py-1 rounded-md text-xs font-medium ${STATUS_COLORS[st]}`}>{STATUS_LABELS_VI[st]}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="border-t border-slate-200 px-6 py-4 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50">Hủy</button>
          <button onClick={() => void handleSubmit()} disabled={isSubmitting || !selectedStatus} className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50" data-testid="btn-confirm-transition">
            {isSubmitting ? "Đang xử lý..." : "Xác nhận chuyển"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Assign Modal (kept from original)
// ─────────────────────────────────────────────────────────

function AssignInvestigatorModal({ incident, onClose, onSuccess }: { incident: Incident; onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({ investigatorId: "", deadline: "" });
  const [investigators, setInvestigators] = useState<{ id: string; firstName?: string; lastName?: string; username: string }[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    api.get<{ success: boolean; data: typeof investigators }>('/incidents/investigators').then((res) => setInvestigators(res.data.data ?? [])).catch(() => { });
  }, []);

  const handleSubmit = async () => {
    const newErrors: string[] = [];
    if (!formData.investigatorId) newErrors.push("Điều tra viên là bắt buộc");
    if (newErrors.length > 0) { setErrors(newErrors); return; }

    setIsSubmitting(true);
    try {
      await api.patch(`/incidents/${incident.id}/assign`, formData);
      onSuccess(); onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      if (Array.isArray(msg)) setErrors(msg); else if (typeof msg === "string") setErrors([msg]); else setErrors(["Có lỗi xảy ra"]);
    } finally { setIsSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div><h2 className="font-bold text-slate-800">Phân công điều tra viên</h2><p className="text-sm text-slate-600 mt-1">{incident.code}</p></div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded"><X className="w-5 h-5 text-slate-600" /></button>
        </div>
        <div className="p-6 space-y-4">
          {errors.length > 0 && <div className="bg-red-50 border border-red-200 rounded-lg p-3"><ul className="list-disc list-inside">{errors.map((e, i) => <li key={i} className="text-sm text-red-700">{e}</li>)}</ul></div>}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Điều tra viên <span className="text-red-500">*</span></label>
            <select value={formData.investigatorId} onChange={(e) => setFormData({ ...formData, investigatorId: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" data-testid="field-investigator">
              <option value="">Chọn điều tra viên</option>
              {investigators.map((inv) => <option key={inv.id} value={inv.id}>{inv.firstName} {inv.lastName} ({inv.username})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Hạn xử lý</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="date" value={formData.deadline} onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" data-testid="field-deadline" />
            </div>
          </div>
        </div>
        <div className="border-t border-slate-200 px-6 py-4 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50">Hủy</button>
          <button onClick={() => void handleSubmit()} disabled={isSubmitting} className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50" data-testid="btn-confirm-assign">
            {isSubmitting ? "Đang xử lý..." : "Xác nhận phân công"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Prosecute Modal (kept from original)
// ─────────────────────────────────────────────────────────

function ProsecuteModal({ incident, onClose, onSuccess }: { incident: Incident; onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({ caseName: incident.name, prosecutionDecision: "", prosecutionDate: new Date().toISOString().split("T")[0], crime: "" });
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    const newErrors: string[] = [];
    if (!formData.caseName) newErrors.push("Tên vụ án là bắt buộc");
    if (!formData.prosecutionDecision) newErrors.push("Số quyết định là bắt buộc");
    if (newErrors.length > 0) { setErrors(newErrors); return; }

    setIsSubmitting(true);
    try {
      await api.post(`/incidents/${incident.id}/prosecute`, formData);
      onSuccess(); onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      if (Array.isArray(msg)) setErrors(msg); else if (typeof msg === "string") setErrors([msg]); else setErrors(["Có lỗi xảy ra"]);
    } finally { setIsSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div><h2 className="font-bold text-slate-800">Khởi tố vụ việc</h2><p className="text-sm text-slate-600 mt-1">{incident.code}</p></div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded"><X className="w-5 h-5 text-slate-600" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-800"><p className="font-medium">Lưu ý:</p><p>Vụ việc sẽ được chuyển thành Vụ án và không thể hoàn tác.</p></div>
          </div>
          {errors.length > 0 && <div className="bg-red-50 border border-red-200 rounded-lg p-3"><ul className="list-disc list-inside">{errors.map((e, i) => <li key={i} className="text-sm text-red-700">{e}</li>)}</ul></div>}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Tên vụ án <span className="text-red-500">*</span></label>
            <input type="text" value={formData.caseName} onChange={(e) => setFormData({ ...formData, caseName: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" data-testid="field-case-name" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Số quyết định khởi tố <span className="text-red-500">*</span></label>
            <input type="text" value={formData.prosecutionDecision} onChange={(e) => setFormData({ ...formData, prosecutionDecision: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" data-testid="field-prosecution-decision" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Ngày khởi tố</label>
              <input type="date" value={formData.prosecutionDate} onChange={(e) => setFormData({ ...formData, prosecutionDate: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Tội danh</label>
              <input type="text" value={formData.crime} onChange={(e) => setFormData({ ...formData, crime: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </div>
        <div className="border-t border-slate-200 px-6 py-4 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50">Hủy</button>
          <button onClick={() => void handleSubmit()} disabled={isSubmitting} className="px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50" data-testid="btn-confirm-prosecute">
            {isSubmitting ? "Đang xử lý..." : "Xác nhận khởi tố"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default IncidentListPage;
