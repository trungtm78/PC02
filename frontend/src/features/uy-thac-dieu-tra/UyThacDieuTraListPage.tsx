import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { formatVNDate } from "@/lib/dates";
import {
  Search,
  Plus,
  Eye,
  Filter,
  X,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  TRANG_THAI_PHAN_HOI_LABEL,
  TRANG_THAI_PHAN_HOI_BADGE,
  TRANG_THAI_PHAN_HOI_OPTIONS,
  LOAI_UY_THAC_LABEL,
  LOAI_UY_THAC_OPTIONS,
  CASE_STATUS_LABEL,
  CASE_STATUS_BADGE,
  CASE_STATUS_OPTIONS,
  type TrangThaiPhanHoi,
} from "@/shared/enums/status-labels";
import { CaseType } from "@/shared/enums/generated";

// ─── API types ────────────────────────────────────────────────────

interface UyThacFromApi {
  id: string;
  name: string;
  crime: string | null;
  caseCode: string | null;
  status: string | null;
  donViGiao: string | null;
  soQuyetDinhUyThac: string | null;
  ngayTiepNhan: string | null;
  thoiHanUyThac: string | null;
  loaiUyThac: string | null;
  ketQuaUyThac: string | null;
  ngayTraKetQua: string | null;
  metadata: Record<string, unknown> | null;
  trangThaiPhanHoi?: TrangThaiPhanHoi;
  investigator: { id: string; firstName?: string; lastName?: string; username: string } | null;
  createdBy: { id: string; firstName?: string; lastName?: string } | null;
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────

function computeTrangThai(row: UyThacFromApi): TrangThaiPhanHoi {
  if (row.trangThaiPhanHoi) return row.trangThaiPhanHoi;
  const meta = row.metadata as Record<string, unknown> | null;
  if (meta?.lyDoKhongThucHienDuoc) return 'KHONG_THUC_HIEN_DUOC';
  if (row.ketQuaUyThac && row.ngayTraKetQua) return 'DA_PHAN_HOI';
  if (row.thoiHanUyThac && new Date() > new Date(row.thoiHanUyThac)) return 'QUA_HAN';
  return 'CHUA_PHAN_HOI';
}

function getInvestigatorName(inv: UyThacFromApi['investigator']): string {
  if (!inv) return '—';
  return [inv.firstName, inv.lastName].filter(Boolean).join(' ') || inv.username;
}

// ─── Component ────────────────────────────────────────────────────

export default function UyThacDieuTraListPage() {
  const navigate = useNavigate();

  // Filters — raw input state
  const [search, setSearch]                   = useState('');
  const [caseStatus, setCaseStatus]           = useState('');
  const [trangThai, setTrangThai]             = useState<TrangThaiPhanHoi | ''>('');
  const [loaiUyThac, setLoaiUyThac]           = useState('');
  const [donViGiao, setDonViGiao]             = useState('');
  const [ngayTiepNhanFrom, setNgayTiepNhanFrom] = useState('');
  const [ngayTiepNhanTo, setNgayTiepNhanTo]   = useState('');
  const [investigatorSearch, setInvestigatorSearch] = useState('');
  const [showFilters, setShowFilters]         = useState(false);

  // Debounced values (300ms — same as IncidentListPage)
  const [debouncedSearch, setDebouncedSearch]             = useState('');
  const [debouncedInvestigator, setDebouncedInvestigator] = useState('');

  // Data
  const [rows, setRows]           = useState<UyThacFromApi[]>([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(0);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const LIMIT = 20;

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Debounce investigator name
  useEffect(() => {
    const t = setTimeout(() => setDebouncedInvestigator(investigatorSearch), 300);
    return () => clearTimeout(t);
  }, [investigatorSearch]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('caseType', CaseType.UY_THAC_DIEU_TRA);
      params.set('offset', String(page * LIMIT));
      params.set('limit', String(LIMIT));
      if (debouncedSearch)     params.set('search', debouncedSearch);
      if (caseStatus)          params.set('status', caseStatus);
      if (trangThai)           params.set('trangThaiPhanHoi', trangThai);
      if (loaiUyThac)          params.set('loaiUyThac', loaiUyThac);
      if (donViGiao)           params.set('donViGiao', donViGiao);
      if (ngayTiepNhanFrom)    params.set('ngayTiepNhanFrom', ngayTiepNhanFrom);
      if (ngayTiepNhanTo)      params.set('ngayTiepNhanTo', ngayTiepNhanTo);
      if (debouncedInvestigator) params.set('investigatorName', debouncedInvestigator);

      const res = await api.get(`/cases?${params.toString()}`);
      setRows(res.data?.data ?? []);
      setTotal(res.data?.total ?? 0);
    } catch {
      setError('Không tải được dữ liệu. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, caseStatus, trangThai, loaiUyThac, donViGiao, ngayTiepNhanFrom, ngayTiepNhanTo, debouncedInvestigator, page]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  function resetFilters() {
    setSearch('');
    setCaseStatus('');
    setTrangThai('');
    setLoaiUyThac('');
    setDonViGiao('');
    setNgayTiepNhanFrom('');
    setNgayTiepNhanTo('');
    setInvestigatorSearch('');
    setPage(0);
  }

  async function handleDelete(id: string) {
    if (!confirm("Xóa ủy thác điều tra này? Hồ sơ vụ án gốc vẫn được giữ nguyên.")) return;
    setDeletingId(id);
    try {
      await api.delete(`/cases/${id}`, { data: { reason: 'Xóa ủy thác điều tra theo yêu cầu' } });
      void fetchData();
    } catch {
      alert('Xóa thất bại. Vui lòng thử lại.');
    } finally {
      setDeletingId(null);
    }
  }

  const hasFilters = !!(search || caseStatus || trangThai || loaiUyThac || donViGiao || ngayTiepNhanFrom || ngayTiepNhanTo || investigatorSearch);
  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader
        title="Ủy Thác Điều Tra"
        subtitle="Điều 171 BLTTHS 2015 — TT 119/2021/TT-BCA"
        actions={
          <button
            onClick={() => navigate('/uy-thac-dieu-tra/new')}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Nhập ủy thác
          </button>
        }
      />

      {/* Search + filter bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Tìm kiếm tên, đơn vị giao, số QĐ, đối tượng..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg ${showFilters ? 'bg-blue-50 border-blue-400 text-blue-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
        >
          <Filter className="w-4 h-4" />
          Lọc {hasFilters && <span className="bg-blue-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs">!</span>}
        </button>
        {hasFilters && (
          <button onClick={resetFilters} className="flex items-center gap-1 px-3 py-2 text-sm text-gray-500 border border-gray-300 rounded-lg hover:bg-gray-50">
            <RotateCcw className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Expanded filters — 4-col grid, 2 rows */}
      {showFilters && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
          {/* Row 1 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Trạng thái Vụ án</label>
            <select
              value={caseStatus}
              onChange={(e) => { setCaseStatus(e.target.value); setPage(0); }}
              className="w-full text-sm border border-gray-300 rounded-md py-1.5 px-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">— Tất cả —</option>
              {CASE_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Trạng thái phản hồi</label>
            <select
              value={trangThai}
              onChange={(e) => { setTrangThai(e.target.value as TrangThaiPhanHoi | ''); setPage(0); }}
              className="w-full text-sm border border-gray-300 rounded-md py-1.5 px-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">— Tất cả —</option>
              {TRANG_THAI_PHAN_HOI_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Loại ủy thác</label>
            <select
              value={loaiUyThac}
              onChange={(e) => { setLoaiUyThac(e.target.value); setPage(0); }}
              className="w-full text-sm border border-gray-300 rounded-md py-1.5 px-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">— Tất cả —</option>
              {LOAI_UY_THAC_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Đơn vị giao</label>
            <input
              type="text"
              placeholder="PC01, CA quận X..."
              value={donViGiao}
              onChange={(e) => { setDonViGiao(e.target.value); setPage(0); }}
              className="w-full text-sm border border-gray-300 rounded-md py-1.5 px-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          {/* Row 2 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Ngày tiếp nhận từ</label>
            <input
              type="date"
              value={ngayTiepNhanFrom}
              onChange={(e) => { setNgayTiepNhanFrom(e.target.value); setPage(0); }}
              className="w-full text-sm border border-gray-300 rounded-md py-1.5 px-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Ngày tiếp nhận đến</label>
            <input
              type="date"
              value={ngayTiepNhanTo}
              onChange={(e) => { setNgayTiepNhanTo(e.target.value); setPage(0); }}
              className="w-full text-sm border border-gray-300 rounded-md py-1.5 px-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Điều tra viên</label>
            <input
              type="text"
              placeholder="Tên điều tra viên..."
              value={investigatorSearch}
              onChange={(e) => { setInvestigatorSearch(e.target.value); setPage(0); }}
              className="w-full text-sm border border-gray-300 rounded-md py-1.5 px-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="text-xs text-gray-500">
        {loading ? 'Đang tải...' : `${total} kết quả`}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <X className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 w-10">#</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Mã hồ sơ</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Ngày tiếp nhận</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Đơn vị giao</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Số QĐ/Phiếu</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Đối tượng nghi vấn</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Tội danh</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Điều tra viên</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Thời hạn</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Trạng thái</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Người nhập</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 w-24">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={12} className="px-3 py-8 text-center text-sm text-gray-400">
                  {hasFilters ? 'Không có ủy thác phù hợp với bộ lọc.' : 'Chưa có ủy thác điều tra nào.'}
                </td>
              </tr>
            )}
            {rows.map((row, idx) => {
              const trangThaiVal = computeTrangThai(row);
              const isOverdue = trangThaiVal === 'QUA_HAN';
              const nghiVan = (row.metadata as Record<string, unknown> | null)?.nghiVanDoiTuong as string | undefined;
              return (
                <tr
                  key={row.id}
                  className={isOverdue ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'}
                >
                  <td className="px-3 py-2 text-xs text-gray-400">{page * LIMIT + idx + 1}</td>
                  <td className="px-3 py-2 text-xs font-mono text-blue-700">
                    {row.caseCode ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-700">
                    {row.ngayTiepNhan ? formatVNDate(row.ngayTiepNhan) : '—'}
                  </td>
                  <td className="px-3 py-2 text-xs font-medium text-gray-800">
                    {row.donViGiao ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600">
                    {row.soQuyetDinhUyThac ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-700 max-w-[180px] truncate" title={nghiVan}>
                    {nghiVan ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600 max-w-[140px] truncate" title={row.crime ?? undefined}>
                    {row.crime ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-700">
                    {getInvestigatorName(row.investigator)}
                  </td>
                  <td className={`px-3 py-2 text-xs ${isOverdue ? 'text-red-700 font-medium' : 'text-gray-600'}`}>
                    {row.thoiHanUyThac ? formatVNDate(row.thoiHanUyThac) : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <span className={TRANG_THAI_PHAN_HOI_BADGE[trangThaiVal]}>
                      {TRANG_THAI_PHAN_HOI_LABEL[trangThaiVal]}
                    </span>
                    {row.loaiUyThac && (
                      <span className="block mt-0.5 text-xs text-gray-400">
                        {LOAI_UY_THAC_LABEL[row.loaiUyThac as keyof typeof LOAI_UY_THAC_LABEL] ?? row.loaiUyThac}
                      </span>
                    )}
                    {row.status && (
                      <span className={`block mt-0.5 text-xs border rounded px-1 py-0.5 w-fit ${CASE_STATUS_BADGE[row.status as keyof typeof CASE_STATUS_BADGE] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                        {CASE_STATUS_LABEL[row.status as keyof typeof CASE_STATUS_LABEL] ?? row.status}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600">
                    {row.createdBy
                      ? [row.createdBy.firstName, row.createdBy.lastName].filter(Boolean).join(' ') || '—'
                      : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <button
                        onClick={() => navigate(`/uy-thac-dieu-tra/${row.id}/edit`)}
                        className="p-1 rounded hover:bg-gray-200 text-gray-500"
                        title="Xem / Chỉnh sửa"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => void handleDelete(row.id)}
                        disabled={deletingId === row.id}
                        className="p-1 rounded hover:bg-red-100 text-red-400 hover:text-red-600 disabled:opacity-40"
                        title="Xóa ủy thác"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>Trang {page + 1} / {totalPages}</span>
          <div className="flex gap-2">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1 border border-gray-300 rounded disabled:opacity-40"
            >
              ‹ Trước
            </button>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1 border border-gray-300 rounded disabled:opacity-40"
            >
              Sau ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
