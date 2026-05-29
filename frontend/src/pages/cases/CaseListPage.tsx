import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { downloadCsv } from "@/lib/csv";
import { formatVNDate } from "../../lib/dates";
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
import { useBulkSelection } from "@/features/_shared/bulk/useBulkSelection";
import { BulkActionBar } from "@/features/_shared/bulk/BulkActionBar";
import {
  BulkSelectionHeaderCell,
  BulkSelectionRowCell,
} from "@/features/_shared/bulk/BulkSelectionColumn";
import { InlineResultPanel } from "@/features/_shared/bulk/InlineResultPanel";
import { buildCasesAdapter } from "@/features/_shared/bulk/adapters/cases";
import type { BulkResult } from "@/features/_shared/bulk/types";
import { AssignModal } from "@/components/AssignModal";
import { ActionMenuPortal } from "@/components/ActionMenuPortal";
import { StatusBadge } from "@/components/shared/StatusBadge";

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
  caseCode: string | null;
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
  caseCode: string | null;
  name: string;
  status: string;
  statusRaw: CaseStatus; // v0.31.0.2: raw enum cho delete guard
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
    caseCode:             c.caseCode ?? null,
    name:                 c.name,
    status:               STATUS_LABEL[c.status] ?? c.status,
    statusRaw:            c.status,
    statusColor:          STATUS_COLOR[c.status] ?? "text-slate-600 bg-slate-50",
    investigator:         investigatorName,
    dateCreated:          formatVNDate(c.createdAt),
    dateUpdated:          formatVNDate(c.updatedAt),
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
  return formatVNDate(deadline);
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

  // ── Action dropdown menu (v0.31.0.1 — Portal-based, state-anchor) ────
  const [openMenu, setOpenMenu] = useState<{ id: string; anchor: HTMLElement } | null>(null);

  // ── Xóa vụ án — v0.31.0.2 (mirror Incident + UX deltas: preflight, banner, chips, focus) ────
  const [caseToDelete, setCaseToDelete] = useState<Case | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [preflight, setPreflight] = useState<{
    canDelete: boolean;
    blockers: Record<string, number>;
    reasonsIfBlocked: string[];
    willUnlink?: { incidents: Array<{ id: string; code: string; name: string }> };
  } | null>(null);
  const [preflightLoading, setPreflightLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const deleteTriggerRef = useRef<HTMLButtonElement | null>(null);
  const deleteTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  // ── Phân công (dispatcher only) ───────────────────────
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);



  // v0.31.0.1 — click-outside handled internally by ActionMenuPortal.

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

  // ── Bulk action infrastructure (v0.48 PR1) ────────────────────────────────
  const bulkSelection = useBulkSelection<Case>({
    rowKey: "id",
    pageRows: displayedCases,
  });
  // v0.48 PR1 enableAssign=false (chỉ ship export). Assign action chờ team picker
  // modal ở PR sau. Filter chips banner cho "select all matching filter" cũng defer.
  const bulkAdapter = buildCasesAdapter();
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null);
  const [bulkResultLabel, setBulkResultLabel] = useState("");

  // ── Xóa vụ án (v0.31.0.2) — mirror Incident + UX deltas ────────────────
  const openDeleteModal = (caseItem: Case, trigger: HTMLButtonElement | null) => {
    setCaseToDelete(caseItem);
    setDeleteReason("");
    setDeleteError(null);
    setPreflight(null);
    setOpenMenu(null);
    deleteTriggerRef.current = trigger;
    // Fire preflight check
    setPreflightLoading(true);
    api
      .get<{ success: boolean; data: { canDelete: boolean; blockers: Record<string, number>; reasonsIfBlocked: string[] } }>(
        `/cases/${caseItem.id}/delete-preflight`,
      )
      .then((res) => setPreflight(res.data.data ?? res.data as unknown as typeof preflight))
      .catch((err) => {
        console.error("[CaseListPage] Preflight failed:", err);
        // Preflight failure không block — chỉ cảnh báo
        setDeleteError("Không thể kiểm tra điều kiện xóa. Có thể submit nếu bạn chắc chắn.");
      })
      .finally(() => setPreflightLoading(false));
  };

  const closeDeleteModal = () => {
    setCaseToDelete(null);
    setDeleteReason("");
    setDeleteError(null);
    setPreflight(null);
    // Return focus to triggering ⋮ button for keyboard a11y
    if (deleteTriggerRef.current) {
      deleteTriggerRef.current.focus();
      deleteTriggerRef.current = null;
    }
  };

  const confirmDelete = async () => {
    if (!caseToDelete || deleteReason.trim().length < 10) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await api.delete(`/cases/${caseToDelete.id}`, { data: { reason: deleteReason.trim() } });
      setCaseList((prev) => prev.filter((c) => c.id !== caseToDelete.id));
      setSuccessMessage(`Đã xóa vụ án "${caseToDelete.name.slice(0, 50)}${caseToDelete.name.length > 50 ? "…" : ""}". Quản trị viên có thể khôi phục tại trang /admin/khoi-phuc.`);
      closeDeleteModal();
      // Auto-dismiss success banner sau 5s
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string | string[] } } };
      const msg = e?.response?.data?.message;
      const text = Array.isArray(msg) ? msg.join(", ") : msg ?? "Xóa vụ án thất bại. Vui lòng thử lại.";
      setDeleteError(text);
    } finally {
      setIsDeleting(false);
    }
  };

  // Escape handler + autofocus
  useEffect(() => {
    if (!caseToDelete) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isDeleting) closeDeleteModal();
    };
    document.addEventListener("keydown", onKey);
    // Focus textarea after mount
    setTimeout(() => deleteTextareaRef.current?.focus(), 50);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseToDelete, isDeleting]);

  // 4 quick-fill chips (Vietnamese audit-friendly templates)
  const QUICK_REASONS = [
    "Nhập sai thông tin vụ án",
    "Trùng lặp với vụ án khác",
    "Sai phân loại ban đầu",
    "Dữ liệu test thử nghiệm",
  ];

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

      {/* ── Success banner (v0.31.0.2 — sau xóa) ─────────────────────── */}
      {successMessage && (
        <div
          className="bg-green-50 border-2 border-green-300 rounded-lg p-3 flex items-center gap-3"
          data-testid="success-banner"
          role="status"
        >
          <UserCheck className="w-5 h-5 text-green-600 flex-shrink-0" />
          <p className="text-sm font-medium text-green-800 flex-1">{successMessage}</p>
          <button onClick={() => setSuccessMessage(null)} className="p-1 hover:bg-green-100 rounded" aria-label="Đóng">
            <X className="w-4 h-4 text-green-700" />
          </button>
        </div>
      )}

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
                  i + 1, (c.caseCode ?? c.id.slice(0, 8).toUpperCase()), c.name, c.investigator,
                  c.unit, c.charges, c.status,
                  formatVNDate(c.investigationDeadline),
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
            {bulkResult && (
              <InlineResultPanel
                result={bulkResult}
                actionLabel={bulkResultLabel}
                resourceLabel="vụ án"
                onDismiss={() => setBulkResult(null)}
              />
            )}
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="case-table">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <BulkSelectionHeaderCell selection={bulkSelection} totalRowsLabel="vụ án" />
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
                      <td colSpan={10} className="px-6 py-12 text-center">
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
                          <BulkSelectionRowCell
                            id={caseItem.id}
                            selection={bulkSelection}
                            rowLabel={`vụ án ${caseItem.caseCode ?? caseItem.id}`}
                          />
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
                              {/* ⋮ Action menu (v0.31.0.1 — Portal rendered at component level below) */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenu(
                                    openMenu?.id === caseItem.id
                                      ? null
                                      : { id: caseItem.id, anchor: e.currentTarget },
                                  );
                                }}
                                className="p-2 text-slate-600 hover:bg-slate-100 rounded transition-colors"
                                title="Thao tác khác"
                                data-testid={`btn-more-${caseItem.id}`}
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                          {/* Regular columns */}
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-blue-600 font-mono">{caseItem.caseCode ?? caseItem.id.slice(0, 8) + '…'}</span>
                              {overdue && <span className="px-2 py-0.5 text-xs font-bold text-white bg-red-600 rounded animate-pulse" data-testid={`overdue-badge-${caseItem.id}`} title={`Quá hạn ${daysOverdue} ngày`}>Quá hạn</span>}
                            </div>
                          </td>
                          <td className="px-4 py-4"><span className="text-sm text-slate-800 line-clamp-2">{caseItem.name}</span></td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <StatusBadge
                              label={caseItem.status}
                              color={caseItem.statusColor}
                              className="rounded-full px-2.5"
                              data-testid={`status-badge-${caseItem.id}`}
                            />
                          </td>
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

      {/* v0.31.0.1 — Action menu via Portal (escapes parent overflow-hidden) */}
      {openMenu && (() => {
        const caseItem = caseList.find((c) => c.id === openMenu.id);
        if (!caseItem) return null;
        return (
          <ActionMenuPortal anchor={openMenu.anchor} open={true} onClose={() => setOpenMenu(null)}>
            {canDispatch && (
              <button
                onClick={() => {
                  setOpenMenu(null);
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
            <button
              onClick={() => {
                setOpenMenu(null);
                navigate(`/cases/${caseItem.id}`, { state: { activeTab: "defendants" } });
              }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left${canDispatch ? " border-t border-slate-100" : ""}`}
              data-testid={`btn-manage-defendants-${caseItem.id}`}
            >
              <Users className="w-4 h-4 text-blue-600 flex-shrink-0" />
              Quản lý bị can
            </button>
            <button
              onClick={() => {
                setOpenMenu(null);
                navigate(`/cases/${caseItem.id}`, { state: { activeTab: "lawyers" } });
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left border-t border-slate-100"
              data-testid={`btn-manage-lawyers-${caseItem.id}`}
            >
              <Briefcase className="w-4 h-4 text-purple-600 flex-shrink-0" />
              Quản lý luật sư
            </button>
            <button
              onClick={() => {
                setOpenMenu(null);
                navigate(`/cases/${caseItem.id}`, { state: { activeTab: "conclusion" } });
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left border-t border-slate-100"
              data-testid={`btn-conclusion-${caseItem.id}`}
            >
              <FileText className="w-4 h-4 text-green-600 flex-shrink-0" />
              Kết luận điều tra
            </button>
            <button
              onClick={() => {
                setOpenMenu(null);
                navigate("/transfer-return", {
                  state: {
                    preselectedRecord: { id: caseItem.id, caseNumber: (caseItem.caseCode ?? caseItem.id.slice(0, 8).toUpperCase()) },
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
            {/* v0.31.0.2: "Xóa vụ án" — visible always, disabled khi status !== TIEP_NHAN */}
            {(() => {
              const canDelete = caseItem.statusRaw === "TIEP_NHAN";
              return (
                <button
                  onClick={(e) => {
                    if (!canDelete) return;
                    openDeleteModal(caseItem, e.currentTarget as HTMLButtonElement);
                  }}
                  disabled={!canDelete}
                  title={
                    canDelete
                      ? "Xóa vụ án (cần ghi nhận lý do)"
                      : `Chỉ xóa được khi trạng thái = Tiếp nhận. Hiện tại: ${caseItem.status}.`
                  }
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left border-t border-slate-100 transition-colors ${
                    canDelete
                      ? "text-red-600 hover:bg-red-50"
                      : "text-slate-400 cursor-not-allowed bg-slate-50"
                  }`}
                  data-testid={`btn-delete-${caseItem.id}`}
                >
                  <Trash2 className="w-4 h-4 flex-shrink-0" />
                  Xóa vụ án
                </button>
              );
            })()}
          </ActionMenuPortal>
        );
      })()}

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

      {/* ── Delete vụ án modal (v0.31.0.2) ────────────────────── */}
      {caseToDelete && (() => {
        const reasonLen = deleteReason.length;
        const reasonValid = reasonLen >= 10;
        const blocked = preflight && !preflight.canDelete;
        const canSubmit = reasonValid && !isDeleting && !blocked && !preflightLoading;
        return (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            data-testid="delete-modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
          >
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" data-testid="delete-modal">
              {/* Header */}
              <div className="p-5 border-b border-slate-200 flex items-start gap-4">
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Trash2 className="w-6 h-6 text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 id="delete-modal-title" className="text-lg font-bold text-slate-800">Xóa vụ án</h3>
                  <p className="text-sm text-slate-600 mt-0.5 font-mono">
                    Mã: <strong>{caseToDelete.caseCode ?? caseToDelete.id.slice(0, 12) + '…'}</strong>
                  </p>
                  <p className="text-sm text-slate-600 mt-0.5 line-clamp-2">{caseToDelete.name}</p>
                </div>
                <button
                  onClick={closeDeleteModal}
                  disabled={isDeleting}
                  className="p-1 hover:bg-slate-100 rounded transition-colors disabled:opacity-50"
                  aria-label="Đóng"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4">
                {/* Pre-flight blocker banner */}
                {preflightLoading && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600" data-testid="preflight-loading">
                    Đang kiểm tra điều kiện xóa...
                  </div>
                )}
                {blocked && (
                  <div className="p-3 bg-red-50 border border-red-300 rounded-lg" data-testid="delete-blockers">
                    <p className="text-sm font-semibold text-red-900 mb-2">Không thể xóa — phải xử lý các vướng mắc sau:</p>
                    <ul className="list-disc list-inside text-sm text-red-800 space-y-1">
                      {preflight.reasonsIfBlocked.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {!blocked && !preflightLoading && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-800">
                      Vụ án sẽ bị xóa mềm (soft delete) và ghi vào nhật ký kiểm toán. Quản trị viên có thể khôi phục tại trang Khôi phục dữ liệu (/admin/khoi-phuc).
                    </p>
                  </div>
                )}

                {/* willUnlink warning — linked incidents will be unlinked (not deleted) */}
                {!preflightLoading && (preflight?.willUnlink?.incidents?.length ?? 0) > 0 && (
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg" data-testid="will-unlink-incidents">
                    <p className="text-sm font-medium text-orange-800">
                      Xóa sẽ gỡ liên kết {preflight!.willUnlink!.incidents.length} vụ việc:
                    </p>
                    <ul className="mt-1 list-disc list-inside text-sm text-orange-700 space-y-0.5">
                      {preflight!.willUnlink!.incidents.map((inc) => (
                        <li key={inc.id}>{inc.code} — {inc.name}</li>
                      ))}
                    </ul>
                    <p className="mt-1 text-xs text-orange-600">Các vụ việc này vẫn tồn tại nhưng sẽ không còn gắn với vụ án.</p>
                  </div>
                )}

                {/* Quick-fill chips */}
                <div className="flex flex-wrap gap-2" data-testid="quick-reason-chips">
                  {QUICK_REASONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => { setDeleteReason(r); deleteTextareaRef.current?.focus(); }}
                      className="px-3 py-1 text-xs rounded-full bg-slate-100 text-slate-700 hover:bg-blue-100 hover:text-blue-700 transition-colors"
                    >
                      {r}
                    </button>
                  ))}
                </div>

                {/* Reason textarea + counter */}
                <div>
                  <label htmlFor="delete-reason-input" className="block text-sm font-medium text-slate-700 mb-1">
                    Lý do xóa <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="delete-reason-input"
                    ref={deleteTextareaRef}
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value.slice(0, 500))}
                    rows={3}
                    maxLength={500}
                    disabled={isDeleting}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-sm disabled:bg-slate-50"
                    placeholder="Nhập lý do xóa (ít nhất 10 ký tự). Ví dụ: Nhập sai thông tin, trùng lặp với vụ án khác..."
                    data-testid="delete-reason-input"
                  />
                  <div className="flex items-center justify-between mt-1">
                    {!reasonValid && reasonLen > 0 ? (
                      <p className="text-xs text-red-500">Cần ít nhất 10 ký tự</p>
                    ) : (
                      <span />
                    )}
                    <p className={`text-xs ${reasonLen < 10 ? "text-red-500" : reasonLen > 480 ? "text-amber-600" : "text-slate-500"}`} data-testid="reason-counter">
                      {reasonLen}/500
                    </p>
                  </div>
                </div>

                {/* Inline error banner (replaces alert) */}
                {deleteError && (
                  <div className="p-3 bg-red-50 border border-red-300 rounded-lg" data-testid="delete-error-banner">
                    <p className="text-sm text-red-800">{deleteError}</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-slate-200 p-4 flex gap-3 justify-end">
                <button
                  onClick={closeDeleteModal}
                  disabled={isDeleting}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                  data-testid="btn-cancel-delete"
                >
                  Hủy
                </button>
                <button
                  onClick={() => void confirmDelete()}
                  disabled={!canSubmit}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="btn-confirm-delete"
                >
                  {isDeleting ? "Đang xóa..." : "Xác nhận xóa"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <BulkActionBar
        selection={bulkSelection}
        adapter={bulkAdapter}
        pageRows={displayedCases}
        onSuccess={(result, action) => {
          if (result) {
            setBulkResult(result as BulkResult);
            setBulkResultLabel(action.label);
          } else {
            // Export action returns void — no result panel, just success feedback.
            setBulkResult({
              succeeded: bulkSelection.selectedIds.size
                ? Array.from(bulkSelection.selectedIds).map((id) => ({ id }))
                : [],
              skipped: [],
              failed: [],
            });
            setBulkResultLabel(action.label);
          }
        }}
        onError={(err) => {
          alert(`Lỗi: ${(err as Error)?.message ?? "không xác định"}`);
        }}
      />

    </div>
  );
}

export default CaseListPage;
