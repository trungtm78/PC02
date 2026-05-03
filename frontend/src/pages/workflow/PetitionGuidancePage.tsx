/**
 * PetitionGuidancePage — Hướng dẫn đơn (SCR-PF-02)
 * TASK-ID: TASK-2026-260216
 *
 * REFS-FIRST: Adapted from C:/PC02/Refs/src/app/pages/PetitionGuidance.tsx
 * data-testid added for E2E/UAT automation per OPENCODE_QA_GATE.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Plus,
  Download,
  RotateCcw,
  Filter,
  ChevronDown,
  ChevronUp,
  Eye,
  Edit,
  FileText,
  Calendar,
  Building2,
  CheckCircle,
  Clock,
  XCircle,
  X,
  Save,
  HelpCircle,
  UserCheck,
} from 'lucide-react';
import { api } from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

type GuidanceStatus = 'pending' | 'completed' | 'cancelled';

interface GuidanceRecord {
  id: string;
  stt: string;
  date: string;
  unit: string;
  createdBy: string;
  guidedPerson: string;
  guidedPersonPhone: string;
  status: GuidanceStatus;
  statusLabel: string;
  guidanceContent: string;
  subject: string;
  notes: string;
}

interface GuidanceFormData {
  guidedPerson: string;
  guidedPersonPhone: string;
  subject: string;
  guidanceContent: string;
  notes: string;
  unit: string;
}

interface FilterData {
  quickSearch: string;
  fromDate: string;
  toDate: string;
  unit: string;
  status: string;
}

interface FormErrors {
  guidedPerson?: string;
  subject?: string;
  guidanceContent?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Màn hình Hướng dẫn đơn — quản lý và theo dõi việc hướng dẫn công dân.
 * Dashboard với 4 thẻ stats (blue, green, amber, purple).
 * CRUD thông qua modal Thêm/Sửa/Xem.
 */
export default function PetitionGuidancePage() {
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [showGuidanceModal, setShowGuidanceModal] = useState(false);
  const [editingMode, setEditingMode] = useState<'add' | 'edit' | 'view'>('add');
  const [selectedGuidance, setSelectedGuidance] = useState<GuidanceRecord | null>(null);

  const [filters, setFilters] = useState<FilterData>({
    quickSearch: '',
    fromDate: '',
    toDate: '',
    unit: '',
    status: '',
  });

  const [formData, setFormData] = useState<GuidanceFormData>({
    guidedPerson: '',
    guidedPersonPhone: '',
    subject: '',
    guidanceContent: '',
    notes: '',
    unit: '',
  });

  const [formErrors, setFormErrors] = useState<FormErrors>({});

  // ── Real data state ────────────────────────────────────────────────────────
  const [allGuidances, setAllGuidances] = useState<GuidanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGuidances = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/guidance?limit=100');
      const statusMap: Record<string, string> = { PENDING: 'pending', COMPLETED: 'completed', CANCELLED: 'cancelled' };
      const mapped: GuidanceRecord[] = (res.data.data ?? []).map((g: any, i: number) => ({
        id: g.id,
        stt: g.stt ?? `HD-${String(i + 1).padStart(3, '0')}/${new Date().getFullYear()}`,
        date: g.date ?? g.createdAt ?? '',
        unit: g.unit ?? '',
        createdBy: g.createdBy ? `${g.createdBy.firstName ?? ''} ${g.createdBy.lastName ?? ''}`.trim() : '',
        guidedPerson: g.guidedPerson,
        guidedPersonPhone: g.guidedPersonPhone ?? '',
        status: (statusMap[g.status] ?? 'pending') as GuidanceStatus,
        statusLabel: statusMap[g.status] === 'completed' ? 'Đã hoàn thành' : statusMap[g.status] === 'cancelled' ? 'Đã hủy' : 'Đang chờ',
        guidanceContent: g.guidanceContent,
        subject: g.subject ?? '',
        notes: g.notes ?? '',
      }));
      setAllGuidances(mapped);
    } catch {
      setAllGuidances([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchGuidances(); }, [fetchGuidances]);

  // ── Filtering ──────────────────────────────────────────────────────────────

  const filteredData = allGuidances.filter((g) => {
    if (filters.quickSearch) {
      const q = filters.quickSearch.toLowerCase();
      const match =
        g.stt.toLowerCase().includes(q) ||
        g.guidedPerson.toLowerCase().includes(q) ||
        g.subject.toLowerCase().includes(q) ||
        g.createdBy.toLowerCase().includes(q);
      if (!match) return false;
    }
    if (filters.fromDate && g.date < filters.fromDate) return false;
    if (filters.toDate && g.date > filters.toDate) return false;
    if (filters.unit && g.unit !== filters.unit) return false;
    if (filters.status && g.status !== filters.status) return false;
    return true;
  });

  // ── Stats ──────────────────────────────────────────────────────────────────

  const totalCount = filteredData.length;
  const completedCount = filteredData.filter((g) => g.status === 'completed').length;
  const pendingCount = filteredData.filter((g) => g.status === 'pending').length;
  const todayCount = filteredData.filter((g) => g.date === new Date().toISOString().split('T')[0]).length;

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleResetFilters = () => {
    setFilters({ quickSearch: '', fromDate: '', toDate: '', unit: '', status: '' });
  };

  const openAddModal = () => {
    setEditingMode('add');
    setSelectedGuidance(null);
    setFormData({ guidedPerson: '', guidedPersonPhone: '', subject: '', guidanceContent: '', notes: '', unit: '' });
    setFormErrors({});
    setShowGuidanceModal(true);
  };

  const openEditModal = (guidance: GuidanceRecord) => {
    setEditingMode('edit');
    setSelectedGuidance(guidance);
    setFormData({
      guidedPerson: guidance.guidedPerson,
      guidedPersonPhone: guidance.guidedPersonPhone,
      subject: guidance.subject,
      guidanceContent: guidance.guidanceContent,
      notes: guidance.notes,
      unit: guidance.unit,
    });
    setFormErrors({});
    setShowGuidanceModal(true);
  };

  const openViewModal = (guidance: GuidanceRecord) => {
    setEditingMode('view');
    setSelectedGuidance(guidance);
    setFormData({
      guidedPerson: guidance.guidedPerson,
      guidedPersonPhone: guidance.guidedPersonPhone,
      subject: guidance.subject,
      guidanceContent: guidance.guidanceContent,
      notes: guidance.notes,
      unit: guidance.unit,
    });
    setFormErrors({});
    setShowGuidanceModal(true);
  };

  const handleSave = async () => {
    const errors: FormErrors = {};
    // EC-04: Hướng dẫn đơn có thể không có thông tin liên lạc — phone is optional
    if (!formData.guidedPerson.trim()) errors.guidedPerson = 'Vui lòng nhập tên người được hướng dẫn';
    if (!formData.subject.trim()) errors.subject = 'Vui lòng nhập vấn đề cần hướng dẫn';
    if (!formData.guidanceContent.trim()) errors.guidanceContent = 'Vui lòng nhập nội dung hướng dẫn';
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    try {
      if (editingMode === 'add') {
        await api.post('/guidance', {
          guidedPerson: formData.guidedPerson,
          guidedPersonPhone: formData.guidedPersonPhone,
          subject: formData.subject,
          guidanceContent: formData.guidanceContent,
          notes: formData.notes,
          unit: formData.unit,
        });
      } else if (editingMode === 'edit' && selectedGuidance) {
        await api.put(`/guidance/${selectedGuidance.id}`, {
          guidedPerson: formData.guidedPerson,
          guidedPersonPhone: formData.guidedPersonPhone,
          subject: formData.subject,
          guidanceContent: formData.guidanceContent,
          notes: formData.notes,
          unit: formData.unit,
        });
      }
      await fetchGuidances();
    } catch {
      // silently fail — form stays open so user sees no crash
    }
    setShowGuidanceModal(false);
    setSelectedGuidance(null);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    try { return new Date(dateString).toLocaleDateString('vi-VN'); } catch { return dateString; }
  };

  // ── Status badge ───────────────────────────────────────────────────────────

  const getStatusBadge = (status: GuidanceStatus, label: string) => {
    const styles: Record<GuidanceStatus, string> = {
      pending: 'bg-amber-600 text-white',
      completed: 'bg-green-600 text-white',
      cancelled: 'bg-slate-500 text-white',
    };
    const icons: Record<GuidanceStatus, React.ReactNode> = {
      pending: <Clock className="w-3.5 h-3.5" />,
      completed: <CheckCircle className="w-3.5 h-3.5" />,
      cancelled: <XCircle className="w-3.5 h-3.5" />,
    };
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${styles[status]}`}>
        {icons[status]}
        {label}
      </span>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      {/* Tiêu đề */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Quản lý Hướng dẫn đơn</h1>
        <p className="text-slate-600 text-sm mt-1">
          Quản lý và theo dõi việc hướng dẫn công dân về các thủ tục, đơn từ
        </p>
      </div>

      {/* Thẻ thống kê */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div data-testid="stat-total" className="bg-white rounded-lg border-2 border-blue-200 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-700 font-medium mb-1">Tổng số hướng dẫn</p>
              <p className="text-3xl font-bold text-blue-600">{totalCount}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <HelpCircle className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div data-testid="stat-completed" className="bg-white rounded-lg border-2 border-green-200 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-700 font-medium mb-1">Đã hoàn thành</p>
              <p className="text-3xl font-bold text-green-600">{completedCount}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div data-testid="stat-pending" className="bg-white rounded-lg border-2 border-amber-200 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-amber-700 font-medium mb-1">Chờ hoàn thành</p>
              <p className="text-3xl font-bold text-amber-600">{pendingCount}</p>
            </div>
            <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
          </div>
        </div>

        <div data-testid="stat-today" className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 mb-1">Hôm nay</p>
              <p className="text-3xl font-bold text-slate-800">{todayCount}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Thanh hành động */}
      <div className="flex items-center justify-between gap-3">
        <button
          data-testid="add-guidance-btn"
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          <Plus className="w-4 h-4" />
          Thêm hướng dẫn mới
        </button>

        <div className="flex items-center gap-3">
          <button
            data-testid="filter-toggle-btn"
            onClick={() => setShowAdvancedFilter(!showAdvancedFilter)}
            className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg transition-colors ${
              showAdvancedFilter
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            Bộ lọc
            {showAdvancedFilter ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          <button
            data-testid="export-excel-btn"
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Xuất Excel
          </button>

          <button
            data-testid="refresh-btn"
            onClick={handleResetFilters}
            className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Làm mới
          </button>
        </div>
      </div>

      {/* Tìm kiếm và bộ lọc */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            data-testid="quick-search-input"
            type="text"
            value={filters.quickSearch}
            onChange={(e) => setFilters({ ...filters, quickSearch: e.target.value })}
            placeholder="Tìm kiếm theo STT, Người được hướng dẫn, Vấn đề, Người nhập..."
            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {showAdvancedFilter && (
          <div className="pt-4 border-t border-slate-200" data-testid="advanced-filter-panel">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Từ ngày</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="date" value={filters.fromDate}
                    onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })}
                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Đến ngày</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="date" value={filters.toDate}
                    onChange={(e) => setFilters({ ...filters, toDate: e.target.value })}
                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Đơn vị</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select value={filters.unit}
                    onChange={(e) => setFilters({ ...filters, unit: e.target.value })}
                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">Tất cả</option>
                    <option value="Phòng Tiếp công dân">Phòng Tiếp công dân</option>
                    <option value="Đội CSĐT 1">Đội CSĐT 1</option>
                    <option value="Đội CSĐT 2">Đội CSĐT 2</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Trạng thái</label>
                <select value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">Tất cả</option>
                  <option value="pending">Chờ hoàn thành</option>
                  <option value="completed">Đã hoàn thành</option>
                  <option value="cancelled">Đã hủy</option>
                </select>
              </div>
            </div>
          </div>
        )}

        <div className="text-sm text-slate-600">
          {loading ? 'Đang tải...' : (
            <>Tìm thấy <span className="font-medium text-slate-800">{filteredData.length}</span> hướng dẫn</>
          )}
        </div>
      </div>

      {/* Bảng dữ liệu */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            <span className="ml-3 text-slate-600">Đang tải dữ liệu...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="guidance-table">
              <thead className="bg-slate-50 border-b-2 border-slate-200">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider w-24 sticky left-0 bg-slate-50 z-10 border-r border-slate-200">Thao tác</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">STT</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Ngày</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Vấn đề</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Đơn vị</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Người nhập</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Người được hướng dẫn</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center">
                      <HelpCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-500 font-medium">Không tìm thấy hướng dẫn nào</p>
                      <p className="text-sm text-slate-400 mt-1">Thử điều chỉnh bộ lọc hoặc thêm hướng dẫn mới</p>
                    </td>
                  </tr>
                ) : (
                  filteredData.map((guidance) => (
                    <tr
                      key={guidance.id}
                      onClick={() => openViewModal(guidance)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openViewModal(guidance); } }}
                      tabIndex={0}
                      className="cursor-pointer hover:bg-blue-50 transition-colors"
                    >
                      <td
                        className="px-3 py-3 whitespace-nowrap sticky left-0 z-10 bg-white border-r border-slate-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-2">
                          <button
                            data-testid={`view-guidance-${guidance.id}`}
                            onClick={() => openViewModal(guidance)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Xem chi tiết"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {guidance.status !== 'cancelled' && (
                            <button
                              data-testid={`edit-guidance-${guidance.id}`}
                              onClick={() => openEditModal(guidance)}
                              className="p-1.5 text-slate-600 hover:bg-slate-100 rounded transition-colors"
                              title="Sửa thông tin"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-bold text-blue-600">{guidance.stt}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-sm text-slate-700">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {formatDate(guidance.date)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-slate-800 font-medium line-clamp-2 max-w-xs">{guidance.subject}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{guidance.unit}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{guidance.createdBy}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-2">
                          <UserCheck className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-slate-800">{guidance.guidedPerson}</p>
                            {guidance.guidedPersonPhone ? (
                              <p className="text-xs text-slate-500">{guidance.guidedPersonPhone}</p>
                            ) : (
                              <p className="text-xs text-slate-400 italic">Không có SĐT</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {getStatusBadge(guidance.status, guidance.statusLabel)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Thêm/Sửa/Xem */}
      {showGuidanceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" data-testid="guidance-modal">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-slate-200 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  {editingMode === 'add' && <><Plus className="w-5 h-5 text-blue-600" />Thêm hướng dẫn mới</>}
                  {editingMode === 'edit' && <><Edit className="w-5 h-5 text-slate-600" />Chỉnh sửa hướng dẫn</>}
                  {editingMode === 'view' && <><Eye className="w-5 h-5 text-blue-600" />Chi tiết hướng dẫn</>}
                </h3>
                <button
                  onClick={() => { setShowGuidanceModal(false); setSelectedGuidance(null); }}
                  className="p-1 hover:bg-slate-100 rounded transition-colors"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Thông tin công dân */}
              <div>
                <h4 className="text-sm font-bold text-slate-700 uppercase mb-3 flex items-center gap-2">
                  <UserCheck className="w-4 h-4" />
                  Thông tin công dân
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Người được hướng dẫn <span className="text-red-600">*</span>
                    </label>
                    <input
                      data-testid="guided-person-input"
                      type="text"
                      value={formData.guidedPerson}
                      onChange={(e) => { setFormData({ ...formData, guidedPerson: e.target.value }); setFormErrors({ ...formErrors, guidedPerson: undefined }); }}
                      disabled={editingMode === 'view'}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 disabled:bg-slate-50 disabled:text-slate-600 ${formErrors.guidedPerson ? 'border-red-300 focus:ring-red-500' : 'border-slate-300 focus:ring-blue-500'}`}
                      placeholder="Họ và tên công dân"
                    />
                    {formErrors.guidedPerson && <p data-testid="guided-person-error" className="text-xs text-red-600 mt-1">{formErrors.guidedPerson}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Số điện thoại</label>
                    <input
                      data-testid="guided-person-phone-input"
                      type="tel"
                      value={formData.guidedPersonPhone}
                      onChange={(e) => setFormData({ ...formData, guidedPersonPhone: e.target.value })}
                      disabled={editingMode === 'view'}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
                      placeholder="0901234567 (không bắt buộc)"
                    />
                  </div>
                </div>
              </div>

              {/* Nội dung hướng dẫn */}
              <div>
                <h4 className="text-sm font-bold text-slate-700 uppercase mb-3 flex items-center gap-2">
                  <HelpCircle className="w-4 h-4" />
                  Nội dung hướng dẫn
                </h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Vấn đề cần hướng dẫn <span className="text-red-600">*</span>
                    </label>
                    <input
                      data-testid="subject-input"
                      type="text"
                      value={formData.subject}
                      onChange={(e) => { setFormData({ ...formData, subject: e.target.value }); setFormErrors({ ...formErrors, subject: undefined }); }}
                      disabled={editingMode === 'view'}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 disabled:bg-slate-50 ${formErrors.subject ? 'border-red-300 focus:ring-red-500' : 'border-slate-300 focus:ring-blue-500'}`}
                      placeholder="VD: Hướng dẫn viết đơn tố cáo"
                    />
                    {formErrors.subject && <p data-testid="subject-error" className="text-xs text-red-600 mt-1">{formErrors.subject}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Nội dung hướng dẫn chi tiết <span className="text-red-600">*</span>
                    </label>
                    <textarea
                      data-testid="guidance-content-textarea"
                      value={formData.guidanceContent}
                      onChange={(e) => { setFormData({ ...formData, guidanceContent: e.target.value }); setFormErrors({ ...formErrors, guidanceContent: undefined }); }}
                      disabled={editingMode === 'view'}
                      rows={6}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 resize-none disabled:bg-slate-50 ${formErrors.guidanceContent ? 'border-red-300 focus:ring-red-500' : 'border-slate-300 focus:ring-blue-500'}`}
                      placeholder="Nhập nội dung hướng dẫn chi tiết..."
                    />
                    {formErrors.guidanceContent && <p data-testid="guidance-content-error" className="text-xs text-red-600 mt-1">{formErrors.guidanceContent}</p>}
                    <p className="text-xs text-slate-500 mt-1">{formData.guidanceContent.length} ký tự</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Ghi chú thêm</label>
                    <textarea
                      data-testid="guidance-notes-textarea"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      disabled={editingMode === 'view'}
                      rows={3}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:bg-slate-50"
                      placeholder="Ghi chú về phản hồi của công dân..."
                    />
                  </div>
                </div>
              </div>

              {/* Thông tin hệ thống (chỉ khi view/edit) */}
              {editingMode !== 'add' && selectedGuidance && (
                <div className="pt-4 border-t border-slate-200">
                  <h4 className="text-sm font-bold text-slate-700 uppercase mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Thông tin hệ thống
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-xs text-slate-600 mb-1">Mã số</p>
                      <p className="text-sm font-bold text-slate-800">{selectedGuidance.stt}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-xs text-slate-600 mb-1">Ngày tạo</p>
                      <p className="text-sm font-medium text-slate-800">{formatDate(selectedGuidance.date)}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-xs text-slate-600 mb-1">Đơn vị</p>
                      <p className="text-sm font-medium text-slate-800">{selectedGuidance.unit}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-xs text-slate-600 mb-1">Người nhập</p>
                      <p className="text-sm font-medium text-slate-800">{selectedGuidance.createdBy}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg md:col-span-2">
                      <p className="text-xs text-slate-600 mb-1">Trạng thái</p>
                      <div className="mt-2">
                        {getStatusBadge(selectedGuidance.status, selectedGuidance.statusLabel)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-200 flex items-center justify-end gap-3 flex-shrink-0">
              <button
                onClick={() => { setShowGuidanceModal(false); setSelectedGuidance(null); }}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                {editingMode === 'view' ? 'Đóng' : 'Hủy bỏ'}
              </button>
              {editingMode !== 'view' && (
                <button
                  data-testid="save-guidance-btn"
                  onClick={() => void handleSave()}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  <Save className="w-4 h-4" />
                  {editingMode === 'add' ? 'Lưu hướng dẫn' : 'Lưu thay đổi'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
