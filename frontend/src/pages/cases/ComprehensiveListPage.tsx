import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { usePermission } from "@/hooks/usePermission";
import {
  Search,
  Filter,
  Download,
  Eye,
  Edit,
  Trash2,
  Send,
  FileText,
  ChevronDown,
  ChevronUp,
  Calendar,
  Building2,
  User,
  RotateCcw,
  FileDown,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { CaseStatus, IncidentStatus, PetitionStatus } from "@/shared/enums/generated";
import {
  CASE_STATUS_LABEL,
  CASE_STATUS_BADGE,
  INCIDENT_STATUS_LABEL,
  INCIDENT_STATUS_BADGE,
  PETITION_STATUS_LABEL,
  PETITION_STATUS_BADGE,
  BADGE_DEFAULT,
  TERMINAL_CASE_STATUSES,
  TERMINAL_INCIDENT_STATUSES,
  TERMINAL_PETITION_STATUSES,
} from "@/shared/enums/status-labels";

const RECORD_TYPE = { CASE: 'case', INCIDENT: 'incident', PETITION: 'petition' } as const;
type RecordType = (typeof RECORD_TYPE)[keyof typeof RECORD_TYPE];

interface FilterData {
  quickSearch: string;
  fromDate: string;
  toDate: string;
  district: string;
  status: string;
  createdBy: string;
  type: string;
}

function ComprehensiveListPage() {
  const navigate = useNavigate();
  const { canEdit } = usePermission();
  const canEditRow = canEdit('cases');
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<FilterData>({ quickSearch: "", fromDate: "", toDate: "", district: "", status: "", createdBy: "", type: "" });
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 10;

  const [allData, setAllData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [casesRes, incidentsRes, petitionsRes] = await Promise.all([
          api.get("/cases?limit=50"),
          api.get("/incidents?limit=50"),
          api.get("/petitions?limit=50"),
        ]);
        const cases = (casesRes.data.data ?? []).map((c: any) => ({
          ...c,
          recordType: RECORD_TYPE.CASE,
          type: RECORD_TYPE.CASE,
          typeLabel: "Vụ án",
          receivedDate: c.createdAt ? new Date(c.createdAt).toISOString().split("T")[0] : "",
          district: c.unit ?? "",
          status: c.status ?? CaseStatus.TIEP_NHAN,
          statusLabel: CASE_STATUS_LABEL[c.status as CaseStatus] ?? c.status ?? "",
          statusBadge: CASE_STATUS_BADGE[c.status as CaseStatus] ?? BADGE_DEFAULT,
          createdBy: c.investigator ? `${c.investigator.firstName ?? ""} ${c.investigator.lastName ?? ""}`.trim() : "",
          deadline: c.deadline ?? c.dueDate ?? "",
          caseNumber: c.caseNumber ?? c.id?.slice(0, 8).toUpperCase() ?? "",
        }));
        const incidents = (incidentsRes.data.data ?? []).map((i: any) => ({
          ...i,
          recordType: RECORD_TYPE.INCIDENT,
          type: RECORD_TYPE.INCIDENT,
          typeLabel: "Vụ việc",
          receivedDate: i.createdAt ? new Date(i.createdAt).toISOString().split("T")[0] : "",
          district: i.unitId ?? "",
          status: i.status ?? IncidentStatus.TIEP_NHAN,
          statusLabel: INCIDENT_STATUS_LABEL[i.status as IncidentStatus] ?? i.status ?? "",
          statusBadge: INCIDENT_STATUS_BADGE[i.status as IncidentStatus] ?? BADGE_DEFAULT,
          createdBy: i.investigator ? `${i.investigator.firstName ?? ""} ${i.investigator.lastName ?? ""}`.trim() : "",
          deadline: i.deadline ?? i.dueDate ?? "",
          caseNumber: i.code ?? i.id?.slice(0, 8).toUpperCase() ?? "",
        }));
        const petitions = (petitionsRes.data.data ?? []).map((p: any) => ({
          ...p,
          recordType: RECORD_TYPE.PETITION,
          type: RECORD_TYPE.PETITION,
          typeLabel: "Đơn thư",
          receivedDate: p.receivedDate ? new Date(p.receivedDate).toISOString().split("T")[0] : "",
          district: p.unit ?? "",
          status: p.status ?? PetitionStatus.MOI_TIEP_NHAN,
          statusLabel: PETITION_STATUS_LABEL[p.status as PetitionStatus] ?? p.status ?? "",
          statusBadge: PETITION_STATUS_BADGE[p.status as PetitionStatus] ?? BADGE_DEFAULT,
          createdBy: p.assignedTo ? `${p.assignedTo.firstName ?? ""} ${p.assignedTo.lastName ?? ""}`.trim() : "",
          deadline: p.deadline ?? p.dueDate ?? "",
          caseNumber: p.stt ?? p.id?.slice(0, 8).toUpperCase() ?? "",
        }));
        setAllData([...cases, ...incidents, ...petitions]);
      } catch {
        setAllData([]);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<any | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const filteredData = allData.filter((record) => {
    if (filters.quickSearch) {
      const searchLower = filters.quickSearch.toLowerCase();
      const matchesSearch =
        (record.caseNumber ?? "").toLowerCase().includes(searchLower) ||
        (record.typeLabel ?? "").toLowerCase().includes(searchLower) ||
        (record.district ?? "").toLowerCase().includes(searchLower) ||
        (record.statusLabel ?? "").toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }
    if (filters.fromDate && record.receivedDate < filters.fromDate) return false;
    if (filters.toDate && record.receivedDate > filters.toDate) return false;
    if (filters.district && record.district !== filters.district) return false;
    if (filters.status && record.status !== filters.status) return false;
    if (filters.createdBy && !(record.createdBy ?? "").includes(filters.createdBy)) return false;
    if (filters.type && record.type !== filters.type) return false;
    return true;
  });

  const totalPages = Math.ceil(filteredData.length / recordsPerPage);
  const startIndex = (currentPage - 1) * recordsPerPage;
  const displayedData = filteredData.slice(startIndex, startIndex + recordsPerPage);

  const handleResetFilters = () => { setFilters({ quickSearch: "", fromDate: "", toDate: "", district: "", status: "", createdBy: "", type: "" }); setCurrentPage(1); };
  const handleSelectAll = () => { if (selectedRecords.size === displayedData.length) { setSelectedRecords(new Set()); } else { setSelectedRecords(new Set(displayedData.map((r) => r.id))); } };
  const handleSelectRecord = (id: string) => { const n = new Set(selectedRecords); if (n.has(id)) n.delete(id); else n.add(id); setSelectedRecords(n); };

  const handleExportRecords = (records: any[]) => {
    if (records.length === 0) return;
    const headers = ['STT', 'Mã hồ sơ', 'Loại', 'Đơn vị', 'Người tạo',
                     'Ngày tiếp nhận', 'Hạn xử lý', 'Trạng thái'];
    const rows = records.map((r, i) => [
      i + 1, r.caseNumber, r.typeLabel,
      r.district, r.createdBy,
      r.receivedDate, r.deadline ?? '', r.statusLabel,
    ]);
    const csv = [headers, ...rows]
      .map(row => row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `DanhSachTongHop_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const openDeleteDialog = (record: any) => { setRecordToDelete(record); setDeleteDialogOpen(true); };
  const closeDeleteDialog = () => { setDeleteDialogOpen(false); setRecordToDelete(null); };

  const handleDelete = async (item: any) => {
    const endpoint = item.recordType === RECORD_TYPE.CASE ? "cases"
      : item.recordType === RECORD_TYPE.INCIDENT ? "incidents"
      : "petitions";
    await api.delete(`/${endpoint}/${item.id}`);
    setAllData((prev) => prev.filter((x) => x.id !== item.id));
  };

  const confirmDelete = async () => {
    if (!recordToDelete) return;
    setDeleteLoading(true);
    try {
      await handleDelete(recordToDelete);
      setSelectedRecords((prev) => { const n = new Set(prev); n.delete(recordToDelete.id); return n; });
      closeDeleteDialog();
    } catch {
      closeDeleteDialog();
    } finally {
      setDeleteLoading(false);
    }
  };

  const getStatusBadge = (badgeStyle: string, label: string) => (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${badgeStyle}`}>
      {label}
    </span>
  );

  const getTypeBadge = (type: RecordType, label: string) => {
    const styles: Record<RecordType, string> = {
      [RECORD_TYPE.PETITION]: "bg-purple-50 text-purple-700 border-purple-200",
      [RECORD_TYPE.INCIDENT]: "bg-orange-50 text-orange-700 border-orange-200",
      [RECORD_TYPE.CASE]:     "bg-red-50 text-red-700 border-red-200",
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${styles[type] ?? "bg-slate-50 text-slate-700 border-slate-200"}`}>
        {label}
      </span>
    );
  };

  const isOverdue = (deadline: string, record: any): boolean => {
    if (!deadline || new Date(deadline) >= new Date()) return false;
    const s = record.status;
    if (record.recordType === RECORD_TYPE.CASE) return !TERMINAL_CASE_STATUSES.includes(s as CaseStatus);
    if (record.recordType === RECORD_TYPE.INCIDENT) return !TERMINAL_INCIDENT_STATUSES.includes(s as IncidentStatus);
    return !TERMINAL_PETITION_STATUSES.includes(s as PetitionStatus);
  };

  const getNavigatePath = (record: any, mode: 'view' | 'edit') => {
    const base = record.recordType === RECORD_TYPE.CASE ? '/cases'
      : record.recordType === RECORD_TYPE.INCIDENT ? '/incidents'
      : '/petitions';
    return mode === 'edit' ? `${base}/${record.id}/edit` : `${base}/${record.id}`;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    try { return new Date(dateString).toLocaleDateString("vi-VN"); } catch { return dateString; }
  };

  return (
    <div className="p-6 space-y-6" data-testid="comprehensive-list-page">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Danh sách tổng hợp</h1>
          <p className="text-slate-600 text-sm mt-1">Quản lý tất cả Đơn thư, Vụ việc, Vụ án</p>
        </div>
        <div className="flex items-center gap-3">
          {selectedRecords.size > 0 && (
            <button onClick={() => handleExportRecords(filteredData.filter(r => selectedRecords.has(r.id)))} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
              <FileDown className="w-4 h-4" />Xuất đã chọn ({selectedRecords.size})
            </button>
          )}
          <button onClick={() => navigate("/add-new-record")} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <FileText className="w-4 h-4" />Thêm mới
          </button>
        </div>
      </div>

      {/* ── Tìm kiếm & bộ lọc ─────────────────────────── */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input type="text" value={filters.quickSearch} onChange={(e) => setFilters({ ...filters, quickSearch: e.target.value })} placeholder="Tìm kiếm theo số hồ sơ, loại, đơn vị, trạng thái..." className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" data-testid="quick-search" />
          </div>
          <button onClick={() => setShowAdvancedFilter(!showAdvancedFilter)} className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg transition-colors ${showAdvancedFilter ? "bg-blue-50 border-blue-300 text-blue-700" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}>
            <Filter className="w-4 h-4" />Lọc nâng cao{showAdvancedFilter ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button onClick={handleResetFilters} className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors" title="Làm mới">
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {showAdvancedFilter && (
          <div className="pt-4 border-t border-slate-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Từ ngày</label>
                <div className="relative"><Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input type="date" value={filters.fromDate} onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })} className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Đến ngày</label>
                <div className="relative"><Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input type="date" value={filters.toDate} onChange={(e) => setFilters({ ...filters, toDate: e.target.value })} className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Loại hồ sơ</label>
                <select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="">Tất cả</option>
                  <option value={RECORD_TYPE.PETITION}>Đơn thư</option>
                  <option value={RECORD_TYPE.INCIDENT}>Vụ việc</option>
                  <option value={RECORD_TYPE.CASE}>Vụ án</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Đơn vị</label>
                <div className="relative"><Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select value={filters.district} onChange={(e) => setFilters({ ...filters, district: e.target.value })} className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    <option value="">Tất cả</option>
                    <option value="Quận 1">Quận 1</option>
                    <option value="Quận 3">Quận 3</option>
                    <option value="Quận 5">Quận 5</option>
                    <option value="Quận 10">Quận 10</option>
                    <option value="Quận Tân Bình">Quận Tân Bình</option>
                    <option value="Quận Bình Thạnh">Quận Bình Thạnh</option>
                    <option value="Huyện Củ Chi">Huyện Củ Chi</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Trạng thái</label>
                <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="">Tất cả</option>
                  <optgroup label="Vụ án">
                    {Object.entries(CASE_STATUS_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Vụ việc">
                    {Object.entries(INCIDENT_STATUS_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Đơn thư">
                    {Object.entries(PETITION_STATUS_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </optgroup>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Người nhập</label>
                <div className="relative"><User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input type="text" value={filters.createdBy} onChange={(e) => setFilters({ ...filters, createdBy: e.target.value })} placeholder="Tìm theo tên người nhập" className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-4 border-t border-slate-200 text-sm">
          <div className="text-slate-600">
            {loading ? "Đang tải..." : <>Tìm thấy <span className="font-medium text-slate-800">{filteredData.length}</span> hồ sơ</>}
          </div>
          {(filters.quickSearch || filters.fromDate || filters.toDate || filters.district || filters.status || filters.createdBy || filters.type) && (
            <button onClick={handleResetFilters} className="text-blue-600 hover:text-blue-700 font-medium">Xóa bộ lọc</button>
          )}
        </div>
      </div>

      {/* ── Bảng dữ liệu ───────────────────────────────── */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            <span className="ml-3 text-slate-600">Đang tải dữ liệu...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="comprehensive-table">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="w-12 px-4 py-3"><input type="checkbox" checked={selectedRecords.size === displayedData.length && displayedData.length > 0} onChange={handleSelectAll} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500" /></th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider w-40 sticky left-12 bg-slate-50 z-10 border-r border-slate-200">Thao tác</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">STT</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Số hồ sơ</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Loại hồ sơ</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Ngày tiếp nhận</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Đơn vị</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Trạng thái</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Người nhập</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Hạn xử lý</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {displayedData.length === 0 ? (
                  <tr><td colSpan={10} className="px-4 py-16 text-center"><FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" /><p className="text-slate-500 font-medium">Không tìm thấy hồ sơ nào</p><p className="text-sm text-slate-400 mt-1">Thử điều chỉnh bộ lọc hoặc thêm hồ sơ mới</p></td></tr>
                ) : (
                  displayedData.map((record, index) => (
                    <tr
                      key={record.id}
                      onClick={canEditRow ? () => navigate(getNavigatePath(record, 'edit')) : undefined}
                      onKeyDown={canEditRow ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(getNavigatePath(record, 'edit')); } } : undefined}
                      tabIndex={canEditRow ? 0 : undefined}
                      className={`transition-colors ${canEditRow ? "cursor-pointer hover:bg-blue-50" : "hover:bg-slate-50"}`}
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selectedRecords.has(record.id)} onChange={() => handleSelectRecord(record.id)} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500" /></td>
                      <td
                        className="px-3 py-3 whitespace-nowrap sticky left-12 z-10 bg-white border-r border-slate-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-2">
                          <button onClick={() => navigate(getNavigatePath(record, 'view'))} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Xem"><Eye className="w-4 h-4" /></button>
                          <button onClick={() => navigate(getNavigatePath(record, 'edit'))} className="p-1.5 text-slate-600 hover:bg-slate-100 rounded transition-colors" title="Sửa" data-testid={`btn-edit-${record.id}`}><Edit className="w-4 h-4" /></button>
                          <button onClick={() => openDeleteDialog(record)} className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors" title="Xóa" data-testid={`btn-delete-${record.id}`}><Trash2 className="w-4 h-4" /></button>
                          <button onClick={() => handleExportRecords([record])} className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors" title="Xuất"><Download className="w-4 h-4" /></button>
                          <button
                            onClick={() => navigate("/transfer-return", {
                              state: {
                                preselectedRecord: { id: record.id, caseNumber: record.caseNumber },
                                sourceScreen: "comprehensive-list",
                              },
                            })}
                            className="p-1.5 text-purple-600 hover:bg-purple-50 rounded transition-colors"
                            title="Chuyển xử lý"
                            data-testid={`btn-transfer-${record.id}`}
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{startIndex + index + 1}</td>
                      <td className="px-4 py-3"><span className="text-sm font-medium text-blue-600 hover:text-blue-700 cursor-pointer">{record.caseNumber}</span></td>
                      <td className="px-4 py-3">{getTypeBadge(record.type, record.typeLabel)}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{formatDate(record.receivedDate)}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{record.district}</td>
                      <td className="px-4 py-3">{getStatusBadge(record.statusBadge, record.statusLabel)}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{record.createdBy}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className={`text-sm ${isOverdue(record.deadline, record) ? "text-red-600 font-medium" : "text-slate-700"}`}>{formatDate(record.deadline)}</span>
                          {isOverdue(record.deadline, record) && <span className="text-xs text-red-600">Quá hạn</span>}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="border-t border-slate-200 px-6 py-4 flex items-center justify-between">
            <div className="text-sm text-slate-600">Hiển thị {startIndex + 1} - {Math.min(startIndex + recordsPerPage, filteredData.length)} trong số {filteredData.length} hồ sơ</div>
            <div className="flex items-center gap-2">
              <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1.5 border border-slate-300 rounded text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">Trước</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button key={page} onClick={() => setCurrentPage(page)} className={`px-3 py-1.5 border rounded text-sm transition-colors ${currentPage === page ? "bg-blue-600 text-white border-blue-600" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}>{page}</button>
              ))}
              <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1.5 border border-slate-300 rounded text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">Sau</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Dialog xác nhận xóa ────────────────────────── */}
      {deleteDialogOpen && recordToDelete && (
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
              <p className="text-slate-700">Bạn có chắc chắn muốn xóa hồ sơ này? Thao tác này không thể hoàn tác.</p>
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm font-medium text-red-900">Số hồ sơ: <span className="font-bold">{recordToDelete.caseNumber}</span></p>
                <p className="text-sm text-red-800 mt-1">Loại: {recordToDelete.typeLabel} — Đơn vị: {recordToDelete.district}</p>
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

export default ComprehensiveListPage;
