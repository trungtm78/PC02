/**
 * WardIncidentsPage — Vụ việc phường/xã.
 *
 * 17/09/2026: tìm kiếm, lọc, phân trang và thẻ KPI chạy ở MÁY CHỦ. Trước đó màn tải 100/4.725 vụ việc rồi lọc
 * tại chỗ; STT là số dòng, Phường đọc `unitId` (prod 0%), Loại đọc `incidentType` (0%), Địa điểm hiện mô tả,
 * Mức độ gán cứng "Trung bình": đều đã bỏ, cột nay đọc đúng trường thật (đo prod cùng ngày, xem ca kiểm).
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
  Calendar,
  MapPin,
  Scale,
  User,
  FileText,
  Inbox,
  CheckCircle,
  PauseCircle,
} from 'lucide-react';
import { IncidentStatus } from '@/shared/enums/generated';
import { INCIDENT_STATUS_LABEL, INCIDENT_STATUS_BADGE, BADGE_DEFAULT } from '@/shared/enums/status-labels';
import { extractApiError } from '@/lib/api-errors';
import { api } from '@/lib/api';
import { soLieuHienThi } from '@/lib/soLieuHienThi';
import { LoadErrorBanner } from '@/components/shared/LoadErrorBanner';
import { WardFilterDropdown } from '@/components/WardFilterDropdown';
import { formatVNDate } from '../../lib/dates';
import { OTimKiemThe, DanhSachThe, useTheTimKiem, formatHoSoCode } from '@/components/shared/ListPageShell';
import { useFeatureBatMacDinh } from '@/lib/features/useFeature';
import { TIM_KIEM_VU_VIEC } from '@/shared/tim-kiem/generated';
import { laGiaTriNgay } from '@/shared/tim-kiem/the';
import { nhanKyApDung } from '@/constants/thongKeSettings';

interface WardIncidentRow {
  id: string;
  code: string | null;
  name: string;
  crimeChinh?: { name: string } | null;
  benVu?: string | null;
  ngayDeXuat?: string | null;
  status: IncidentStatus;
  assignedTeam?: { ward?: { name?: string | null } | null } | null;
}

type NhomGiaiDoan = 'tiep-nhan' | 'xac-minh' | 'ket-qua' | 'tam-dinh-chi';

interface ThongKeVuViec {
  total: number;
  byGroup?: Partial<Record<NhomGiaiDoan, number>>;
  /** Kỳ máy chủ ĐÃ áp cho cả danh sách lẫn thẻ số: ô ngày trống thì là kỳ mặc định admin đặt. */
  ky?: { ky: string; tuNgay: string | null; denNgay: string | null };
}

const PAGE_SIZE = 20;

/**
 * Cột của bảng — khoá `timKiem` là thẻ tìm được trên cột ấy (cổng `timKiemCotKhai` đọc đúng khai này).
 * Loại (0%), Địa điểm (địa chỉ xảy ra 6/1.165; bản cũ hiện mô tả) và Mức độ (gán cứng) đã gỡ.
 */
const COT = [
  { tieuDe: 'STT', timKiem: 'stt' },
  { tieuDe: 'Tên vụ việc', timKiem: 'tenVuViec' },
  { tieuDe: 'Tội danh', timKiem: 'toiDanhChinh' },
  { tieuDe: 'Người cung cấp, bị hại', timKiem: 'nguoiGui' },
  { tieuDe: 'Phường/Xã' },
  { tieuDe: 'Ngày đề xuất', timKiem: 'ngayDeXuat' },
  { tieuDe: 'Trạng thái', timKiem: 'trangThai' },
] as const;

/** Nhãn thẻ theo ĐÚNG tiêu đề cột của bảng này (khai chung mang nhãn của màn Vụ việc chính). */
const NHAN_TREN_BANG: Record<string, string> = {
  stt: 'STT',
  tenVuViec: 'Tên vụ việc',
  toiDanhChinh: 'Tội danh',
  nguoiGui: 'Người cung cấp, bị hại',
  ngayDeXuat: 'Ngày đề xuất',
  trangThai: 'Trạng thái',
};
const KHAI_VU_VIEC_PHUONG = TIM_KIEM_VU_VIEC.filter((t) => t.key in NHAN_TREN_BANG).map((t) => ({
  ...t,
  nhan: NHAN_TREN_BANG[t.key],
}));

const GIA_TRI_CHON_VU_VIEC_PHUONG = {
  trangThai: (Object.keys(INCIDENT_STATUS_LABEL) as IncidentStatus[]).map((s) => ({
    value: s,
    label: INCIDENT_STATUS_LABEL[s],
  })),
};

interface FilterData {
  quickSearch: string;
  fromDate: string;
  toDate: string;
  status: string;
}

const BO_LOC_TRONG: FilterData = { quickSearch: '', fromDate: '', toDate: '', status: '' };

export default function WardIncidentsPage() {
  const navigate = useNavigate();

  const [rows, setRows] = useState<WardIncidentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [wardTeamId, setWardTeamId] = useState('');
  const [filters, setFilters] = useState<FilterData>(BO_LOC_TRONG);

  const theBat = useFeatureBatMacDinh('TIM_KIEM_THE');
  const timKiem = useTheTimKiem({
    prefix: 'wardIncidents',
    khai: KHAI_VU_VIEC_PHUONG,
    giaTriChon: GIA_TRI_CHON_VU_VIEC_PHUONG,
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
    // Chưa chọn phường: chỉ hồ sơ của tổ CÓ gắn phường — không để lẫn hồ sơ của các Đội vào màn phường/xã.
    if (wardTeamId) p.set('wardTeamId', wardTeamId);
    else p.set('chiToPhuong', 'true');
    // Vụ việc nhận ngày đề xuất qua `fromDateRange`/`toDateRange`. Chỉ gửi ngày HỢP LỆ: gõ năm từng chữ
    // số, ô ngày bắn 0002-09-17… — gửi đi là 400 cả màn.
    if (filters.fromDate && laGiaTriNgay(filters.fromDate)) p.set('fromDateRange', filters.fromDate);
    if (filters.toDate && laGiaTriNgay(filters.toDate)) p.set('toDateRange', filters.toDate);
    return p.toString();
  }, [theBat, tkKey, filters.quickSearch, filters.fromDate, filters.toDate, wardTeamId]);

  // Trang gắn với KHOÁ bộ lọc: bộ lọc đổi thì về trang 1 ngay lúc vẽ (không effect), ghi đè khoá cũ.
  const khoaLoc = `${thamSoLoc}|${filters.status}`;
  const [trangTheoLoc, setTrangTheoLoc] = useState({ khoa: khoaLoc, page: 1 });
  if (trangTheoLoc.khoa !== khoaLoc) setTrangTheoLoc({ khoa: khoaLoc, page: 1 });
  const page = trangTheoLoc.khoa === khoaLoc ? trangTheoLoc.page : 1;
  const setPage = (doi: (p: number) => number) => setTrangTheoLoc({ khoa: khoaLoc, page: doi(page) });
  const [total, setTotal] = useState(0);
  const [thongKe, setThongKe] = useState<ThongKeVuViec | null>(null);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  /** Số lượt tải — kết quả về trễ của lượt cũ không đè lượt mới. */
  const luotTai = useRef(0);
  /** Tăng để tải lại cùng bộ lọc (Làm mới). */
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
        api.get<{ data?: WardIncidentRow[]; total?: number }>(`/incidents?${danhSach}`),
        api.get<ThongKeVuViec>(`/incidents/stats?${thamSoLoc}`),
      ]);
      if (luot !== luotTai.current) return;
      const tong = Number(res.data?.total ?? 0);
      const trangCuoi = Math.max(1, Math.ceil(tong / PAGE_SIZE));
      if (page > trangCuoi) {
        // Tổng giảm dưới trang đang xem → kẹp về trang cuối (lượt này không hạ cờ loading).
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

  const xemHoSo = (id: string) => navigate(`/incidents/${id}`);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      // CÙNG bộ lọc với bảng: tệp xuất là đúng những hồ sơ cán bộ đang nhìn thấy (mọi trang).
      const q = new URLSearchParams(thamSoLoc);
      if (filters.status) q.set('status', filters.status);
      const res = await api.get(`/incidents/export/ward?${q}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `VuViecPhuongXa_${new Date().toISOString().slice(0, 10)}.xlsx`;
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

  // Thẻ KPI lấy nhóm giai đoạn MÁY CHỦ đếm trên cùng bộ lọc. Chưa có số → undefined → dấu gạch.
  const nhom = (k: NhomGiaiDoan) => (thongKe ? (thongKe.byGroup?.[k] ?? 0) : undefined);

  const THE_KPI = [
    { testid: 'kpi-card-total', nhan: 'Tổng vụ việc', so: thongKe?.total, mau: 'slate', Icon: FileText },
    { testid: 'kpi-card-tiep-nhan', nhan: 'Tiếp nhận', so: nhom('tiep-nhan'), mau: 'amber', Icon: Inbox },
    { testid: 'kpi-card-xac-minh', nhan: 'Xác minh & giải quyết', so: nhom('xac-minh'), mau: 'blue', Icon: Search },
    { testid: 'kpi-card-ket-qua', nhan: 'Kết quả', so: nhom('ket-qua'), mau: 'green', Icon: CheckCircle },
    { testid: 'kpi-card-tam-dinh-chi', nhan: 'Tạm đình chỉ', so: nhom('tam-dinh-chi'), mau: 'slate', Icon: PauseCircle },
  ] as const;
  const MAU_THE: Record<string, { vien: string; chu: string; nen: string }> = {
    slate: { vien: 'border-slate-200', chu: 'text-[#003973]', nen: 'bg-[#003973]/10' },
    blue: { vien: 'border-blue-200', chu: 'text-blue-600', nen: 'bg-blue-100' },
    green: { vien: 'border-green-200', chu: 'text-green-600', nen: 'bg-green-100' },
    amber: { vien: 'border-amber-200', chu: 'text-amber-600', nen: 'bg-amber-100' },
  };

  const soCot = COT.length + 1;

  return (
    <div className="p-6 space-y-6" data-testid="ward-incidents-page">
      <div>
        <h1 className="text-2xl font-bold text-[#003973]">Vụ việc Phường/Xã</h1>
        <p className="text-slate-600 text-sm mt-1">
          Vụ việc do các tổ phường/xã thụ lý — trong phạm vi dữ liệu được giao cho tài khoản của bạn.
        </p>
      </div>

      <LoadErrorBanner error={loadError} what="danh sách vụ việc phường/xã" data-testid="ward-incidents-load-error" />

      {thongKe?.ky && (
        <p className="text-sm text-slate-500" data-testid="ward-incidents-ky">
          Thống kê:{' '}
          <span className="text-slate-700 font-medium">
            {nhanKyApDung(
              thongKe.ky,
              laGiaTriNgay(filters.fromDate) ? filters.fromDate : '',
              laGiaTriNgay(filters.toDate) ? filters.toDate : '',
            )}
          </span>{' '}
          — danh sách và thẻ số cùng tính trong kỳ này; chọn ngày ở Bộ lọc để đổi.
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
              Có <span data-testid="ward-incidents-total" className="font-medium text-[#003973]">{total}</span> vụ việc
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
                truong={KHAI_VU_VIEC_PHUONG}
                khai={KHAI_VU_VIEC_PHUONG}
                giaTriChon={GIA_TRI_CHON_VU_VIEC_PHUONG}
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
                placeholder="Tìm kiếm theo STT, Tên vụ việc, Tội danh..."
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
                  {GIA_TRI_CHON_VU_VIEC_PHUONG.trangThai.map((o) => (
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
          <table className="w-full" data-testid="ward-incidents-table">
            <thead className="bg-[#003973]/5 border-b-2 border-[#003973]/20">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-bold text-[#003973] uppercase tracking-wider w-20 sticky left-0 bg-[#eef2f7] z-10 border-r border-slate-200">
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
                  <td colSpan={soCot} className="px-4 py-16 text-center" data-testid="ward-incidents-loading">
                    <p className="text-slate-500">Đang tải dữ liệu...</p>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={soCot} className="px-4 py-16 text-center" data-testid="ward-incidents-empty">
                    <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">
                      {loadError ? 'Chưa hỏi được máy chủ — xem thông báo phía trên' : 'Không tìm thấy vụ việc nào'}
                    </p>
                    {!loadError && theBat && timKiem.the.length > 0 ? (
                      <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 text-sm text-slate-600">
                        <span>Không tìm thấy với:</span>
                        <DanhSachThe
                          the={timKiem.the}
                          khai={KHAI_VU_VIEC_PHUONG}
                          giaTriChon={GIA_TRI_CHON_VU_VIEC_PHUONG}
                          onBoThe={timKiem.boThe}
                        />
                      </div>
                    ) : (
                      !loadError && <p className="text-sm text-slate-400 mt-1">Thử điều chỉnh bộ lọc tìm kiếm</p>
                    )}
                  </td>
                </tr>
              ) : (
                rows.map((v) => {
                  const phuong = v.assignedTeam?.ward?.name ?? '';
                  return (
                    <tr
                      key={v.id}
                      data-testid={`ward-incident-row-${v.id}`}
                      onClick={() => xemHoSo(v.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          xemHoSo(v.id);
                        }
                      }}
                      tabIndex={0}
                      className="cursor-pointer hover:bg-blue-50 transition-colors"
                    >
                      <td
                        className="px-3 py-3 whitespace-nowrap sticky left-0 z-10 bg-white border-r border-slate-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => xemHoSo(v.id)}
                          data-testid={`view-btn-${v.id}`}
                          className="p-1.5 text-[#003973] hover:bg-[#003973]/10 rounded transition-colors"
                          title="Xem chi tiết"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm font-mono font-bold text-[#003973]">{formatHoSoCode(v.code)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-slate-800 font-medium line-clamp-2 max-w-xs">{v.name}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-1.5">
                          <Scale className="w-3.5 h-3.5 text-red-600 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-slate-700 line-clamp-2 max-w-xs">{v.crimeChinh?.name || '—'}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-slate-700 line-clamp-2 max-w-xs">{v.benVu || '—'}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3" data-testid={`ward-cell-${v.id}`}>
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-green-600" />
                          <span className="text-sm font-medium text-slate-800">{phuong || '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-sm text-slate-700">{formatVNDate(v.ngayDeXuat)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          data-testid={`status-badge-${v.status}-${v.id}`}
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${INCIDENT_STATUS_BADGE[v.status] ?? BADGE_DEFAULT}`}
                        >
                          {INCIDENT_STATUS_LABEL[v.status] ?? v.status}
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
              Trang {page} / {totalPages} — {total} vụ việc
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="ward-incidents-prev-page"
                aria-label="Trang trước"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 text-slate-500 hover:text-slate-700 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                data-testid="ward-incidents-next-page"
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
