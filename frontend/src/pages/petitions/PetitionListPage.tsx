/**
 * PetitionListPage — Danh sách Đơn thư
 * TASK-ID: TASK-2026-260202
 *
 * REFS-FIRST: Adapted from C:/PC02/Refs/src/app/pages/PetitionList.tsx
 * Giữ nguyên style Tailwind, thêm data-testid cho E2E, tích hợp API.
 */

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import {
  Plus,
  Search,
  SlidersHorizontal,
  Download,
  RotateCcw,
  Eye,
  Edit,
  MoreVertical,
  FileText,
  AlertCircle,
  Scale,
  BookOpen,
  Archive,
  Trash2,
  X,
  Calendar,
  User,
  Building2,
  AlertTriangle,
} from "lucide-react";
import { usePermission } from "@/hooks/usePermission";
import { AssignModal } from "@/components/AssignModal";

// ─── Types ─────────────────────────────────────────────────────────────────

interface Petition {
  id: string;
  stt: string;
  receivedDate: string;
  unit?: string;
  enteredBy?: { id: string; firstName?: string; lastName?: string; username: string };
  senderName: string;
  suspectedPerson?: string;
  status: PetitionStatusLabel;
  deadline?: string;
  summary?: string;
  priority?: string;
  linkedCaseId?: string;
  linkedIncidentId?: string;
  assignedTeamId?: string | null;
  assignedToId?: string | null;
  createdAt: string;
  updatedAt?: string;
}

type PetitionStatusLabel =
  | "MOI_TIEP_NHAN"
  | "DANG_XU_LY"
  | "CHO_PHE_DUYET"
  | "DA_LUU_DON"
  | "DA_GIAI_QUYET"
  | "DA_CHUYEN_VU_VIEC"
  | "DA_CHUYEN_VU_AN";

const STATUS_LABELS: Record<PetitionStatusLabel, string> = {
  MOI_TIEP_NHAN: "Mới tiếp nhận",
  DANG_XU_LY: "Đang xử lý",
  CHO_PHE_DUYET: "Chờ phê duyệt",
  DA_LUU_DON: "Đã lưu đơn",
  DA_GIAI_QUYET: "Đã giải quyết",
  DA_CHUYEN_VU_VIEC: "Đã chuyển VV",
  DA_CHUYEN_VU_AN: "Đã chuyển VA",
};

const STATUS_COLORS: Record<PetitionStatusLabel, string> = {
  MOI_TIEP_NHAN: "bg-slate-800 text-white",
  DANG_XU_LY: "bg-amber-500 text-white",
  CHO_PHE_DUYET: "bg-blue-600 text-white",
  DA_LUU_DON: "bg-slate-500 text-white",
  DA_GIAI_QUYET: "bg-green-600 text-white",
  DA_CHUYEN_VU_VIEC: "bg-purple-600 text-white",
  DA_CHUYEN_VU_AN: "bg-red-600 text-white",
};

// Mock data removed — data now fetched from real API

function isOverdue(deadline?: string): boolean {
  if (!deadline) return false;
  const deadlineDate = new Date(deadline);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return deadlineDate < today;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("vi-VN");
  } catch {
    return dateStr;
  }
}

// ─── Component ─────────────────────────────────────────────────────────────

export function PetitionListPage() {
  const navigate = useNavigate();
  const { canDispatch } = usePermission();
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;
  const [petitions, setPetitions] = useState<Petition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [quickSearch, setQuickSearch] = useState("");
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState<string | null>(null);
  const [showConvertToIncidentModal, setShowConvertToIncidentModal] = useState(false);
  const [showConvertToCaseModal, setShowConvertToCaseModal] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedPetition, setSelectedPetition] = useState<Petition | null>(null);

  const [advancedFilters, setAdvancedFilters] = useState({
    fromDate: "",
    toDate: "",
    unit: "",
    status: "",
    senderName: "",
  });

  const fetchPetitions = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get<{ success: boolean; data: Petition[]; total: number }>('/petitions', {
        params: { limit: 100 },
      });
      setPetitions(res.data.data ?? []);
    } catch {
      // fallback to empty on error
      setPetitions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPetitions();
  }, [fetchPetitions]);

  const filteredPetitions = petitions.filter((petition) => {
    const matchesQuickSearch =
      !quickSearch ||
      petition.stt.toLowerCase().includes(quickSearch.toLowerCase()) ||
      petition.senderName.toLowerCase().includes(quickSearch.toLowerCase()) ||
      (petition.suspectedPerson ?? "").toLowerCase().includes(quickSearch.toLowerCase()) ||
      (petition.summary ?? "").toLowerCase().includes(quickSearch.toLowerCase());

    const matchesUnit =
      !advancedFilters.unit ||
      (petition.unit ?? "").toLowerCase().includes(advancedFilters.unit.toLowerCase());

    const matchesStatus =
      !advancedFilters.status ||
      petition.status === advancedFilters.status;

    const matchesSender =
      !advancedFilters.senderName ||
      petition.senderName.toLowerCase().includes(advancedFilters.senderName.toLowerCase());

    const matchesFromDate =
      !advancedFilters.fromDate ||
      new Date(petition.receivedDate) >= new Date(advancedFilters.fromDate);

    const matchesToDate =
      !advancedFilters.toDate ||
      new Date(petition.receivedDate) <= new Date(advancedFilters.toDate);

    return (
      matchesQuickSearch &&
      matchesUnit &&
      matchesStatus &&
      matchesSender &&
      matchesFromDate &&
      matchesToDate
    );
  });

  const overdueCount = filteredPetitions.filter((p) => isOverdue(p.deadline)).length;
  const totalPages = Math.max(1, Math.ceil(filteredPetitions.length / PAGE_SIZE));
  const displayedPetitions = filteredPetitions.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleActionClick = useCallback(
    (petition: Petition, action: string) => {
      setSelectedPetition(petition);
      setShowActionMenu(null);

      switch (action) {
        case "assign":
          setShowAssignModal(true);
          break;
        case "convert-incident":
          setShowConvertToIncidentModal(true);
          break;
        case "convert-case":
          setShowConvertToCaseModal(true);
          break;
        case "guide":
          setShowGuideModal(true);
          break;
        case "archive":
          setShowArchiveModal(true);
          break;
      }
    },
    []
  );

  const handleConvertSuccess = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (_petitionId: string, _newStatus: PetitionStatusLabel) => {
      // Refetch list to get fresh data from server
      void fetchPetitions();
    },
    [fetchPetitions]
  );

  // Close action menu on outside click
  useEffect(() => {
    const handler = () => setShowActionMenu(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  return (
    <div className="p-6 space-y-6" data-testid="petition-list-page">
      {/* Tiêu đề */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Quản lý Đơn thư</h1>
        <p className="text-slate-600 text-sm mt-1">
          Tiếp nhận, xử lý và quản lý đơn thư tố cáo, khiếu nại của công dân
        </p>
      </div>

      {/* Cảnh báo quá hạn (EC-04) */}
      {overdueCount > 0 && (
        <div
          className="bg-red-50 border-2 border-red-300 rounded-lg p-4 flex items-center gap-3"
          data-testid="overdue-warning"
        >
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm font-medium text-red-800">
            Cảnh báo: Có <span className="font-bold">{overdueCount}</span> đơn thư đã quá hạn xử lý
          </p>
        </div>
      )}

      {/* Thanh hành động */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/petitions/new")}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              data-testid="btn-add-petition"
            >
              <Plus className="w-4 h-4" />
              Thêm mới
            </button>
            <button
              onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
              className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              data-testid="btn-advanced-search"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Tìm kiếm nâng cao
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              data-testid="btn-export"
            >
              <Download className="w-4 h-4" />
              Xuất Excel
            </button>
            <button
              onClick={() => void fetchPetitions()}
              className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              data-testid="btn-refresh"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tìm kiếm nhanh */}
        <div className="mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={quickSearch}
              onChange={(e) => setQuickSearch(e.target.value)}
              placeholder="Tìm kiếm nhanh theo STT, Tên người gửi, Nghi vấn đối tượng, Tóm tắt nội dung..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              data-testid="search-input"
            />
          </div>
        </div>

        {/* Tìm kiếm nâng cao */}
        {showAdvancedSearch && (
          <div className="mt-4 pt-4 border-t border-slate-200" data-testid="advanced-search-panel">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-slate-800 flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4" />
                Bộ lọc nâng cao
              </h3>
              <button
                onClick={() => setShowAdvancedSearch(false)}
                className="p-1 hover:bg-slate-100 rounded transition-colors"
              >
                <X className="w-4 h-4 text-slate-600" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Từ ngày</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="date"
                    value={advancedFilters.fromDate}
                    onChange={(e) =>
                      setAdvancedFilters({ ...advancedFilters, fromDate: e.target.value })
                    }
                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    data-testid="filter-from-date"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Đến ngày</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="date"
                    value={advancedFilters.toDate}
                    onChange={(e) =>
                      setAdvancedFilters({ ...advancedFilters, toDate: e.target.value })
                    }
                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    data-testid="filter-to-date"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Đơn vị</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={advancedFilters.unit}
                    onChange={(e) =>
                      setAdvancedFilters({ ...advancedFilters, unit: e.target.value })
                    }
                    placeholder="Tên đơn vị"
                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    data-testid="filter-unit"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Trạng thái</label>
                <select
                  value={advancedFilters.status}
                  onChange={(e) =>
                    setAdvancedFilters({ ...advancedFilters, status: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                  data-testid="filter-status"
                >
                  <option value="">Tất cả</option>
                  <option value="MOI_TIEP_NHAN">Mới tiếp nhận</option>
                  <option value="DANG_XU_LY">Đang xử lý</option>
                  <option value="CHO_PHE_DUYET">Chờ phê duyệt</option>
                  <option value="DA_LUU_DON">Đã lưu đơn</option>
                  <option value="DA_GIAI_QUYET">Đã giải quyết</option>
                  <option value="DA_CHUYEN_VU_VIEC">Đã chuyển VV</option>
                  <option value="DA_CHUYEN_VU_AN">Đã chuyển VA</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Người gửi</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={advancedFilters.senderName}
                    onChange={(e) =>
                      setAdvancedFilters({ ...advancedFilters, senderName: e.target.value })
                    }
                    placeholder="Tên người gửi"
                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    data-testid="filter-sender"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() =>
                  setAdvancedFilters({
                    fromDate: "",
                    toDate: "",
                    unit: "",
                    status: "",
                    senderName: "",
                  })
                }
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm"
              >
                Xóa bộ lọc
              </button>
              <button onClick={() => { setCurrentPage(1); setShowAdvancedSearch(false); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm">
                Áp dụng
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bảng dữ liệu */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="font-bold text-slate-800">Danh sách Đơn thư</h2>
          <p className="text-sm text-slate-600 mt-1">
            Hiển thị {filteredPetitions.length} / {petitions.length} đơn thư
            {overdueCount > 0 && (
              <span className="ml-2 text-red-600">
                (<span className="font-medium">{overdueCount}</span> quá hạn)
              </span>
            )}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full" data-testid="petition-table">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider w-12">
                  STT
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Mã đơn thư
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Ngày tiếp nhận
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Đơn vị
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Tên người gửi
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Nghi vấn đối tượng
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Trạng thái
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Hạn xử lý
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider w-32">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center">
                    <p className="text-slate-500">Đang tải...</p>
                  </td>
                </tr>
              ) : filteredPetitions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Search className="w-10 h-10 text-slate-300" />
                      <p className="text-slate-600 font-medium">Không tìm thấy kết quả</p>
                      <p className="text-slate-500 text-sm">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
                    </div>
                  </td>
                </tr>
              ) : (
                displayedPetitions.map((petition, index) => {
                  const overdue = isOverdue(petition.deadline);
                  return (
                    <tr
                      key={petition.id}
                      className={`hover:bg-slate-50 transition-colors ${overdue ? "bg-red-50/40" : ""}`}
                      data-testid="petition-row"
                    >
                      <td className="px-4 py-3 text-sm text-slate-700 font-medium">
                        {index + 1}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-blue-600">
                            {petition.stt}
                          </span>
                          {overdue && (
                            <span
                              className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full"
                              data-testid="overdue-badge"
                            >
                              Quá hạn
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-700">
                        {formatDate(petition.receivedDate)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {petition.unit ?? "—"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-700 font-medium">
                        {petition.senderName}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-700">
                        {petition.suspectedPerson ?? "—"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`px-3 py-1.5 rounded-md text-xs font-medium ${STATUS_COLORS[petition.status]}`}
                        >
                          {STATUS_LABELS[petition.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`text-sm ${overdue ? "text-red-600 font-medium" : "text-slate-700"}`}>
                          {formatDate(petition.deadline)}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => navigate(`/petitions/${petition.id}`)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Xem"
                            data-testid={`btn-view-${petition.id}`}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => navigate(`/petitions/${petition.id}/edit`)}
                            className="p-2 text-slate-600 hover:bg-slate-100 rounded transition-colors"
                            title="Sửa"
                            data-testid={`btn-edit-${petition.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Xoa don thu ${petition.stt}?`)) {
                                api.delete(`/petitions/${petition.id}`)
                                  .then(() => void fetchPetitions())
                                  .catch(() => alert("Co loi khi xoa don thu."));
                              }
                            }}
                            className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Xoa"
                            data-testid={`btn-delete-${petition.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowActionMenu(
                                  showActionMenu === petition.id ? null : petition.id
                                );
                              }}
                              className="p-2 text-slate-600 hover:bg-slate-100 rounded transition-colors"
                              title="Thao tác khác"
                              data-testid="btn-action-menu"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                            {showActionMenu === petition.id && (
                              <div
                                className="absolute right-0 top-full mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-10"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {canDispatch && (
                                  <button
                                    onClick={() => handleActionClick(petition, "assign")}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
                                    data-testid="btn-assign"
                                  >
                                    <User className="w-4 h-4 text-blue-600" />
                                    {petition.assignedTeamId ? 'Phân công lại' : 'Phân công'}
                                  </button>
                                )}
                                <button
                                  onClick={() => handleActionClick(petition, "convert-incident")}
                                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
                                  data-testid="btn-convert-incident"
                                >
                                  <FileText className="w-4 h-4 text-purple-600" />
                                  Chuyển thành Vụ việc
                                </button>
                                <button
                                  onClick={() => handleActionClick(petition, "convert-case")}
                                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left border-t border-slate-100"
                                  data-testid="btn-convert-case"
                                >
                                  <Scale className="w-4 h-4 text-red-600" />
                                  Chuyển thành Vụ án
                                </button>
                                <button
                                  onClick={() => handleActionClick(petition, "guide")}
                                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left border-t border-slate-100"
                                  data-testid="btn-guide"
                                >
                                  <BookOpen className="w-4 h-4 text-blue-600" />
                                  Hướng dẫn
                                </button>
                                <button
                                  onClick={() => handleActionClick(petition, "archive")}
                                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left border-t border-slate-100"
                                  data-testid="btn-archive"
                                >
                                  <Archive className="w-4 h-4 text-slate-600" />
                                  Lưu đơn
                                </button>
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
        <div className="border-t border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="text-sm text-slate-600">
            Hiển thị <span className="font-medium">{filteredPetitions.length}</span> trên{" "}
            <span className="font-medium">{petitions.length}</span> đơn thư
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Trước</button>
            <span className="px-3 py-2 text-sm font-medium text-slate-700">Trang {currentPage}/{totalPages}</span>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Sau</button>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showAssignModal && selectedPetition && (
        <AssignModal
          open={showAssignModal}
          onClose={() => setShowAssignModal(false)}
          resourceType="petitions"
          recordId={selectedPetition.id}
          currentUpdatedAt={selectedPetition.updatedAt}
          currentTeamId={selectedPetition.assignedTeamId}
          currentInvestigatorId={selectedPetition.assignedToId}
          onSuccess={() => { void fetchPetitions(); }}
        />
      )}
      {showConvertToIncidentModal && selectedPetition && (
        <ConvertToIncidentModal
          petition={selectedPetition}
          onClose={() => setShowConvertToIncidentModal(false)}
          onSuccess={(id) => handleConvertSuccess(id, "DA_CHUYEN_VU_VIEC")}
        />
      )}
      {showConvertToCaseModal && selectedPetition && (
        <ConvertToCaseModal
          petition={selectedPetition}
          onClose={() => setShowConvertToCaseModal(false)}
          onSuccess={(id) => handleConvertSuccess(id, "DA_CHUYEN_VU_AN")}
        />
      )}
      {showGuideModal && selectedPetition && (
        <GuideModal
          petition={selectedPetition}
          onClose={() => setShowGuideModal(false)}
        />
      )}
      {showArchiveModal && selectedPetition && (
        <ArchiveModal
          petition={selectedPetition}
          onClose={() => setShowArchiveModal(false)}
          onSuccess={(id) => handleConvertSuccess(id, "DA_LUU_DON")}
        />
      )}
    </div>
  );
}

// ─── Modal: Chuyển thành Vụ việc ───────────────────────────────────────────

function ConvertToIncidentModal({
  petition,
  onClose,
  onSuccess,
}: {
  petition: Petition;
  onClose: () => void;
  onSuccess: (id: string) => void;
}) {
  const [formData, setFormData] = useState({
    incidentName: "",
    incidentType: "",
    description: "",
    assignedTo: "",
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    const newErrors: string[] = [];
    if (!formData.incidentName) newErrors.push("Tên vụ việc là bắt buộc");
    if (!formData.incidentType) newErrors.push("Loại vụ việc là bắt buộc");
    if (newErrors.length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post(`/petitions/${petition.id}/convert-incident`, {
        incidentName: formData.incidentName,
        incidentType: formData.incidentType,
        description: formData.description || undefined,
      });
      onSuccess(petition.id);
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string | string[] } } })
          ?.response?.data?.message;
      if (Array.isArray(msg)) setErrors(msg);
      else if (typeof msg === "string") setErrors([msg]);
      else setErrors(["Có lỗi xảy ra khi chuyển đổi"]);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-800">Chuyển thành Vụ việc</h2>
            <p className="text-sm text-slate-600 mt-1">Đơn thư: {petition.stt}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-140px)]">
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <ul className="list-disc list-inside space-y-1">
                {errors.map((e, i) => (
                  <li key={i} className="text-sm text-red-700">{e}</li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Tên vụ việc <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.incidentName}
              onChange={(e) => setFormData({ ...formData, incidentName: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Nhập tên vụ việc"
              data-testid="field-incident-name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Loại vụ việc <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.incidentType}
              onChange={(e) => setFormData({ ...formData, incidentType: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              data-testid="field-incident-type"
            >
              <option value="">Chọn loại vụ việc</option>
              <option value="Vi phạm hành chính">Vi phạm hành chính</option>
              <option value="Tranh chấp dân sự">Tranh chấp dân sự</option>
              <option value="An ninh trật tự">An ninh trật tự</option>
              <option value="Khác">Khác</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Mô tả chi tiết</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Nhập mô tả chi tiết về vụ việc"
            />
          </div>
        </div>

        <div className="border-t border-slate-200 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={() => void handleSubmit()}
            disabled={isSubmitting}
            className="px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50"
            data-testid="btn-confirm-convert-incident"
          >
            {isSubmitting ? "Đang xử lý..." : "Xác nhận chuyển đổi"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal: Chuyển thành Vụ án ─────────────────────────────────────────────

function ConvertToCaseModal({
  petition,
  onClose,
  onSuccess,
}: {
  petition: Petition;
  onClose: () => void;
  onSuccess: (id: string) => void;
}) {
  const [formData, setFormData] = useState({
    caseName: "",
    crime: "",
    jurisdiction: "",
    suspect: "",
    prosecutionDecision: "",
    prosecutionDate: "",
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    const newErrors: string[] = [];
    if (!formData.caseName) newErrors.push("Tên vụ án là bắt buộc");
    if (!formData.crime) newErrors.push("Tội danh là bắt buộc");
    if (!formData.jurisdiction) newErrors.push("Thẩm quyền là bắt buộc");
    if (newErrors.length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post(`/petitions/${petition.id}/convert-case`, {
        caseName: formData.caseName,
        crime: formData.crime,
        jurisdiction: formData.jurisdiction,
        suspect: formData.suspect || undefined,
        prosecutionDecision: formData.prosecutionDecision || undefined,
        prosecutionDate: formData.prosecutionDate || undefined,
      });
      onSuccess(petition.id);
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string | string[] } } })
          ?.response?.data?.message;
      if (Array.isArray(msg)) setErrors(msg);
      else if (typeof msg === "string") setErrors([msg]);
      else setErrors(["Có lỗi xảy ra khi chuyển đổi"]);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-800">Chuyển thành Vụ án</h2>
            <p className="text-sm text-slate-600 mt-1">Đơn thư: {petition.stt}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-140px)]">
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <ul className="list-disc list-inside space-y-1">
                {errors.map((e, i) => (
                  <li key={i} className="text-sm text-red-700">{e}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Tên vụ án <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.caseName}
                onChange={(e) => setFormData({ ...formData, caseName: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Nhập tên vụ án"
                data-testid="field-case-name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Tội danh <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.crime}
                onChange={(e) => setFormData({ ...formData, crime: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                data-testid="field-crime"
              >
                <option value="">Chọn tội danh</option>
                <option value="Tham nhũng">Tham nhũng</option>
                <option value="Trộm cắp tài sản">Trộm cắp tài sản</option>
                <option value="Lừa đảo chiếm đoạt tài sản">Lừa đảo chiếm đoạt tài sản</option>
                <option value="Buôn bán ma túy">Buôn bán ma túy</option>
                <option value="Khác">Khác</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Thẩm quyền <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.jurisdiction}
                onChange={(e) => setFormData({ ...formData, jurisdiction: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                data-testid="field-jurisdiction"
              >
                <option value="">Chọn thẩm quyền</option>
                <option value="Công an cấp Quận/Huyện">Công an cấp Quận/Huyện</option>
                <option value="Công an cấp Thành phố">Công an cấp Thành phố</option>
                <option value="Viện kiểm sát">Viện kiểm sát</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">Bị can</label>
              <input
                type="text"
                value={formData.suspect}
                onChange={(e) => setFormData({ ...formData, suspect: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Họ và tên bị can"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Quyết định khởi tố số
              </label>
              <input
                type="text"
                value={formData.prosecutionDecision}
                onChange={(e) => setFormData({ ...formData, prosecutionDecision: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Số quyết định"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Ngày khởi tố</label>
              <input
                type="date"
                value={formData.prosecutionDate}
                onChange={(e) => setFormData({ ...formData, prosecutionDate: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={() => void handleSubmit()}
            disabled={isSubmitting}
            className="px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50"
            data-testid="btn-confirm-convert-case"
          >
            {isSubmitting ? "Đang xử lý..." : "Xác nhận khởi tố"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal: Hướng dẫn ─────────────────────────────────────────────────────

function GuideModal({
  petition,
  onClose,
}: {
  petition: Petition;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState({ guideContent: "", guidedPerson: "" });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!formData.guideContent || !formData.guidedPerson) {
      alert("Vui long dien day du thong tin");
      return;
    }
    setIsSubmitting(true);
    try {
      await api.post("/guidance", {
        guidedPerson: formData.guidedPerson,
        guidanceContent: formData.guideContent,
        subject: petition.stt,
        unit: petition.unit,
        date: new Date().toISOString(),
      });
      onClose();
    } catch {
      alert("Co loi khi luu huong dan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-800">Hướng dẫn xử lý đơn thư</h2>
            <p className="text-sm text-slate-600 mt-1">Đơn thư: {petition.stt}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Nội dung hướng dẫn <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.guideContent}
              onChange={(e) => setFormData({ ...formData, guideContent: e.target.value })}
              rows={6}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Nhập nội dung hướng dẫn chi tiết..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Người được hướng dẫn <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.guidedPerson}
              onChange={(e) => setFormData({ ...formData, guidedPerson: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Tên người được hướng dẫn"
            />
          </div>
        </div>
        <div className="border-t border-slate-200 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={() => void handleSubmit()}
            disabled={isSubmitting}
            className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
          >
            {isSubmitting ? "Dang luu..." : "Luu huong dan"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal: Lưu đơn ───────────────────────────────────────────────────────

function ArchiveModal({
  petition,
  onClose,
  onSuccess,
}: {
  petition: Petition;
  onClose: () => void;
  onSuccess: (id: string) => void;
}) {
  const [reason, setReason] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason) {
      alert("Vui long nhap ly do luu don");
      return;
    }
    setIsSubmitting(true);
    try {
      await api.put(`/petitions/${petition.id}`, {
        status: "DA_LUU_DON",
        notes: reason,
      });
      onSuccess(petition.id);
      onClose();
    } catch {
      alert("Co loi khi luu don.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-800">Lưu đơn</h2>
            <p className="text-sm text-slate-600 mt-1">Đơn thư: {petition.stt}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>
        <div className="p-6">
          <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-medium">Lưu ý:</p>
              <p>Đơn thư sau khi lưu sẽ được chuyển sang trạng thái "Đã lưu đơn" và không thể tiếp tục xử lý.</p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Lý do lưu đơn <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={6}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Nhập lý do cụ thể tại sao đơn thư này cần được lưu..."
            />
          </div>
        </div>
        <div className="border-t border-slate-200 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={() => void handleSubmit()}
            disabled={isSubmitting}
            className="px-4 py-2.5 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors font-medium disabled:opacity-50"
          >
            {isSubmitting ? "Dang xu ly..." : "Xac nhan luu don"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PetitionListPage;
