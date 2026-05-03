import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { downloadCsv } from "@/lib/csv";
import {
  Search,
  Filter,
  Plus,
  Eye,
  Edit,
  Trash2,
  Download,
  ChevronDown,
  ChevronUp,
  Calendar,
  Building2,
  User,
  Scale,
  AlertTriangle,
  X,
  RotateCcw,
  MoreVertical,
  Users,
  Briefcase,
  FileText,
  ArrowRightLeft,
  UserCheck,
} from "lucide-react";
import { usePermission } from "@/hooks/usePermission";
import { AssignModal } from "@/components/AssignModal";

// ─────────────────────────────────────────────────────────
// API types — khớp với response của GET /api/v1/cases
// ─────────────────────────────────────────────────────────
type CaseStatus =
  | "TIEP_NHAN"
  | "DANG_XAC_MINH"
  | "DA_XAC_MINH"
  | "DANG_DIEU_TRA"
  | "TAM_DINH_CHI"
  | "DINH_CHI"
  | "DA_KET_LUAN"
  | "DANG_TRUY_TO"
  | "DANG_XET_XU"
  | "DA_LUU_TRU";

interface CaseFromApi {
  id: string;
  name: string;
  crime: string | null;
  status: CaseStatus;
  deadline: string | null;
  unit: string | null;
  subjectsCount: number;
  assignedTeamId: string | null;
  createdAt: string;
  updatedAt: string;
  investigator: {
    id: string;
    firstName?: string;
    lastName?: string;
    username: string;
  } | null;
}

// ─────────────────────────────────────────────────────────
// UI Case interface — dùng trong component
// ─────────────────────────────────────────────────────────
interface Case {
  id: string;
  name: string;
  status: string;
  statusColor: string;
  investigator: string;
  dateCreated: string;
  dateUpdated: string;
  charges: string;
  suspectCount: number;
  investigationDeadline: string | null;
  unit: string;
  assignedTeamId: string | null;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────
// Map CaseStatus enum → nhãn tiếng Việt & màu
// ─────────────────────────────────────────────────────────
const STATUS_LABEL: Record<CaseStatus, string> = {
  TIEP_NHAN:       "Tiếp nhận",
  DANG_XAC_MINH:   "Đang xác minh",
  DA_XAC_MINH:     "Đã xác minh",
  DANG_DIEU_TRA:   "Đang điều tra",
  TAM_DINH_CHI:    "Tạm đình chỉ",
  DINH_CHI:        "Đình chỉ",
  DA_KET_LUAN:     "Đã kết luận",
  DANG_TRUY_TO:    "Đang truy tố",
  DANG_XET_XU:     "Đang xét xử",
  DA_LUU_TRU:      "Đã lưu trữ",
};

const STATUS_COLOR: Record<CaseStatus, string> = {
  TIEP_NHAN:       "text-blue-700 bg-blue-50",
  DANG_XAC_MINH:   "text-cyan-700 bg-cyan-50",
  DA_XAC_MINH:     "text-teal-700 bg-teal-50",
  DANG_DIEU_TRA:   "text-amber-700 bg-amber-50",
  TAM_DINH_CHI:    "text-orange-700 bg-orange-50",
  DINH_CHI:        "text-red-700 bg-red-50",
  DA_KET_LUAN:     "text-indigo-700 bg-indigo-50",
  DANG_TRUY_TO:    "text-purple-700 bg-purple-50",
  DANG_XET_XU:     "text-fuchsia-700 bg-fuchsia-50",
  DA_LUU_TRU:      "text-gray-600 bg-gray-50",
};

// ─────────────────────────────────────────────────────────
// 10 trạng thái vụ án theo nghiệp vụ PC02
// ─────────────────────────────────────────────────────────
const STATUS_BUTTONS = [
  { value: "all",            label: "Tất cả",        color: "bg-slate-100 text-slate-700 hover:bg-slate-200",           activeColor: "bg-slate-700 text-white" },
  { value: "TIEP_NHAN",     label: "Tiếp nhận",      color: "bg-blue-50 text-blue-700 hover:bg-blue-100",              activeColor: "bg-blue-600 text-white" },
  { value: "DANG_XAC_MINH", label: "Đang xác minh",  color: "bg-cyan-50 text-cyan-700 hover:bg-cyan-100",              activeColor: "bg-cyan-600 text-white" },
  { value: "DA_XAC_MINH",   label: "Đã xác minh",    color: "bg-teal-50 text-teal-700 hover:bg-teal-100",              activeColor: "bg-teal-600 text-white" },
  { value: "DANG_DIEU_TRA", label: "Đang điều tra",  color: "bg-amber-50 text-amber-700 hover:bg-amber-100",           activeColor: "bg-amber-600 text-white" },
  { value: "TAM_DINH_CHI",  label: "Tạm đình chỉ",   color: "bg-orange-50 text-orange-700 hover:bg-orange-100",        activeColor: "bg-orange-600 text-white" },
  { value: "DINH_CHI",      label: "Đình chỉ",        color: "bg-red-50 text-red-700 hover:bg-red-100",                 activeColor: "bg-red-600 text-white" },
  { value: "DA_KET_LUAN",   label: "Đã kết luận",    color: "bg-indigo-50 text-indigo-700 hover:bg-indigo-100",        activeColor: "bg-indigo-600 text-white" },
  { value: "DANG_TRUY_TO",  label: "Đang truy tố",   color: "bg-purple-50 text-purple-700 hover:bg-purple-100",        activeColor: "bg-purple-600 text-white" },
  { value: "DANG_XET_XU",   label: "Đang xét xử",    color: "bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-100",     activeColor: "bg-fuchsia-600 text-white" },
  { value: "DA_LUU_TRU",    label: "Đã lưu trữ",     color: "bg-gray-50 text-gray-600 hover:bg-gray-100",              activeColor: "bg-gray-500 text-white" },
];

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────
function mapApiCase(c: CaseFromApi): Case {
  const investigatorName = c.investigator
    ? [c.investigator.firstName, c.investigator.lastName].filter(Boolean).join(" ") || c.investigator.username
    : "—";

  return {
    id:                   c.id,
    name:                 c.name,
    status:               STATUS_LABEL[c.status] ?? c.status,
    statusColor:          STATUS_COLOR[c.status] ?? "text-slate-600 bg-slate-50",
    investigator:         investigatorName,
    dateCreated:          new Date(c.createdAt).toLocaleDateString("vi-VN"),
    dateUpdated:          new Date(c.updatedAt).toLocaleDateString("vi-VN"),
    charges:              c.crime ?? "—",
    suspectCount:         c.subjectsCount,
    investigationDeadline: c.deadline,
    unit:                 c.unit ?? "—",
    assignedTeamId:       c.assignedTeamId,
    updatedAt:            c.updatedAt,
  };
}

function isOverdue(deadline: string | null): boolean {
  if (!deadline) return false;
  const deadlineDate = new Date(deadline);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return deadlineDate < today;
}

function getDaysOverdue(deadline: string | null): number {
  if (!deadline) return 0;
  const deadlineDate = new Date(deadline);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffTime = today.getTime() - deadlineDate.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function formatDeadline(deadline: string | null): string {
  if (!deadline) return "—";
  try { return new Date(deadline).toLocaleDateString("vi-VN"); } catch { return deadline; }
}

// ─────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────
function CaseListPage() {
  const navigate = useNavigate();
  const { canDispatch, canEdit } = usePermission();
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;
  const [caseList, setCaseList] = useState<Case[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filters, setFilters] = useState({
    fromDate: "",
    toDate: "",
    unit: "",
    investigator: "",
    charges: "",
  });

  // ── Action dropdown menu ──────────────────────────────
  const [showActionMenu, setShowActionMenu] = useState<string | null>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);

  // ── Vô hiệu hóa (soft delete) ────────────────────────
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [caseToDeactivate, setCaseToDeactivate] = useState<Case | null>(null);
  const [deactivateLoading, setDeactivateLoading] = useState(false);

  // ── Phân công (dispatcher only) ───────────────────────
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);



  // ── Click-outside để đóng dropdown ───────────────────
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
        setShowActionMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Fetch data từ API ─────────────────────────────────
  const fetchCases = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get<{ success: boolean; data: CaseFromApi[]; total: number }>(
        "/cases",
        { params: { limit: 100 } },
      );
      setCaseList((res.data.data ?? []).map(mapApiCase));
    } catch (err) {
      console.error("[CaseListPage] Failed to fetch cases:", err);
      setCaseList([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void fetchCases(); }, [fetchCases]);

  const updateFilter = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({ fromDate: "", toDate: "", unit: "", investigator: "", charges: "" });
    setCurrentPage(1);
  };

  const hasActiveFilters = Object.values(filters).some((v) => v !== "");

  // ── Client-side filtering ─────────────────────────────
  const filteredCases = caseList.filter((c) => {
    const matchesSearch =
      c.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.investigator.toLowerCase().includes(searchQuery.toLowerCase());

    // selectedStatus so sánh với status label tiếng Việt hoặc enum key
    const matchesStatus =
      selectedStatus === "all" ||
      c.status === (STATUS_LABEL[selectedStatus as CaseStatus] ?? selectedStatus);

    const matchesUnit = !filters.unit || c.unit === filters.unit;
    const matchesInvestigator = !filters.investigator || c.investigator === filters.investigator;
    const matchesCharges = !filters.charges || c.charges === filters.charges;

    return matchesSearch && matchesStatus && matchesUnit && matchesInvestigator && matchesCharges;
  });

  const overdueCount = filteredCases.filter((c) => isOverdue(c.investigationDeadline)).length;
  const totalPages = Math.max(1, Math.ceil(filteredCases.length / PAGE_SIZE));
  const displayedCases = filteredCases.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // ── Xử lý xóa ──────────────────────────────────────
  // ── Xử lý vô hiệu hóa ─────────────────────────────────
  const openDeactivateDialog = (caseItem: Case) => {
    setCaseToDeactivate(caseItem);
    setDeactivateDialogOpen(true);
    setShowActionMenu(null);
  };

  const closeDeactivateDialog = () => {
    setDeactivateDialogOpen(false);
    setCaseToDeactivate(null);
  };

  const confirmDeactivate = async () => {
    if (!caseToDeactivate) return;
    setDeactivateLoading(true);
    try {
      await api.delete(`/cases/${caseToDeactivate.id}`);
      setCaseList((prev) => prev.filter((c) => c.id !== caseToDeactivate.id));
      closeDeactivateDialog();
    } catch (err) {
      console.error("[CaseListPage] Deactivate error:", err);
      alert("Vô hiệu hóa vụ án thất bại. Vui lòng thử lại.");
    } finally {
      setDeactivateLoading(false);
    }
  };

  // ── Render ──────────────────────────────────────────
  return (
    <div className="p-6 space-y-6" data-testid="case-list-page">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Danh sách vụ án</h1>
          <p className="text-slate-600 text-sm mt-1">
            Quản lý toàn bộ vụ án trong hệ thống
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void fetchCases()}
            className="p-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            title="Làm mới"
            data-testid="btn-refresh"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigate("/add-new-record")}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            data-testid="btn-add-case"
          >
            <Plus className="w-4 h-4" />
            Thêm vụ án mới
          </button>
        </div>
      </div>

      {/* ── Cảnh báo quá hạn ───────────────────────────── */}
      {overdueCount > 0 && (
        <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 flex items-center gap-3" data-testid="overdue-alert">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">
              Cảnh báo: Có <span className="font-bold">{overdueCount}</span> vụ án đã quá hạn điều tra cần xử lý gấp
            </p>
          </div>
        </div>
      )}

      {/* ── Bộ lọc 10 trạng thái (button group) ────────── */}
      <div className="bg-white rounded-lg border border-slate-200 p-4" data-testid="status-filter-bar">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Lọc theo trạng thái</p>
        <div className="flex flex-wrap gap-2">
          {STATUS_BUTTONS.map((btn) => (
            <button
              key={btn.value}
              onClick={() => setSelectedStatus(btn.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                selectedStatus === btn.value
                  ? `${btn.activeColor} border-transparent shadow-sm`
                  : `${btn.color} border-transparent`
              }`}
              data-testid={`status-btn-${btn.value}`}
            >
              {btn.label}
              {btn.value !== "all" && (
                <span className="ml-1.5 opacity-70">
                  ({caseList.filter((c) => c.status === (STATUS_LABEL[btn.value as CaseStatus] ?? btn.value)).length})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tìm kiếm & Bộ lọc nâng cao ─────────────────── */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm theo mã vụ án, tên vụ án, điều tra viên..."
                className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                data-testid="search-input"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg transition-colors ${
                showAdvancedFilters || hasActiveFilters
                  ? "border-blue-500 text-blue-600 bg-blue-50"
                  : "border-slate-300 text-slate-700 hover:bg-slate-50"
              }`}
              data-testid="btn-advanced-filter"
            >
              <Filter className="w-4 h-4" />
              Bộ lọc nâng cao
              {hasActiveFilters && (
                <span className="w-5 h-5 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center">
                  {Object.values(filters).filter((v) => v !== "").length}
                </span>
              )}
              {showAdvancedFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            <button
              onClick={() => {
                const headers = ['STT', 'Mã vụ án', 'Tên vụ án', 'Điều tra viên', 'Đơn vị', 'Tội danh', 'Trạng thái', 'Hạn điều tra'];
                const rows = filteredCases.map((c, i) => [
                  i + 1, c.id.slice(0, 8).toUpperCase(), c.name, c.investigator,
                  c.unit, c.charges, c.status,
                  c.investigationDeadline ? new Date(c.investigationDeadline).toLocaleDateString('vi-VN') : '',
                ]);
                downloadCsv(rows, headers, `VuAn_${new Date().toISOString().slice(0, 10)}.csv`);
              }}
              className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              Xuất báo cáo
            </button>
          </div>
        </div>

        {/* ── Bộ lọc nâng cao ────────────────────────────── */}
        {showAdvancedFilters && (
          <div className="mt-4 pt-4 border-t border-slate-200" data-testid="advanced-filters">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-slate-700">Bộ lọc nâng cao</h3>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  data-testid="btn-clear-filters"
                >
                  <X className="w-4 h-4" />
                  Xóa bộ lọc
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Từ ngày</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="date"
                    value={filters.fromDate}
                    onChange={(e) => updateFilter("fromDate", e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    data-testid="filter-from-date"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Đến ngày</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="date"
                    value={filters.toDate}
                    onChange={(e) => updateFilter("toDate", e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    data-testid="filter-to-date"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Đơn vị</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={filters.unit}
                    onChange={(e) => updateFilter("unit", e.target.value)}
                    placeholder="Lọc theo đơn vị..."
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    data-testid="filter-unit"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Điều tra viên</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={filters.investigator}
                    onChange={(e) => updateFilter("investigator", e.target.value)}
                    placeholder="Lọc theo điều tra viên..."
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    data-testid="filter-investigator"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Tội danh</label>
                <div className="relative">
                  <Scale className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={filters.charges}
                    onChange={(e) => updateFilter("charges", e.target.value)}
                    placeholder="Lọc theo tội danh..."
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    data-testid="filter-charges"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Bảng danh sách ─────────────────────────────── */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="px-6 py-16 flex flex-col items-center gap-3 text-slate-500" data-testid="loading-state">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            <p className="text-sm">Đang tải danh sách vụ án...</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="case-table">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider w-28 sticky left-0 bg-slate-50 z-10 border-r border-slate-200">
                      Thao tác
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                      Mã vụ án
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                      Tên vụ án
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                      Trạng thái
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                      Tội danh
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                      Số bị can
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                      Hạn điều tra
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                      Điều tra viên
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                      Ngày tạo
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {displayedCases.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center gap-2" data-testid="no-results">
                          <Search className="w-10 h-10 text-slate-300" />
                          <p className="text-slate-600 font-medium">Không tìm thấy kết quả</p>
                          <p className="text-slate-500 text-sm">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    displayedCases.map((caseItem) => {
                      const overdue = isOverdue(caseItem.investigationDeadline);
                      const daysOverdue = getDaysOverdue(caseItem.investigationDeadline);
                      const canEditRow = canEdit('cases');
                      return (
                        <tr
                          key={caseItem.id}
                          data-testid={`case-row-${caseItem.id}`}
                          tabIndex={canEditRow ? 0 : undefined}
                          role={canEditRow ? "button" : undefined}
                          onClick={canEditRow ? () => navigate(`/cases/${caseItem.id}/edit`) : undefined}
                          onKeyDown={canEditRow ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/cases/${caseItem.id}/edit`); } } : undefined}
                          className={`transition-colors ${overdue ? "bg-red-50/50" : ""} ${canEditRow ? "cursor-pointer hover:bg-blue-50" : "hover:bg-slate-50"}`}
                        >
                          {/* Thao tác — FIRST, sticky */}
                          <td
                            className={`px-3 py-4 whitespace-nowrap sticky left-0 z-10 border-r border-slate-100 ${overdue ? "bg-red-50/50" : "bg-white"}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => navigate(`/cases/${caseItem.id}`)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="Xem chi tiết"
                                data-testid={`btn-view-${caseItem.id}`}
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => navigate(`/cases/${caseItem.id}/edit`)}
                                className="p-2 text-slate-600 hover:bg-slate-100 rounded transition-colors"
                                title="Chỉnh sửa"
                                data-testid={`btn-edit-${caseItem.id}`}
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              {/* ⋮ Action menu */}
                              <div className="relative" ref={showActionMenu === caseItem.id ? actionMenuRef : null}>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setShowActionMenu(showActionMenu === caseItem.id ? null : caseItem.id); }}
                                  className="p-2 text-slate-600 hover:bg-slate-100 rounded transition-colors"
                                  title="Thao tác khác"
                                  data-testid={`btn-more-${caseItem.id}`}
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </button>
                                {showActionMenu === caseItem.id && (
                                  <div className="absolute left-0 top-full mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-50" onClick={(e) => e.stopPropagation()}>
                                    {/* Phân công (dispatcher only) */}
                                    {canDispatch && (
                                      <button
                                        onClick={() => {
                                          setShowActionMenu(null);
                                          setSelectedCase(caseItem);
                                          setShowAssignModal(true);
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
                                        data-testid={`btn-assign-${caseItem.id}`}
                                      >
                                        <UserCheck className="w-4 h-4 text-green-600 flex-shrink-0" />
                                        {caseItem.assignedTeamId ? "Phân công lại" : "Phân công"}
                                      </button>
                                    )}
                                    {/* Quản lý bị can */}
                                    <button
                                      onClick={() => {
                                        setShowActionMenu(null);
                                        navigate(`/cases/${caseItem.id}`, { state: { activeTab: "defendants" } });
                                      }}
                                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left${canDispatch ? " border-t border-slate-100" : ""}`}
                                      data-testid={`btn-manage-defendants-${caseItem.id}`}
                                    >
                                      <Users className="w-4 h-4 text-blue-600 flex-shrink-0" />
                                      Quản lý bị can
                                    </button>
                                    {/* Quản lý luật sư */}
                                    <button
                                      onClick={() => {
                                        setShowActionMenu(null);
                                        navigate(`/cases/${caseItem.id}`, { state: { activeTab: "lawyers" } });
                                      }}
                                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left border-t border-slate-100"
                                      data-testid={`btn-manage-lawyers-${caseItem.id}`}
                                    >
                                      <Briefcase className="w-4 h-4 text-purple-600 flex-shrink-0" />
                                      Quản lý luật sư
                                    </button>
                                    {/* Kết luận điều tra */}
                                    <button
                                      onClick={() => {
                                        setShowActionMenu(null);
                                        navigate(`/cases/${caseItem.id}`, { state: { activeTab: "conclusion" } });
                                      }}
                                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left border-t border-slate-100"
                                      data-testid={`btn-conclusion-${caseItem.id}`}
                                    >
                                      <FileText className="w-4 h-4 text-green-600 flex-shrink-0" />
                                      Kết luận điều tra
                                    </button>
                                    {/* Chuyển xử lý */}
                                    <button
                                      onClick={() => {
                                        setShowActionMenu(null);
                                        navigate("/transfer-return", {
                                          state: {
                                            preselectedRecord: { id: caseItem.id, caseNumber: caseItem.id.slice(0, 8).toUpperCase() },
                                            sourceScreen: "cases",
                                          },
                                        });
                                      }}
                                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left border-t border-slate-100"
                                      data-testid={`btn-transfer-${caseItem.id}`}
                                    >
                                      <ArrowRightLeft className="w-4 h-4 text-slate-500 flex-shrink-0" />
                                      Chuyển xử lý
                                    </button>
                                    {/* Vô hiệu hóa */}
                                    <button
                                      onClick={() => openDeactivateDialog(caseItem)}
                                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors text-left border-t border-slate-100"
                                      data-testid={`btn-deactivate-${caseItem.id}`}
                                    >
                                      <Trash2 className="w-4 h-4 flex-shrink-0" />
                                      Vô hiệu hóa
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          {/* Regular columns */}
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-blue-600 font-mono">{caseItem.id.slice(0, 8)}…</span>
                              {overdue && <span className="px-2 py-0.5 text-xs font-bold text-white bg-red-600 rounded animate-pulse" data-testid={`overdue-badge-${caseItem.id}`} title={`Quá hạn ${daysOverdue} ngày`}>Quá hạn</span>}
                            </div>
                          </td>
                          <td className="px-4 py-4"><span className="text-sm text-slate-800 line-clamp-2">{caseItem.name}</span></td>
                          <td className="px-4 py-4 whitespace-nowrap"><span className={`px-2.5 py-1 rounded-full text-xs font-medium ${caseItem.statusColor}`}>{caseItem.status}</span></td>
                          <td className="px-4 py-4"><span className="text-sm text-slate-700 line-clamp-1">{caseItem.charges}</span></td>
                          <td className="px-4 py-4 whitespace-nowrap"><span className="text-sm font-medium text-slate-800">{caseItem.suspectCount}</span></td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span className={`text-sm ${overdue ? "text-red-600 font-medium" : "text-slate-600"}`}>
                              {formatDeadline(caseItem.investigationDeadline)}{overdue && <span className="ml-1">(-{daysOverdue} ngày)</span>}
                            </span>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap"><span className="text-sm text-slate-700">{caseItem.investigator}</span></td>
                          <td className="px-4 py-4 whitespace-nowrap"><span className="text-sm text-slate-600">{caseItem.dateCreated}</span></td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* ── Phân trang ─────────────────────────────────── */}
            <div className="border-t border-slate-200 px-6 py-4 flex items-center justify-between">
              <div className="text-sm text-slate-600">
                Hiển thị <span className="font-medium">{filteredCases.length}</span> trên{" "}
                <span className="font-medium">{caseList.length}</span> vụ án
                {overdueCount > 0 && (
                  <span className="ml-2 text-red-600">
                    (<span className="font-medium">{overdueCount}</span> quá hạn)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Trước</button>
                <span className="px-3 py-2 text-sm font-medium text-slate-700">Trang {currentPage}/{totalPages}</span>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Sau</button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Modal phân công ────────────────────────────── */}
      {showAssignModal && selectedCase && (
        <AssignModal
          open={showAssignModal}
          onClose={() => { setShowAssignModal(false); setSelectedCase(null); }}
          resourceType="cases"
          recordId={selectedCase.id}
          currentUpdatedAt={selectedCase.updatedAt}
          currentTeamId={selectedCase.assignedTeamId}
          onSuccess={() => { setShowAssignModal(false); setSelectedCase(null); void fetchCases(); }}
        />
      )}

      {/* ── Dialog xác nhận vô hiệu hóa ───────────────── */}
      {deactivateDialogOpen && caseToDeactivate && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          data-testid="deactivate-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="deactivate-dialog-title"
        >
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            {/* Header */}
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                    <Trash2 className="w-5 h-5 text-red-600" />
                  </div>
                  <h3 id="deactivate-dialog-title" className="text-lg font-bold text-slate-800">
                    Vô hiệu hóa vụ án
                  </h3>
                </div>
                <button
                  onClick={closeDeactivateDialog}
                  className="p-1 hover:bg-slate-100 rounded transition-colors"
                  aria-label="Đóng"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <p className="text-slate-700">
                Vụ án này sẽ bị vô hiệu hóa và không còn hiển thị trong danh sách. Bạn có chắc chắn muốn thực hiện?
              </p>
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm font-medium text-red-900">
                  Mã vụ án: <span className="font-bold font-mono">{caseToDeactivate.id.slice(0, 12)}…</span>
                </p>
                <p className="text-sm text-red-800 mt-1 line-clamp-2">{caseToDeactivate.name}</p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                onClick={closeDeactivateDialog}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                data-testid="btn-cancel-deactivate"
              >
                Hủy bỏ
              </button>
              <button
                onClick={() => void confirmDeactivate()}
                disabled={deactivateLoading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="btn-confirm-deactivate"
              >
                {deactivateLoading ? "Đang xử lý..." : "Vô hiệu hóa"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default CaseListPage;
