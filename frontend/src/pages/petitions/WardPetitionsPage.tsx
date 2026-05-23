/**
 * WardPetitionsPage — Đơn thư theo phường/xã
 *
 * Mirror cấu trúc WardCasesPage / WardIncidentsPage: 4 KPI cards, advanced
 * filter panel, sticky action column, status + priority badges có màu, export
 * Excel button. Backend hỗ trợ wardTeamId (v0.36.0.0) + /petitions/export/ward
 * (sync với 3 màn hình ward đồng bộ).
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Download,
  RotateCcw,
  Filter,
  ChevronDown,
  ChevronUp,
  Eye,
  Calendar,
  MapPin,
  AlertTriangle,
  FileText,
  Clock,
  CheckCircle,
  User,
} from 'lucide-react';
import { api } from '@/lib/api';
import { PetitionStatus, LoaiDon } from '@/shared/enums/generated';
import {
  PETITION_STATUS_LABEL,
  PETITION_STATUS_BADGE,
  LOAI_DON_OPTIONS,
  LOAI_DON_LABEL,
  BADGE_DEFAULT,
} from '@/shared/enums/status-labels';
import { WardFilterDropdown } from '@/components/WardFilterDropdown';

interface PetitionRow {
  id: string;
  stt: string;
  senderName: string;
  petitionType?: LoaiDon | null;
  receivedDate?: string | null;
  status: PetitionStatus;
  summary?: string | null;
  priority?: string | null;
  assignedTeam?: { ward?: { name?: string | null } | null } | null;
}

interface FilterData {
  quickSearch: string;
  fromDate: string;
  toDate: string;
  petitionType: string;
  status: string;
}

const PROCESSING_STATUSES: PetitionStatus[] = [
  PetitionStatus.DANG_XU_LY,
  PetitionStatus.CHO_PHE_DUYET,
];
const RESOLVED_STATUSES: PetitionStatus[] = [
  PetitionStatus.DA_GIAI_QUYET,
  PetitionStatus.DA_CHUYEN_VU_VIEC,
  PetitionStatus.DA_CHUYEN_VU_AN,
];

export default function WardPetitionsPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<PetitionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [wardTeamId, setWardTeamId] = useState<string>('');
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [filters, setFilters] = useState<FilterData>({
    quickSearch: '',
    fromDate: '',
    toDate: '',
    petitionType: '',
    status: '',
  });

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const params: Record<string, string> = { limit: '100' };
        if (wardTeamId) params.wardTeamId = wardTeamId;
        const resp = await api.get('/petitions', { params });
        const data = resp.data?.data ?? resp.data ?? [];
        setRows(Array.isArray(data) ? data : []);
      } catch {
        setRows([]);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [wardTeamId]);

  const filteredData = useMemo(() => {
    return rows.filter((p) => {
      if (filters.quickSearch) {
        const q = filters.quickSearch.toLowerCase();
        const match =
          p.stt?.toLowerCase().includes(q) ||
          p.senderName?.toLowerCase().includes(q) ||
          p.summary?.toLowerCase().includes(q);
        if (!match) return false;
      }
      if (filters.fromDate && p.receivedDate) {
        if (p.receivedDate.slice(0, 10) < filters.fromDate) return false;
      }
      if (filters.toDate && p.receivedDate) {
        if (p.receivedDate.slice(0, 10) > filters.toDate) return false;
      }
      if (filters.petitionType && p.petitionType !== filters.petitionType) return false;
      if (filters.status && p.status !== filters.status) return false;
      return true;
    });
  }, [rows, filters]);

  const handleResetFilters = () => {
    setFilters({
      quickSearch: '',
      fromDate: '',
      toDate: '',
      petitionType: '',
      status: '',
    });
  };

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const res = await api.get('/petitions/export/ward', {
        params: {
          unitId: wardTeamId || undefined,
          fromDate: filters.fromDate || undefined,
          toDate: filters.toDate || undefined,
        },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DonThuPhuongXa_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert('Xuất Excel thất bại. Vui lòng thử lại.');
    } finally {
      setIsExporting(false);
    }
  }, [wardTeamId, filters.fromDate, filters.toDate]);

  const totalCount = filteredData.length;
  const pendingCount = filteredData.filter((p) => p.status === PetitionStatus.MOI_TIEP_NHAN).length;
  const processingCount = filteredData.filter((p) => PROCESSING_STATUSES.includes(p.status)).length;
  const resolvedCount = filteredData.filter((p) => RESOLVED_STATUSES.includes(p.status)).length;

  const getStatusBadge = (row: PetitionRow) => {
    const cls = PETITION_STATUS_BADGE[row.status] ?? BADGE_DEFAULT;
    const label = PETITION_STATUS_LABEL[row.status] ?? row.status;
    return (
      <span
        data-testid={`status-badge-${row.status}-${row.id}`}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${cls}`}
      >
        {label}
      </span>
    );
  };

  const getPriorityBadge = (row: PetitionRow) => {
    const p = (row.priority ?? '').trim();
    let cls = 'bg-slate-100 text-slate-500 border border-slate-200';
    let display = '—';
    if (p === 'Cao') {
      cls = 'bg-red-100 text-red-800 border border-red-300';
      display = p;
    } else if (p === 'Trung bình') {
      cls = 'bg-yellow-100 text-yellow-800 border border-yellow-300';
      display = p;
    } else if (p === 'Thấp') {
      cls = 'bg-slate-100 text-slate-700 border border-slate-300';
      display = p;
    }
    return (
      <span
        data-testid={`priority-badge-${row.id}`}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${cls}`}
      >
        {p === 'Cao' && <AlertTriangle className="w-3 h-3" />}
        {display}
      </span>
    );
  };

  return (
    <div className="p-6 space-y-6" data-testid="ward-petitions-page">
      <div>
        <h1 className="text-2xl font-bold text-[#003973]">Đơn thư theo phường/xã</h1>
        <p className="text-slate-600 text-sm mt-1">
          Danh sách đơn thư (Tố cáo, Khiếu nại, Kiến nghị, Phản ánh) theo địa bàn quản lý của tổ phường/xã.
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div data-testid="kpi-card-total" className="bg-white rounded-lg border-2 border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 mb-1">Tổng đơn thư</p>
              <p className="text-3xl font-bold text-[#003973]">{totalCount}</p>
            </div>
            <div className="w-12 h-12 bg-[#003973]/10 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-[#003973]" />
            </div>
          </div>
        </div>

        <div data-testid="kpi-card-pending" className="bg-white rounded-lg border-2 border-amber-200 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-amber-700 font-medium mb-1">Chờ xử lý</p>
              <p className="text-3xl font-bold text-amber-600">{pendingCount}</p>
            </div>
            <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
          </div>
        </div>

        <div data-testid="kpi-card-processing" className="bg-white rounded-lg border-2 border-blue-200 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-700 font-medium mb-1">Đang xử lý</p>
              <p className="text-3xl font-bold text-blue-600">{processingCount}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Search className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div data-testid="kpi-card-resolved" className="bg-white rounded-lg border-2 border-green-200 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-700 font-medium mb-1">Đã giải quyết</p>
              <p className="text-3xl font-bold text-green-600">{resolvedCount}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filter actions row */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-slate-600">
          {loading ? (
            <span>Đang tải...</span>
          ) : (
            <>Hiển thị <span className="font-medium text-[#003973]">{filteredData.length}</span> đơn thư</>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowAdvancedFilter((v) => !v)}
            data-testid="filter-toggle-btn"
            className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg transition-colors ${
              showAdvancedFilter
                ? 'bg-[#003973]/10 border-[#003973] text-[#003973]'
                : 'border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-4 h-4" /> Bộ lọc
            {showAdvancedFilter ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            data-testid="export-excel-btn"
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            {isExporting ? 'Đang xuất...' : 'Xuất Excel'}
          </button>
          <button
            type="button"
            onClick={handleResetFilters}
            data-testid="reset-filters-btn"
            className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <RotateCcw className="w-4 h-4" /> Làm mới
          </button>
        </div>
      </div>

      {/* Search + Advanced filter */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              data-testid="quick-search-input"
              value={filters.quickSearch}
              onChange={(e) => setFilters({ ...filters, quickSearch: e.target.value })}
              placeholder="Tìm kiếm theo STT, Người gửi, Tóm tắt..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973] focus:border-transparent"
            />
          </div>
          <WardFilterDropdown value={wardTeamId} onChange={(v) => setWardTeamId(v ?? '')} />
        </div>

        {showAdvancedFilter && (
          <div className="pt-4 border-t border-slate-200" data-testid="advanced-filter-panel">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Từ ngày</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="date"
                    data-testid="filter-from-date"
                    value={filters.fromDate}
                    onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })}
                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Đến ngày</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="date"
                    data-testid="filter-to-date"
                    value={filters.toDate}
                    onChange={(e) => setFilters({ ...filters, toDate: e.target.value })}
                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Loại đơn</label>
                <select
                  data-testid="filter-petition-type"
                  value={filters.petitionType}
                  onChange={(e) => setFilters({ ...filters, petitionType: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973] bg-white"
                >
                  <option value="">Tất cả</option>
                  {LOAI_DON_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Trạng thái</label>
                <select
                  data-testid="filter-status"
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973] bg-white"
                >
                  <option value="">Tất cả</option>
                  {(Object.keys(PETITION_STATUS_LABEL) as PetitionStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {PETITION_STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="ward-petitions-table">
            <thead className="bg-[#003973]/5 border-b-2 border-[#003973]/20">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-bold text-[#003973] uppercase tracking-wider w-20 sticky left-0 bg-[#eef2f7] z-10 border-r border-slate-200">
                  Thao tác
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-[#003973] uppercase tracking-wider">STT</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-[#003973] uppercase tracking-wider">Người gửi</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-[#003973] uppercase tracking-wider">Loại đơn</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-[#003973] uppercase tracking-wider">Tóm tắt</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-[#003973] uppercase tracking-wider">Phường/Xã</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-[#003973] uppercase tracking-wider">Ngày nhận</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-[#003973] uppercase tracking-wider">Mức độ</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-[#003973] uppercase tracking-wider">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center" data-testid="ward-petitions-loading">
                    <p className="text-slate-500">Đang tải dữ liệu...</p>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center" data-testid="ward-petitions-empty">
                    <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">Không tìm thấy đơn thư nào</p>
                    <p className="text-sm text-slate-400 mt-1">Thử điều chỉnh bộ lọc tìm kiếm</p>
                  </td>
                </tr>
              ) : (
                filteredData.map((p) => {
                  const wardName = p.assignedTeam?.ward?.name ?? '';
                  return (
                    <tr
                      key={p.id}
                      data-testid={`petition-row-${p.id}`}
                      onClick={() => navigate(`/petitions/${p.id}/edit`)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          navigate(`/petitions/${p.id}/edit`);
                        }
                      }}
                      tabIndex={0}
                      className="cursor-pointer hover:bg-blue-50 transition-colors"
                    >
                      <td className="px-3 py-3 whitespace-nowrap sticky left-0 z-10 bg-white border-r border-slate-100" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => navigate(`/petitions/${p.id}/edit`)}
                          data-testid={`view-btn-${p.id}`}
                          className="p-1.5 text-[#003973] hover:bg-[#003973]/10 rounded transition-colors"
                          title="Xem chi tiết"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                      <td className="px-4 py-3"><span className="text-sm font-mono font-bold text-[#003973]">{p.stt}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-sm text-slate-800">{p.senderName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-slate-700">
                          {p.petitionType ? LOAI_DON_LABEL[p.petitionType as LoaiDon] : '—'}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-slate-700 line-clamp-2 max-w-xs">{p.summary ?? ''}</p>
                      </td>
                      <td className="px-4 py-3" data-testid={`ward-cell-${p.id}`}>
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-green-600" />
                          <span className="text-sm font-medium text-slate-800">
                            {wardName || '—'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-sm text-slate-700">
                            {p.receivedDate ? new Date(p.receivedDate).toLocaleDateString('vi-VN') : ''}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">{getPriorityBadge(p)}</td>
                      <td className="px-4 py-3">{getStatusBadge(p)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
