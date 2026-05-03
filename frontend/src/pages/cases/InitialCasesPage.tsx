import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { usePermission } from "@/hooks/usePermission";
import { CASE_PHASE } from "@/shared/enums/case-phase";
import {
  Search,
  Calendar,
  Building2,
  Eye,
  Edit,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Clock,
  Filter,
  RotateCcw,
  FileText,
  Bell,
  X,
} from "lucide-react";
import { api } from "@/lib/api";

interface InitialCase {
  id: string;
  caseNumber: string;
  type: "incident" | "case";
  typeLabel: string;
  receivedDate: string;
  district: string;
  subject: string;
  priority: "normal" | "urgent" | "critical";
  priorityLabel: string;
  deadline: string;
  assignedFrom: string;
  status: "pending" | "overdue";
}

interface FilterData {
  quickSearch: string;
  fromDate: string;
  toDate: string;
  district: string;
  type: string;
}

function InitialCasesPage() {
  const navigate = useNavigate();
  const { canEdit } = usePermission();
  const canEditRow = canEdit('cases');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedCase, setSelectedCase] = useState<InitialCase | null>(null);
  const [filters, setFilters] = useState<FilterData>({ quickSearch: "", fromDate: "", toDate: "", district: "", type: "" });

  // ── Real data state ────────────────────────────────────────────────────────
  const [cases, setCases] = useState<InitialCase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCases = async () => {
      setLoading(true);
      try {
        const res = await api.get("/cases?status=TIEP_NHAN&limit=50");
        const raw: any[] = res.data.data ?? [];
        const mapped: InitialCase[] = raw.map((c: any) => {
          // Map priority
          const priorityRaw = (c.priority ?? c.urgencyLevel ?? "NORMAL").toUpperCase();
          const priorityMap: Record<string, "normal" | "urgent" | "critical"> = {
            NORMAL: "normal", BINH_THUONG: "normal",
            URGENT: "urgent", KHAN: "urgent",
            CRITICAL: "critical", RAT_KHAN: "critical",
          };
          const priority = priorityMap[priorityRaw] ?? "normal";
          const priorityLabelMap: Record<string, string> = { normal: "Bình thường", urgent: "Khẩn", critical: "Rất khẩn" };

          // Map status — overdue if past deadline, else pending
          const deadline = c.deadline ?? c.dueDate ?? "";
          const isOverdue = deadline && new Date(deadline) < new Date();
          const status: "pending" | "overdue" = isOverdue ? "overdue" : "pending";

          // Map type
          const typeRaw = (c.type ?? c.caseType ?? "CASE").toUpperCase();
          const type: "incident" | "case" = typeRaw.includes("INCIDENT") || typeRaw.includes("VU_VIEC") ? "incident" : "case";
          const typeLabel = type === "incident" ? "Vụ việc" : "Vụ án";

          return {
            id: c.id,
            caseNumber: c.caseNumber ?? c.code ?? c.id?.slice(0, 8).toUpperCase() ?? "",
            type,
            typeLabel,
            receivedDate: c.receivedDate
              ? new Date(c.receivedDate).toISOString().split("T")[0]
              : c.createdAt
              ? new Date(c.createdAt).toISOString().split("T")[0]
              : "",
            district: c.unit ?? c.district ?? "",
            subject: c.name ?? c.subject ?? c.description ?? "",
            priority,
            priorityLabel: priorityLabelMap[priority],
            deadline,
            assignedFrom: c.assignedFrom ?? c.referralUnit ?? "",
            status,
          };
        });
        setCases(mapped);
      } catch {
        setCases([]);
      } finally {
        setLoading(false);
      }
    };
    fetchCases();
  }, []);

  // ── Dialog xóa ──────────────────────────────────────
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [caseToDelete, setCaseToDelete] = useState<InitialCase | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const filteredData = cases.filter((record) => {
    if (filters.quickSearch) {
      const searchLower = filters.quickSearch.toLowerCase();
      const matchesSearch = record.caseNumber.toLowerCase().includes(searchLower) || record.subject.toLowerCase().includes(searchLower) || record.district.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }
    if (filters.fromDate && record.receivedDate < filters.fromDate) return false;
    if (filters.toDate && record.receivedDate > filters.toDate) return false;
    if (filters.district && record.district !== filters.district) return false;
    if (filters.type && record.type !== filters.type) return false;
    return true;
  });

  const pendingCount = filteredData.filter((c) => c.status === CASE_PHASE.PENDING).length;
  const overdueCount = filteredData.filter((c) => c.status === CASE_PHASE.OVERDUE).length;
  const urgentCount = filteredData.filter((c) => c.priority !== "normal").length;

  const handleResetFilters = () => { setFilters({ quickSearch: "", fromDate: "", toDate: "", district: "", type: "" }); };
  const handleView = (caseItem: InitialCase) => { navigate(`/cases/${caseItem.id}`); };
  const handleEdit = (caseItem: InitialCase) => { navigate(`/cases/${caseItem.id}/edit`); };
  const handleAssign = (caseItem: InitialCase) => { setSelectedCase(caseItem); setShowAssignModal(true); };
  const [assignLoading, setAssignLoading] = useState(false);
  const confirmAssign = async () => {
    if (!selectedCase) return;
    setAssignLoading(true);
    try {
      await api.put(`/cases/${selectedCase.id}`, { status: 'DANG_DIEU_TRA' });
      setCases(prev => prev.filter(c => c.id !== selectedCase.id));
      setShowAssignModal(false);
      setSelectedCase(null);
    } catch {
      alert('Nhận xử lý thất bại. Vui lòng thử lại.');
    } finally {
      setAssignLoading(false);
    }
  };

  const openDeleteDialog = (caseItem: InitialCase) => { setCaseToDelete(caseItem); setDeleteDialogOpen(true); };
  const closeDeleteDialog = () => { setDeleteDialogOpen(false); setCaseToDelete(null); };

  const confirmDelete = async () => {
    if (!caseToDelete) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/cases/${caseToDelete.id}`);
      setCases((prev) => prev.filter((c) => c.id !== caseToDelete.id));
      closeDeleteDialog();
    } catch {
      closeDeleteDialog();
    } finally {
      setDeleteLoading(false);
    }
  };

  const getStatusBadge = (status: InitialCase["status"]) => {
    if (status === CASE_PHASE.OVERDUE) {
      return (<span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-bold bg-red-600 text-white border-2 border-red-700 shadow-sm"><AlertTriangle className="w-4 h-4" />QUÁ HẠN</span>);
    }
    return (<span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-bold bg-amber-500 text-white border-2 border-amber-600 shadow-sm"><Clock className="w-4 h-4" />CHỜ NHẬN</span>);
  };

  const getPriorityBadge = (priority: InitialCase["priority"], label: string) => {
    const styles = { normal: "bg-slate-100 text-slate-700 border-slate-300", urgent: "bg-orange-100 text-orange-800 border-orange-300", critical: "bg-red-100 text-red-800 border-red-300" };
    return (<span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${styles[priority]}`}>{label}</span>);
  };

  const getTypeBadge = (type: InitialCase["type"], label: string) => {
    const styles = { incident: "bg-orange-50 text-orange-700 border-orange-200", case: "bg-red-50 text-red-700 border-red-200" };
    return (<span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${styles[type]}`}>{label}</span>);
  };

  const formatDate = (dateString: string) => { if (!dateString) return ""; try { return new Date(dateString).toLocaleDateString("vi-VN"); } catch { return dateString; } };

  const getDaysRemaining = (deadline: string) => {
    if (!deadline) return 0;
    const today = new Date();
    const deadlineDate = new Date(deadline);
    const diffTime = deadlineDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="p-6 space-y-6" data-testid="initial-cases-page">
      {/* ── Header ─────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Vụ án - Vụ việc ban đầu</h1>
        <p className="text-slate-600 text-sm mt-1">Danh sách hồ sơ chờ tiếp nhận và xử lý</p>
      </div>

      {/* ── Thẻ thống kê ────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border-2 border-amber-200 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-amber-700 font-medium mb-1">Chờ nhận</p><p className="text-3xl font-bold text-amber-600">{pendingCount}</p></div>
            <div className="w-14 h-14 bg-amber-100 rounded-lg flex items-center justify-center"><Clock className="w-7 h-7 text-amber-600" /></div>
          </div>
        </div>
        <div className="bg-white rounded-lg border-2 border-red-300 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-red-700 font-medium mb-1">Quá hạn</p><p className="text-3xl font-bold text-red-600">{overdueCount}</p></div>
            <div className="w-14 h-14 bg-red-100 rounded-lg flex items-center justify-center"><AlertTriangle className="w-7 h-7 text-red-600" /></div>
          </div>
        </div>
        <div className="bg-white rounded-lg border-2 border-orange-200 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-orange-700 font-medium mb-1">Khẩn cấp</p><p className="text-3xl font-bold text-orange-600">{urgentCount}</p></div>
            <div className="w-14 h-14 bg-orange-100 rounded-lg flex items-center justify-center"><Bell className="w-7 h-7 text-orange-600" /></div>
          </div>
        </div>
        <div className="bg-white rounded-lg border-2 border-blue-200 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-blue-700 font-medium mb-1">Tổng hồ sơ</p><p className="text-3xl font-bold text-blue-600">{filteredData.length}</p></div>
            <div className="w-14 h-14 bg-blue-100 rounded-lg flex items-center justify-center"><FileText className="w-7 h-7 text-blue-600" /></div>
          </div>
        </div>
      </div>

      {/* ── Bộ lọc ─────────────────────────────────────── */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
        <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Filter className="w-5 h-5" />Bộ lọc</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-2">Tìm kiếm</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" value={filters.quickSearch} onChange={(e) => setFilters({ ...filters, quickSearch: e.target.value })} placeholder="Số hồ sơ, nội dung, đơn vị..." className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" data-testid="initial-search" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Từ ngày</label>
            <div className="relative"><Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input type="date" value={filters.fromDate} onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })} className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Đến ngày</label>
            <div className="relative"><Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input type="date" value={filters.toDate} onChange={(e) => setFilters({ ...filters, toDate: e.target.value })} className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
          </div>
          <div className="flex items-end">
            <button onClick={handleResetFilters} className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"><RotateCcw className="w-4 h-4" />Làm mới</button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Đơn vị</label>
            <div className="relative"><Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select value={filters.district} onChange={(e) => setFilters({ ...filters, district: e.target.value })} className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="">Tất cả</option><option value="Quận 1">Quận 1</option><option value="Quận 3">Quận 3</option><option value="Quận 5">Quận 5</option><option value="Quận 10">Quận 10</option><option value="Quận Tân Bình">Quận Tân Bình</option><option value="Quận Bình Thạnh">Quận Bình Thạnh</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Loại hồ sơ</label>
            <select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="">Tất cả</option><option value="incident">Vụ việc</option><option value="case">Vụ án</option>
            </select>
          </div>
        </div>
        <div className="mt-4 text-sm text-slate-600">
          {loading ? "Đang tải..." : <>Tìm thấy <span className="font-medium text-slate-800">{filteredData.length}</span> hồ sơ</>}
        </div>
      </div>

      {/* ── Bảng dữ liệu ───────────────────────────────── */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            <span className="ml-3 text-slate-600">Đang tải dữ liệu...</span>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-lg text-slate-500 font-medium">Không có hồ sơ chờ xử lý</p>
            <p className="text-sm text-slate-400 mt-2">Tất cả hồ sơ đã được tiếp nhận hoặc thử điều chỉnh bộ lọc</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="initial-cases-table">
              <thead className="bg-slate-50 border-b-2 border-slate-200">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider w-56 sticky left-0 bg-slate-50 z-10 border-r border-slate-200">Thao tác</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">STT</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Số hồ sơ</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Loại</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Nội dung vụ việc</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Đơn vị</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Ngày nhận</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Mức độ</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Hạn xử lý</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredData.map((caseItem, index) => {
                  const daysRemaining = getDaysRemaining(caseItem.deadline);
                  const isOverdue = caseItem.status === CASE_PHASE.OVERDUE;
                  return (
                    <tr
                      key={caseItem.id}
                      onClick={canEditRow ? () => handleEdit(caseItem) : undefined}
                      onKeyDown={canEditRow ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleEdit(caseItem); } } : undefined}
                      tabIndex={canEditRow ? 0 : undefined}
                      className={`transition-colors ${canEditRow ? "cursor-pointer hover:bg-blue-50" : "hover:bg-slate-50"} ${isOverdue ? "bg-red-50/50" : ""}`}
                      data-testid={`initial-row-${caseItem.id}`}
                    >
                      <td
                        className="px-3 py-4 whitespace-nowrap sticky left-0 z-10 bg-white border-r border-slate-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleAssign(caseItem)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium" data-testid={`btn-assign-${caseItem.id}`}>
                            <CheckCircle className="w-4 h-4" />Nhận
                          </button>
                          <button onClick={() => handleView(caseItem)} className="p-1.5 text-slate-600 hover:bg-slate-100 rounded transition-colors" title="Xem chi tiết"><Eye className="w-4 h-4" /></button>
                          <button onClick={() => handleEdit(caseItem)} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded transition-colors" title="Chỉnh sửa" data-testid={`btn-edit-${caseItem.id}`}><Edit className="w-4 h-4" /></button>
                          <button onClick={() => openDeleteDialog(caseItem)} className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors" title="Xóa" data-testid={`btn-delete-${caseItem.id}`}><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600 font-medium">{index + 1}</td>
                      <td className="px-4 py-4"><span className="text-sm font-bold text-blue-600">{caseItem.caseNumber}</span></td>
                      <td className="px-4 py-4">{getTypeBadge(caseItem.type, caseItem.typeLabel)}</td>
                      <td className="px-4 py-4"><div className="max-w-xs"><p className="text-sm text-slate-800 font-medium line-clamp-2">{caseItem.subject}</p><p className="text-xs text-slate-500 mt-1">Từ: {caseItem.assignedFrom}</p></div></td>
                      <td className="px-4 py-4 text-sm text-slate-700">{caseItem.district}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{formatDate(caseItem.receivedDate)}</td>
                      <td className="px-4 py-4">{getPriorityBadge(caseItem.priority, caseItem.priorityLabel)}</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-1">
                          <span className={`text-sm font-medium ${isOverdue ? "text-red-700" : "text-slate-700"}`}>{formatDate(caseItem.deadline)}</span>
                          {isOverdue ? (<span className="text-xs font-bold text-red-700">Đã quá {Math.abs(daysRemaining)} ngày</span>) : daysRemaining <= 2 ? (<span className="text-xs font-medium text-amber-700">Còn {daysRemaining} ngày</span>) : (<span className="text-xs text-slate-500">Còn {daysRemaining} ngày</span>)}
                        </div>
                      </td>
                      <td className="px-4 py-4">{getStatusBadge(caseItem.status)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal xác nhận nhận xử lý ──────────────────── */}
      {showAssignModal && selectedCase && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" data-testid="assign-modal">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-800">Xác nhận nhận xử lý</h3>
                <button onClick={() => setShowAssignModal(false)} className="p-1 hover:bg-slate-100 rounded transition-colors"><X className="w-5 h-5 text-slate-500" /></button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm font-medium text-blue-900">Số hồ sơ: <span className="font-bold">{selectedCase.caseNumber}</span></p>
                <p className="text-sm text-blue-800 mt-1">Loại: {selectedCase.typeLabel}</p>
                <p className="text-sm text-blue-800 mt-1">Nội dung: {selectedCase.subject}</p>
                <p className="text-sm text-blue-800 mt-1">Hạn xử lý: <span className="font-medium">{formatDate(selectedCase.deadline)}</span></p>
              </div>
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800"><strong>Lưu ý:</strong> Sau khi nhận xử lý, hồ sơ sẽ được chuyển vào danh sách công việc của bạn. Vui lòng xử lý trong thời hạn quy định.</p>
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex items-center justify-end gap-3">
              <button onClick={() => setShowAssignModal(false)} className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors">Hủy bỏ</button>
              <button onClick={confirmAssign} disabled={assignLoading} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-60 disabled:cursor-not-allowed" data-testid="btn-confirm-assign">{assignLoading ? 'Đang xử lý...' : 'Xác nhận nhận xử lý'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Dialog xác nhận xóa ────────────────────────── */}
      {deleteDialogOpen && caseToDelete && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          data-testid="delete-dialog"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                    <Trash2 className="w-5 h-5 text-red-600" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">Xác nhận xóa hồ sơ</h3>
                </div>
                <button onClick={closeDeleteDialog} className="p-1 hover:bg-slate-100 rounded transition-colors"><X className="w-5 h-5 text-slate-500" /></button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-slate-700">Bạn có chắc chắn muốn xóa vụ án này? Thao tác này không thể hoàn tác.</p>
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm font-medium text-red-900">Số hồ sơ: <span className="font-bold">{caseToDelete.caseNumber}</span></p>
                <p className="text-sm text-red-800 mt-1 line-clamp-2">{caseToDelete.subject}</p>
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex items-center justify-end gap-3">
              <button onClick={closeDeleteDialog} className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium" data-testid="btn-cancel-delete">Hủy bỏ</button>
              <button onClick={() => void confirmDelete()} disabled={deleteLoading} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50" data-testid="btn-confirm-delete">
                {deleteLoading ? "Đang xóa..." : "Xóa hồ sơ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default InitialCasesPage;
