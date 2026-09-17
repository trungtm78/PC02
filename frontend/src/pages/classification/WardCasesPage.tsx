/**
 * WardCasesPage — Vụ án phường/xã.
 *
 * 17/09/2026: tìm kiếm, lọc, phân trang và thẻ KPI chạy ở MÁY CHỦ; phạm vi dữ liệu do máy chủ áp. Trước đó
 * màn tải 100 vụ án rồi lọc theo danh sách phường GÁN CỨNG ("Phường 2/4/6", "Quận 1/3") trên cột `unit`
 * rỗng 100% — cán bộ không phải quản trị thấy 0 dòng. Cột STT là số dòng, Mức độ gán cứng "Trung bình",
 * Bị can luôn rỗng: đều đã bỏ, cột nay đọc đúng trường thật (đo prod cùng ngày, xem ca kiểm của màn).
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Download,
  RotateCcw,
  Filter,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Eye,
  Trash2,
  Calendar,
  MapPin,
  Users,
  Scale,
  CheckCircle,
  PauseCircle,
} from 'lucide-react';
import { CaseStatus } from '@/shared/enums/generated';
import { CASE_STATUS_LABEL, CASE_STATUS_BADGE, BADGE_DEFAULT } from '@/shared/enums/status-labels';
import { ROLE_NAMES } from '@/shared/enums/roles';
import { authStore } from '@/stores/auth.store';
import { extractApiError } from '@/lib/api-errors';
import { api } from '@/lib/api';
import { soLieuHienThi } from '@/lib/soLieuHienThi';
import { LoadErrorBanner } from '@/components/shared/LoadErrorBanner';
import { WardFilterDropdown } from '@/components/WardFilterDropdown';
import { formatVNDate } from '../../lib/dates';
import { OTimKiemThe, DanhSachThe, useTheTimKiem, formatHoSoCode } from '@/components/shared/ListPageShell';
import { useFeatureBatMacDinh } from '@/lib/features/useFeature';
import { TIM_KIEM_VU_AN } from '@/shared/tim-kiem/generated';
import { laGiaTriNgay } from '@/shared/tim-kiem/the';

interface WardCaseRow {
  id: string;
  caseCode: string | null;
  name: string;
  crime?: string | null;
  crimeChinh?: { name: string } | null;
  subjects?: { id: string; fullName: string }[] | null;
  _count?: { subjects?: number } | null;
  ngayDeXuat?: string | null;
  status: CaseStatus;
  assignedTeam?: { ward?: { name?: string | null } | null } | null;
}

interface ThongKeVuAn {
  total: number;
  byGroup?: Partial<Record<'dang-dieu-tra' | 'da-ket-luan' | 'dinh-chi' | 'tam-dinh-chi', number>>;
}

const PAGE_SIZE = 20;
/** Số tên bị can hiện trên một dòng; phần dư hiện "+N" theo số máy chủ đếm. */
const SO_TEN_BI_CAN = 2;

/**
 * Cột của bảng — khoá `timKiem` là thẻ tìm được trên cột ấy (cổng `timKiemCotKhai` đọc đúng khai này).
 * Tội danh hiện TỘI DANH CHÍNH (danh mục, prod 344/368) và lùi ô chữ `crime` (36/368) nên mang cả hai khoá.
 */
const COT = [
  { tieuDe: 'STT', timKiem: 'stt' },
  { tieuDe: 'Tên vụ án', timKiem: 'tenVuAn' },
  { tieuDe: 'Tội danh', timKiem: ['toiDanhChinh', 'toiDanh'] },
  { tieuDe: 'Bị can', timKiem: 'doiTuongBiCan' },
  { tieuDe: 'Phường/Xã' },
  { tieuDe: 'Ngày đề xuất', timKiem: 'ngayDeXuat' },
  { tieuDe: 'Trạng thái', timKiem: 'trangThai' },
] as const;

/** Nhãn thẻ theo ĐÚNG tiêu đề cột của bảng này (khai chung mang nhãn của màn Vụ án chính). */
const NHAN_TREN_BANG: Record<string, string> = {
  stt: 'STT',
  tenVuAn: 'Tên vụ án',
  toiDanhChinh: 'Tội danh',
  toiDanh: 'Tội danh (ghi chữ)',
  doiTuongBiCan: 'Bị can',
  ngayDeXuat: 'Ngày đề xuất',
  trangThai: 'Trạng thái',
};
const KHAI_VU_AN_PHUONG = TIM_KIEM_VU_AN.filter((t) => t.key in NHAN_TREN_BANG).map((t) => ({
  ...t,
  nhan: NHAN_TREN_BANG[t.key],
}));

const GIA_TRI_CHON_VU_AN_PHUONG = {
  trangThai: (Object.keys(CASE_STATUS_LABEL) as CaseStatus[]).map((s) => ({
    value: s,
    label: CASE_STATUS_LABEL[s],
  })),
};

interface FilterData {
  quickSearch: string;
  fromDate: string;
  toDate: string;
  status: string;
}

const BO_LOC_TRONG: FilterData = { quickSearch: '', fromDate: '', toDate: '', status: '' };

export default function WardCasesPage() {
  const navigate = useNavigate();
  const nguoiDung = authStore.getUser();
  const laQuanTri = nguoiDung?.role === ROLE_NAMES.ADMIN || nguoiDung?.role === ROLE_NAMES.SYSTEM;

  const [rows, setRows] = useState<WardCaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [wardTeamId, setWardTeamId] = useState('');
  const [filters, setFilters] = useState<FilterData>(BO_LOC_TRONG);

  const theBat = useFeatureBatMacDinh('TIM_KIEM_THE');
  const timKiem = useTheTimKiem({
    prefix: 'wardCases',
    khai: KHAI_VU_AN_PHUONG,
    giaTriChon: GIA_TRI_CHON_VU_AN_PHUONG,
    bat: theBat,
  });
  // Khoá theo GIÁ TRỊ: `tkGui` đổi tham chiếu mỗi lần URL đổi.
  const tkKey = JSON.stringify(timKiem.tkGui);

  /** Tham số lọc chung của danh sách, thẻ KPI và tệp xuất (không gồm trạng thái, trang). */
  const thamSoLoc = useMemo(() => {
    const p = new URLSearchParams();
    if (theBat) {
      for (const v of JSON.parse(tkKey) as string[]) p.append('tk', v);
    } else if (filters.quickSearch.trim()) {
      p.set('search', filters.quickSearch.trim());
    }
    if (wardTeamId) p.set('wardTeamId', wardTeamId);
    // Chỉ gửi ngày HỢP LỆ: gõ năm từng chữ số, ô ngày bắn 0002-09-17… — gửi đi là 400 cả màn.
    if (filters.fromDate && laGiaTriNgay(filters.fromDate)) p.set('fromDate', filters.fromDate);
    if (filters.toDate && laGiaTriNgay(filters.toDate)) p.set('toDate', filters.toDate);
    return p.toString();
  }, [theBat, tkKey, filters.quickSearch, filters.fromDate, filters.toDate, wardTeamId]);

  // Trang gắn với KHOÁ bộ lọc: bộ lọc đổi thì về trang 1 ngay lúc vẽ (không effect), ghi đè khoá cũ.
  const khoaLoc = `${thamSoLoc}|${filters.status}`;
  const [trangTheoLoc, setTrangTheoLoc] = useState({ khoa: khoaLoc, page: 1 });
  if (trangTheoLoc.khoa !== khoaLoc) setTrangTheoLoc({ khoa: khoaLoc, page: 1 });
  const page = trangTheoLoc.khoa === khoaLoc ? trangTheoLoc.page : 1;
  const setPage = (doi: (p: number) => number) => setTrangTheoLoc({ khoa: khoaLoc, page: doi(page) });
  const [total, setTotal] = useState(0);
  const [thongKe, setThongKe] = useState<ThongKeVuAn | null>(null);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  /** Số lượt tải — kết quả về trễ của lượt cũ không đè lượt mới. */
  const luotTai = useRef(0);
  /** Tăng để tải lại cùng bộ lọc (Làm mới, sau khi xoá). */
  const [lanTai, setLanTai] = useState(0);

  const taiDuLieu = useCallback(async () => {
    const luot = ++luotTai.current;
    const danhSach = new URLSearchParams(thamSoLoc);
    if (filters.status) danhSach.set('status', filters.status);
    danhSach.set('limit', String(PAGE_SIZE));
    danhSach.set('offset', String((page - 1) * PAGE_SIZE));
    setLoading(true);
    setLoadError('');
    try {
      const [res, tk] = await Promise.all([
        api.get<{ data?: WardCaseRow[]; total?: number }>(`/cases?${danhSach}`),
        api.get<ThongKeVuAn>(`/cases/stats?${thamSoLoc}`),
      ]);
      if (luot !== luotTai.current) return;
      const tong = Number(res.data?.total ?? 0);
      const trangCuoi = Math.max(1, Math.ceil(tong / PAGE_SIZE));
      if (page > trangCuoi) {
        // Tổng giảm dưới trang đang xem (vd vừa xoá) → kẹp về trang cuối (lượt này không hạ cờ loading).
        luotTai.current++;
        setTrangTheoLoc({ khoa: khoaLoc, page: trangCuoi });
        return;
      }
      setRows(Array.isArray(res.data?.data) ? res.data.data : []);
      setTotal(tong);
      setThongKe(tk.data ?? null);
    } catch (e) {
      if (luot !== luotTai.current) return;
      // KHÔNG biến "không hỏi được máy chủ" thành "không có gì cả": mảng rỗng làm mọi thẻ
      // thống kê ra số 0, và số 0 đọc như một câu trả lời. Giữ lỗi lại để giao diện nói ra.
      setRows([]);
      setTotal(0);
      setThongKe(null);
      setLoadError(extractApiError(e, 'Không tải được dữ liệu. Vui lòng thử lại.').messages.join(', '));
    } finally {
      if (luot === luotTai.current) setLoading(false);
    }
  }, [thamSoLoc, filters.status, page, khoaLoc, lanTai]);

  useEffect(() => {
    void taiDuLieu();
  }, [taiDuLieu]);

  const handleResetFilters = () => {
    timKiem.xoaHet();
    setFilters(BO_LOC_TRONG);
    setWardTeamId('');
    setLanTai((n) => n + 1);
  };

  const xemHoSo = (id: string) => navigate(`/cases/${id}`);

  const handleDelete = async (row: WardCaseRow) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa vụ án ${formatHoSoCode(row.caseCode) || row.name}?`)) return;
    try {
      await api.delete(`/cases/${row.id}`);
      setLanTai((n) => n + 1);
    } catch (e) {
      alert(extractApiError(e, 'Xóa thất bại. Vui lòng thử lại.').messages.join(', '));
    }
  };

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      // CÙNG bộ lọc với bảng: tệp xuất là đúng những hồ sơ cán bộ đang nhìn thấy (mọi trang).
      const q = new URLSearchParams(thamSoLoc);
      if (filters.status) q.set('status', filters.status);
      const res = await api.get(`/cases/export/ward?${q}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `VuAnPhuongXa_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert('Xuất Excel thất bại. Vui lòng thử lại.');
    } finally {
      setIsExporting(false);
    }
  }, [thamSoLoc, filters.status]);

  // Thẻ KPI lấy nhóm trạng thái MÁY CHỦ đếm trên cùng bộ lọc. Chưa có số → undefined → dấu gạch.
  const nhom = (...k: (keyof NonNullable<ThongKeVuAn['byGroup']>)[]) =>
    thongKe ? k.reduce((n, key) => n + (thongKe.byGroup?.[key] ?? 0), 0) : undefined;

  const THE_KPI = [
    { testid: 'kpi-card-total', nhan: 'Tổng vụ án', so: thongKe?.total, mau: 'slate', Icon: Scale },
    { testid: 'kpi-card-dang-dieu-tra', nhan: 'Đang điều tra', so: nhom('dang-dieu-tra'), mau: 'blue', Icon: Search },
    { testid: 'kpi-card-da-ket-luan', nhan: 'Đã kết luận', so: nhom('da-ket-luan'), mau: 'green', Icon: CheckCircle },
    { testid: 'kpi-card-dinh-chi', nhan: 'Đình chỉ / Tạm đình chỉ', so: nhom('dinh-chi', 'tam-dinh-chi'), mau: 'amber', Icon: PauseCircle },
  ] as const;
  const MAU_THE: Record<string, { vien: string; chu: string; nen: string }> = {
    slate: { vien: 'border-slate-200', chu: 'text-[#003973]', nen: 'bg-[#003973]/10' },
    blue: { vien: 'border-blue-200', chu: 'text-blue-600', nen: 'bg-blue-100' },
    green: { vien: 'border-green-200', chu: 'text-green-600', nen: 'bg-green-100' },
    amber: { vien: 'border-amber-200', chu: 'text-amber-600', nen: 'bg-amber-100' },
  };

  const soCot = COT.length + 1;

  return (
    <div className="p-6 space-y-6" data-testid="ward-cases-page">
      <div>
        <h1 className="text-2xl font-bold text-[#003973]">Vụ án Phường/Xã</h1>
        <p className="text-slate-600 text-sm mt-1">
          Vụ án hình sự do các tổ phường/xã thụ lý — trong phạm vi dữ liệu được giao cho tài khoản của bạn.
        </p>
      </div>

      <LoadErrorBanner error={loadError} what="danh sách vụ án phường/xã" data-testid="ward-cases-load-error" />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {THE_KPI.map(({ testid, nhan, so, mau, Icon }) => (
          <div key={testid} data-testid={testid} className={`bg-white rounded-lg border-2 ${MAU_THE[mau].vien} shadow-sm p-5`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">{nhan}</p>
                <p className={`text-3xl font-bold ${MAU_THE[mau].chu}`}>{soLieuHienThi(so, !!loadError)}</p>
              </div>
              <div className={`w-12 h-12 ${MAU_THE[mau].nen} rounded-lg flex items-center justify-center`}>
                <Icon className={`w-6 h-6 ${MAU_THE[mau].chu}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-slate-600">
          {loading ? (
            <span>Đang tải...</span>
          ) : (
            <>
              Có <span data-testid="ward-cases-total" className="font-medium text-[#003973]">{total}</span> vụ án
            </>
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

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {theBat ? (
            <div className="md:col-span-2">
              <OTimKiemThe
                the={timKiem.the}
                truong={KHAI_VU_AN_PHUONG}
                khai={KHAI_VU_AN_PHUONG}
                giaTriChon={GIA_TRI_CHON_VU_AN_PHUONG}
                onThem={timKiem.them}
                onBoThe={timKiem.boThe}
                onBoGiaTri={timKiem.boGiaTri}
                placeholder="Tìm trong mọi cột — gõ rồi chọn cột (phím /)"
              />
            </div>
          ) : (
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                data-testid="quick-search-input"
                value={filters.quickSearch}
                onChange={(e) => setFilters({ ...filters, quickSearch: e.target.value })}
                placeholder="Tìm kiếm theo STT, Tên vụ án, Tội danh..."
                className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973] focus:border-transparent"
              />
            </div>
          )}
          <WardFilterDropdown value={wardTeamId} onChange={(v) => setWardTeamId(v ?? '')} />
        </div>

        {showAdvancedFilter && (
          <div className="pt-4 border-t border-slate-200" data-testid="advanced-filter-panel">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Ngày đề xuất từ</label>
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
                <label className="block text-sm font-medium text-slate-700 mb-2">Trạng thái</label>
                <select
                  data-testid="filter-status"
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973] bg-white"
                >
                  <option value="">Tất cả</option>
                  {GIA_TRI_CHON_VU_AN_PHUONG.trangThai.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="ward-cases-table">
            <thead className="bg-[#003973]/5 border-b-2 border-[#003973]/20">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-bold text-[#003973] uppercase tracking-wider w-24 sticky left-0 bg-[#eef2f7] z-10 border-r border-slate-200">
                  Thao tác
                </th>
                {COT.map((c) => (
                  <th key={c.tieuDe} className="px-4 py-3 text-left text-xs font-bold text-[#003973] uppercase tracking-wider">
                    {c.tieuDe}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={soCot} className="px-4 py-16 text-center" data-testid="ward-cases-loading">
                    <p className="text-slate-500">Đang tải dữ liệu...</p>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={soCot} className="px-4 py-16 text-center" data-testid="ward-cases-empty">
                    <Scale className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">
                      {loadError ? 'Chưa hỏi được máy chủ — xem thông báo phía trên' : 'Không tìm thấy vụ án nào'}
                    </p>
                    {!loadError && theBat && timKiem.the.length > 0 ? (
                      <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 text-sm text-slate-600">
                        <span>Không tìm thấy với:</span>
                        <DanhSachThe
                          the={timKiem.the}
                          khai={KHAI_VU_AN_PHUONG}
                          giaTriChon={GIA_TRI_CHON_VU_AN_PHUONG}
                          onBoThe={timKiem.boThe}
                        />
                      </div>
                    ) : (
                      !loadError && <p className="text-sm text-slate-400 mt-1">Thử điều chỉnh bộ lọc tìm kiếm</p>
                    )}
                  </td>
                </tr>
              ) : (
                rows.map((c) => {
                  const tenBiCan = c.subjects ?? [];
                  const du = (c._count?.subjects ?? tenBiCan.length) - Math.min(tenBiCan.length, SO_TEN_BI_CAN);
                  const toiDanh = c.crimeChinh?.name || c.crime || '';
                  const phuong = c.assignedTeam?.ward?.name ?? '';
                  return (
                    <tr
                      key={c.id}
                      data-testid={`ward-case-row-${c.id}`}
                      onClick={() => xemHoSo(c.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          xemHoSo(c.id);
                        }
                      }}
                      tabIndex={0}
                      className="cursor-pointer hover:bg-blue-50 transition-colors"
                    >
                      <td
                        className="px-3 py-3 whitespace-nowrap sticky left-0 z-10 bg-white border-r border-slate-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => xemHoSo(c.id)}
                            data-testid={`view-btn-${c.id}`}
                            className="p-1.5 text-[#003973] hover:bg-[#003973]/10 rounded transition-colors"
                            title="Xem chi tiết"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {laQuanTri && (
                            <button
                              type="button"
                              onClick={() => void handleDelete(c)}
                              data-testid={`delete-btn-${c.id}`}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Xóa"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm font-mono font-bold text-[#003973]">{formatHoSoCode(c.caseCode)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-slate-800 font-medium line-clamp-2 max-w-xs">{c.name}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-1.5">
                          <Scale className="w-3.5 h-3.5 text-red-600 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-slate-700 line-clamp-2 max-w-xs">{toiDanh || '—'}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-1.5">
                          <Users className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                          <div>
                            {tenBiCan.length === 0 ? (
                              <p className="text-sm text-slate-400">—</p>
                            ) : (
                              tenBiCan.slice(0, SO_TEN_BI_CAN).map((s) => (
                                <p key={s.id} className="text-sm text-slate-700">
                                  {s.fullName}
                                </p>
                              ))
                            )}
                            {du > 0 && <p className="text-xs text-slate-500">+{du} người khác</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3" data-testid={`ward-cell-${c.id}`}>
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-green-600" />
                          <span className="text-sm font-medium text-slate-800">{phuong || '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-sm text-slate-700">{formatVNDate(c.ngayDeXuat)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          data-testid={`status-badge-${c.status}-${c.id}`}
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${CASE_STATUS_BADGE[c.status] ?? BADGE_DEFAULT}`}
                        >
                          {CASE_STATUS_LABEL[c.status] ?? c.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {!loading && total > PAGE_SIZE && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200">
            <p className="text-sm text-slate-500">
              Trang {page} / {totalPages} — {total} vụ án
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="ward-cases-prev-page"
                aria-label="Trang trước"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 text-slate-500 hover:text-slate-700 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                data-testid="ward-cases-next-page"
                aria-label="Trang sau"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 text-slate-500 hover:text-slate-700 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
