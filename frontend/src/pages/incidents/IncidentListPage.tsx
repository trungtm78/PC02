import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
// Note: useSearchParams is only used for READING initial URL on mount.
// URL writes use window.history.replaceState to avoid React Router re-renders.
import { api } from "@/lib/api";
import { downloadCsv } from "@/lib/csv";
import {
  Plus, Search, SlidersHorizontal, Download, RotateCcw, Eye, Edit, MoreVertical,
  Scale, AlertTriangle, X, Calendar, User, AlertCircle, ArrowRightLeft, FileText,
  ChevronLeft, ChevronRight, Loader2, Trash2,
} from "lucide-react";
import { PHASE_STATUSES, PHASE_LABELS, PHASE_ORDER } from "@/constants/incident-phases";
import { usePermission } from "@/hooks/usePermission";
import { AssignModal } from "@/components/AssignModal";

// ─────────────────────────────────────────────────────────
// Status types & labels
// ─────────────────────────────────────────────────────────

type IncidentStatus =
  | 'TIEP_NHAN' | 'DANG_XAC_MINH' | 'DA_PHAN_CONG' | 'DA_GIAI_QUYET'
  | 'TAM_DINH_CHI' | 'QUA_HAN' | 'DA_CHUYEN_VU_AN' | 'KHONG_KHOI_TO'
  | 'CHUYEN_XPHC' | 'TDC_HET_THOI_HIEU' | 'TDC_HTH_KHONG_KT'
  | 'PHUC_HOI_NGUON_TIN' | 'DA_CHUYEN_DON_VI' | 'DA_NHAP_VU_KHAC' | 'PHAN_LOAI_DAN_SU';

const STATUS_LABELS: Record<IncidentStatus, string> = {
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

const STATUS_LABELS_VI = STATUS_LABELS;

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
// Phase tab config
// ─────────────────────────────────────────────────────────

const PHASE_TABS: { value: string; label: string; activeColor: string }[] = [
  { value: "all",          label: "Tất cả",                        activeColor: "bg-slate-700 text-white" },
  { value: "tiep-nhan",    label: "Tiếp nhận",                     activeColor: "bg-slate-800 text-white" },
  { value: "xac-minh",     label: "Xác minh",                           activeColor: "bg-amber-500 text-white" },
  { value: "ket-qua",      label: "Kết quả",                       activeColor: "bg-green-600 text-white" },
  { value: "tam-dinh-chi", label: "TĐC & Phục hồi",          activeColor: "bg-orange-500 text-white" },
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
  assignedTeamId?: string | null;
  updatedAt?: string;
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
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("vi-VN"); } catch { return d; }
}

// ─────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────

export function IncidentListPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // ── State-driven fetch: React state = source of truth ──────────
  // URL is synced as a SECONDARY effect, never drives the fetch.
  // This avoids timing issues where setSearchParams + useSearchParams
  // round-trip through React Router causes stale or missing renders.
  const [selectedPhase, setSelectedPhaseState] = useState<string>(
    () => searchParams.get("phase") ?? "all",
  );
  const [statusFilter, setStatusFilterState] = useState<string>(
    () => searchParams.get("status") ?? "",
  );
  const { canDispatch, canEdit } = usePermission();
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
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
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

  // Phase tab click: direct state update → triggers fetch via useEffect
  const setSelectedPhase = (value: string) => {
    setPage(0);
    setStatusFilterState("");
    setSelectedPhaseState(value);
  };

  // Sub-status chip click
  const setSubStatusFilter = (status: string) => {
    setPage(0);
    setStatusFilterState(status);
  };

  // Sync state → URL bar (one-way). Uses window.history.replaceState
  // instead of setSearchParams to avoid triggering React Router navigation
  // which can cause stale state re-initialization after rapid toggles.
  useEffect(() => {
    const next = new URLSearchParams();
    if (selectedPhase !== "all") next.set("phase", selectedPhase);
    if (statusFilter) next.set("status", statusFilter);
    const qs = next.toString();
    const url = qs
      ? `${window.location.pathname}?${qs}`
      : window.location.pathname;
    window.history.replaceState(null, "", url);
  }, [selectedPhase, statusFilter]);

  // ── Fetch driven by React state, not URL ──────────────────────
  const fetchIdRef = useRef(0);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const fetchId = ++fetchIdRef.current;

    const params: Record<string, string | number> = {
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    };
    if (statusFilter) {
      params.status = statusFilter;
    } else if (selectedPhase !== "all") {
      params.phase = selectedPhase;
    }
    if (quickSearch.trim()) {
      params.search = quickSearch.trim();
    }

    setIsLoading(true);

    // Debounce 300 ms — absorbs rapid tab clicks without sending extra requests
    const debounceTimer = setTimeout(() => {
      void api.get<{ success: boolean; data: Incident[]; total: number }>(
        '/incidents',
        { params, signal: controller.signal },
      ).then((res) => {
        if (fetchIdRef.current !== fetchId) return;
        setIncidents(res.data.data ?? []);
        setTotal(res.data.total ?? 0);
        setIsLoading(false);
      }).catch((err) => {
        if (fetchIdRef.current !== fetchId) return;
        if (controller.signal.aborted) { setIsLoading(false); return; }
        // 429: keep existing data, just stop the spinner
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 429) { setIsLoading(false); return; }
        console.error('[IncidentListPage] fetch failed:', err);
        setIncidents([]);
        setTotal(0);
        setIsLoading(false);
      });
    }, 300);

    return () => {
      clearTimeout(debounceTimer);
      controller.abort();
    };
  }, [page, selectedPhase, statusFilter, quickSearch, refreshTick]);

  const handleSuccess = useCallback(() => setRefreshTick((t) => t + 1), []);

  useEffect(() => {
    const h = () => setShowActionMenu(null);
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const overdueCount = incidents.filter((i) => isOverdue(i.deadline)).length;

  const handleActionClick = useCallback((incident: Incident, action: string) => {
    setSelectedIncident(incident);
    setShowActionMenu(null);
    if (action === "assign") setShowAssignModal(true);
    else if (action === "prosecute") setShowProsecuteModal(true);
    else if (action === "transition") setShowTransitionModal(true);
  }, []);

  const clearAdvancedFilters = () => {
    setAdvancedFilters({ keyword: "", loaiDonVu: "", benVu: "", tinhTrangHoSo: "", tinhTrangThoiHieu: "", canBoNhap: "", fromDate: "", toDate: "" });
  };

  // Sub-status chips for the selected phase
  const phaseStatuses = selectedPhase !== "all" ? (PHASE_STATUSES[selectedPhase] ?? []) : [];

  // Current phase label for display
  const currentPhaseLabel = selectedPhase !== "all" ? (PHASE_LABELS[selectedPhase] ?? selectedPhase) : "";

  return (
    <div className="p-6 space-y-6" data-testid="incident-list-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Quản lý Vụ việc</h1>
          <p className="text-slate-600 text-sm mt-1">Tiếp nhận, xử lý và quản lý các vụ việc điều tra</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setRefreshTick((t) => t + 1)} className="p-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors" title="Làm mới" data-testid="btn-refresh">
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              const headers = ['STT', 'Mã', 'Tên vụ việc', 'Loại', 'Trạng thái', 'Hạn xử lý', 'Điều tra viên'];
              const rows = incidents.map((i, idx) => [
                idx + 1, i.code ?? i.id?.slice(0, 8) ?? '', i.name,
                (i as any).incidentType ?? '', i.status,
                i.deadline ? new Date(i.deadline).toLocaleDateString('vi-VN') : '',
                i.investigator ? `${(i.investigator as any).firstName ?? ''} ${(i.investigator as any).lastName ?? ''}`.trim() : '',
              ]);
              downloadCsv(rows, headers, `VuViec_${new Date().toISOString().slice(0, 10)}.csv`);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700"
            data-testid="btn-export"
          >
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

      {/* Phase tabs */}
      <div className="bg-white rounded-lg border border-slate-200 p-4" data-testid="phase-filter-bar">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Lọc theo giai đoạn</p>
        <div className="flex flex-wrap gap-2">
          {PHASE_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setSelectedPhase(tab.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                selectedPhase === tab.value
                  ? `${tab.activeColor} border-transparent shadow-sm`
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
              data-testid={`phase-btn-${tab.value}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Sub-status chips within the selected phase */}
        {phaseStatuses.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <p className="text-xs text-slate-500 mb-2">Trạng thái trong {currentPhaseLabel}:</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSubStatusFilter("")}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                  !statusFilter
                    ? "bg-slate-700 text-white border-transparent"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
                data-testid="sub-status-all"
              >
                Tất cả
              </button>
              {phaseStatuses.map((st) => {
                const statusKey = st as IncidentStatus;
                const colorClass = STATUS_COLORS[statusKey] ?? "bg-slate-200 text-slate-700";
                return (
                  <button
                    key={st}
                    onClick={() => setSubStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                      statusFilter === st
                        ? `${colorClass} border-transparent`
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                    data-testid={`sub-status-${st}`}
                  >
                    {STATUS_LABELS_VI[statusKey] ?? st}
                  </button>
                );
              })}
            </div>
          </div>
        )}
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
                <label className="block text-sm font-medium text-slate-700 mb-2">Loại nguồn tin</label>
                <select value={advancedFilters.loaiDonVu} onChange={(e) => setAdvancedFilters({ ...advancedFilters, loaiDonVu: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" data-testid="filter-loaiDonVu">
                  <option value="">-- Tất cả --</option>
                  <option value="TO_GIAC">Tố giác của cá nhân (Đ.144 khoản 1a)</option>
                  <option value="TIN_BAO">Tin báo của cơ quan, tổ chức (Đ.144 khoản 1b)</option>
                  <option value="KIEN_NGHI_KHOI_TO">Kiến nghị khởi tố (Đ.144 khoản 1c)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Người tố giác/báo tin</label>
                <input type="text" value={advancedFilters.benVu} onChange={(e) => setAdvancedFilters({ ...advancedFilters, benVu: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Người tố giác/báo tin..." data-testid="filter-benVu" />
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
            {selectedPhase !== "all" && <span className="ml-2 text-blue-600">(Giai đoạn: {currentPhaseLabel})</span>}
            {statusFilter && <span className="ml-2 text-indigo-600">({STATUS_LABELS_VI[statusFilter as IncidentStatus] ?? statusFilter})</span>}
            {overdueCount > 0 && <span className="ml-2 text-red-600">(<span className="font-medium">{overdueCount}</span> quá hạn)</span>}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full" data-testid="incident-table">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-slate-600 uppercase w-28 sticky left-0 bg-slate-50 z-10 border-r border-slate-200">Thao tác</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase w-12">STT</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Mã vụ việc</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Tên vụ việc</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Đối tượng bị tố giác</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Tóm tắt</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Loại</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">ĐTV Thụ lý</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Đơn vị thụ lý</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Kết quả giải quyết</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Ngày tiếp nhận</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Hạn xử lý</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Trạng thái</th>
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
                      {selectedPhase !== "all" ? "Thử thay đổi giai đoạn hoặc bộ lọc" : "Bắt đầu bằng cách thêm vụ việc mới"}
                    </p>
                  </td>
                </tr>
              ) : (
                incidents.map((incident, index) => {
                  const overdue = isOverdue(incident.deadline);
                  const doiTuong = [incident.doiTuongCaNhan, incident.doiTuongToChuc].filter(Boolean).join(", ") || "—";
                  const canEditRow = canEdit('incidents');
                  return (
                    <tr
                      key={incident.id}
                      data-testid="incident-row"
                      tabIndex={canEditRow ? 0 : undefined}
                      role={canEditRow ? "button" : undefined}
                      onClick={canEditRow ? () => navigate(`/vu-viec/${incident.id}/edit`) : undefined}
                      onKeyDown={canEditRow ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/vu-viec/${incident.id}/edit`); } } : undefined}
                      className={`transition-colors ${overdue ? "bg-red-50/40" : ""} ${canEditRow ? "cursor-pointer hover:bg-blue-50" : "hover:bg-slate-50"}`}
                    >
                      {/* Thao tác — FIRST, sticky, stopPropagation prevents row-click */}
                      <td
                        className={`px-3 py-3 whitespace-nowrap sticky left-0 z-10 border-r border-slate-100 ${overdue ? "bg-red-50/40" : "bg-white"}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-1">
                          <button onClick={() => navigate(`/vu-viec/${incident.id}`)} className="p-2 text-blue-600 hover:bg-blue-50 rounded" title="Xem" data-testid={`btn-view-${incident.id}`}><Eye className="w-4 h-4" /></button>
                          <button onClick={() => navigate(`/vu-viec/${incident.id}/edit`)} className="p-2 text-slate-600 hover:bg-slate-100 rounded" title="Sửa" data-testid={`btn-edit-${incident.id}`}><Edit className="w-4 h-4" /></button>
                          <div className="relative">
                            <button onClick={(e) => { e.stopPropagation(); setShowActionMenu(showActionMenu === incident.id ? null : incident.id); }} className="p-2 text-slate-600 hover:bg-slate-100 rounded" title="Thao tác" data-testid="btn-action-menu"><MoreVertical className="w-4 h-4" /></button>
                            {showActionMenu === incident.id && (
                              <div className="absolute left-10 top-full mt-1 w-60 bg-white border border-slate-200 rounded-lg shadow-lg z-50" onClick={(e) => e.stopPropagation()}>
                                {canDispatch && (
                                  <button onClick={() => handleActionClick(incident, "assign")} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 text-left" data-testid="btn-assign"><User className="w-4 h-4 text-blue-600" />{incident.assignedTeamId ? 'Phân công lại' : 'Phân công'}</button>
                                )}
                                {VALID_TRANSITIONS[incident.status]?.length > 0 && (
                                  <button onClick={() => handleActionClick(incident, "transition")} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 text-left border-t border-slate-100" data-testid="btn-transition">
                                    <ArrowRightLeft className="w-4 h-4 text-indigo-600" />Chuyển trạng thái
                                  </button>
                                )}
                                {incident.status === "DANG_XAC_MINH" && (
                                  <button onClick={() => handleActionClick(incident, "prosecute")} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 text-left border-t border-slate-100" data-testid="btn-prosecute"><Scale className="w-4 h-4 text-red-600" />Khởi tố</button>
                                )}
                                {incident.status === "TIEP_NHAN" && (
                                  <button onClick={() => { setSelectedIncident(incident); setShowDeleteModal(true); setShowActionMenu(null); setDeleteReason(""); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 text-left border-t border-slate-100" data-testid="btn-delete"><Trash2 className="w-4 h-4" />Xóa vụ việc</button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      {/* Regular columns — same order as before */}
                      <td className="px-4 py-3 text-sm text-slate-700 font-medium">{page * PAGE_SIZE + index + 1}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-blue-600">{incident.code}</span>
                          {overdue && <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full" data-testid="overdue-badge">Quá hạn</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700 max-w-[200px] truncate">{incident.name}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 max-w-[150px] truncate">{doiTuong}</td>
                      <td className="px-4 py-3 text-sm text-slate-500 max-w-[180px] truncate">{incident.description || "—"}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{incident.incidentType ?? "—"}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{incident.investigator ? `${incident.investigator.firstName ?? ""} ${incident.investigator.lastName ?? ""}`.trim() || incident.investigator.username : "—"}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{incident.donViGiaiQuyet ?? "—"}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{incident.ketQuaXuLy ?? "—"}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">{formatDate(incident.ngayDeXuat)}</td>
                      <td className="px-4 py-3 whitespace-nowrap"><span className={`text-sm ${overdue ? "text-red-600 font-medium" : "text-slate-700"}`}>{formatDate(incident.deadline)}</span></td>
                      <td className="px-4 py-3 whitespace-nowrap"><span className={`px-3 py-1.5 rounded-md text-xs font-medium ${STATUS_COLORS[incident.status] ?? "bg-slate-200 text-slate-700"}`}>{STATUS_LABELS_VI[incident.status] ?? incident.status}</span></td>
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
      {showAssignModal && selectedIncident && (
        <AssignModal
          open={showAssignModal}
          onClose={() => setShowAssignModal(false)}
          resourceType="incidents"
          recordId={selectedIncident.id}
          currentUpdatedAt={selectedIncident.updatedAt}
          currentTeamId={selectedIncident.assignedTeamId}
          onSuccess={handleSuccess}
        />
      )}
      {showProsecuteModal && selectedIncident && <ProsecuteModal incident={selectedIncident} onClose={() => setShowProsecuteModal(false)} onSuccess={handleSuccess} />}
      {showTransitionModal && selectedIncident && <StatusTransitionModal incident={selectedIncident} onClose={() => setShowTransitionModal(false)} onSuccess={handleSuccess} />}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedIncident && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" data-testid="delete-modal-overlay">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full" data-testid="delete-modal">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Trash2 className="w-6 h-6 text-red-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-slate-800 mb-1">Xóa vụ việc</h3>
                  <p className="text-sm text-slate-600 mb-1">
                    Mã: <strong>{selectedIncident.code}</strong>
                  </p>
                  <p className="text-sm text-slate-600">
                    {selectedIncident.name}
                  </p>
                </div>
              </div>

              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  Vụ việc sẽ bị vô hiệu hóa (soft delete). Quản trị viên có thể khôi phục nếu cần.
                </p>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Lý do xóa <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
                  placeholder="Nhập lý do xóa (ít nhất 10 ký tự). Ví dụ: Nhập sai thông tin, trùng lặp với VV khác..."
                  data-testid="delete-reason-input"
                />
                {deleteReason.length > 0 && deleteReason.length < 10 && (
                  <p className="text-xs text-red-500 mt-1">Cần ít nhất 10 ký tự ({deleteReason.length}/10)</p>
                )}
              </div>
            </div>

            <div className="border-t border-slate-200 p-4 flex gap-3 justify-end">
              <button
                onClick={() => { setShowDeleteModal(false); setDeleteReason(""); }}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                data-testid="btn-cancel-delete"
              >
                Hủy
              </button>
              <button
                onClick={async () => {
                  setIsDeleting(true);
                  try {
                    await api.delete(`/incidents/${selectedIncident.id}`, { data: { reason: deleteReason } });
                    setIncidents((prev) => prev.filter((i) => i.id !== selectedIncident.id));
                    setTotal((t) => t - 1);
                    setShowDeleteModal(false);
                    setDeleteReason("");
                  } catch (err: unknown) {
                    const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
                    const text = Array.isArray(msg) ? msg.join(', ') : (typeof msg === 'string' ? msg : 'Có lỗi xảy ra khi xóa');
                    alert(text);
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                disabled={isDeleting || deleteReason.length < 10}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="btn-confirm-delete"
              >
                {isDeleting ? "Đang xóa..." : "Xác nhận xóa"}
              </button>
            </div>
          </div>
        </div>
      )}
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
      await api.patch(`/incidents/${incident.id}/status`, { status: selectedStatus });
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
