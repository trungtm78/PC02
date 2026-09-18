/**
 * WardPetitionsPage — Đơn thư theo phường/xã
 *
 * Mirror cấu trúc WardCasesPage / WardIncidentsPage: 4 KPI cards, advanced
 * filter panel, sticky action column, status badge có màu (cột Mức độ bỏ 17/09/2026 — prod 0% dữ liệu), export
 * Excel button. Backend hỗ trợ wardTeamId (v0.36.0.0) + /petitions/export/ward
 * (sync với 3 màn hình ward đồng bộ).
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
  Eye,
  Calendar,
  ChevronLeft,
  ChevronRight,
  MapPin,
  FileText,
  Clock,
  CheckCircle,
  User,
} from 'lucide-react';
import { api } from '@/lib/api';
import { extractApiError } from '@/lib/api-errors';
import { LoadErrorBanner } from '@/components/shared/LoadErrorBanner';
import { soLieuHienThi } from '@/lib/soLieuHienThi';
import { formatVNDate } from '../../lib/dates';
import { PetitionStatus, LoaiDon } from '@/shared/enums/generated';
import {
  PETITION_STATUS_LABEL,
  PETITION_STATUS_BADGE,
  LOAI_DON_OPTIONS,
  LOAI_DON_LABEL,
  BADGE_DEFAULT,
} from '@/shared/enums/status-labels';
import { WardFilterDropdown } from '@/components/WardFilterDropdown';
import {
  OTimKiemThe,
  DanhSachThe,
  useTheTimKiem,
  SummaryCell,
  ThanhCuonNgangTren,
} from '@/components/shared/ListPageShell';
import { useFeatureBatMacDinh } from '@/lib/features/useFeature';
import { TIM_KIEM_DON_THU } from '@/shared/tim-kiem/generated';
import { laGiaTriNgay } from '@/shared/tim-kiem/the';
import { nhanKyApDung, TRUONG_NGAY_DE_XUAT } from '@/constants/thongKeSettings';

interface PetitionRow {
  id: string;
  stt: string;
  senderName: string;
  petitionType?: LoaiDon | null;
  /** Cột ngày của danh sách — bộ lọc ngày máy chủ lọc đúng cột này (lệch Ngày nhận ở 29.026 đơn). */
  ngayDeXuat?: string | null;
  status: PetitionStatus;
  /** Tóm tắt nội dung — cùng cột thẻ `tomTat` tìm (`summary` chỉ khác ở 74/47.352 đơn). */
  detailContent?: string | null;
  assignedTeam?: { ward?: { name?: string | null } | null } | null;
}

interface ThongKeDonThu {
  total: number;
  byStatus: Partial<Record<PetitionStatus, number>>;
  /** Kỳ máy chủ ĐÃ áp cho cả danh sách lẫn thẻ số: ô ngày trống thì là kỳ mặc định admin đặt. */
  ky?: { ky: string; tuNgay: string | null; denNgay: string | null };
}

const PAGE_SIZE = 20;

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

/**
 * Khoá tìm được trên màn này — TẬP CON khai Đơn thư của máy chủ, chỉ các khoá có cột trên bảng. Loại đơn
 * và Phường/Xã lọc bằng ô chọn riêng (tham số `petitionType`, `wardTeamId`); Mức độ bỏ vì prod 0% dữ liệu.
 */
/** Khoá → nhãn đúng tiêu đề cột của BẢNG NÀY (khai chung dùng nhãn cột của màn Đơn thư chính). */
const NHAN_TREN_BANG: Record<string, string> = {
  stt: 'STT',
  nguoiGui: 'Người gửi',
  tomTat: 'Tóm tắt',
  ngayDeXuat: 'Ngày đề xuất',
  trangThai: 'Trạng thái',
};
const KHAI_DON_THU_PHUONG = TIM_KIEM_DON_THU.filter((t) => t.key in NHAN_TREN_BANG).map((t) => ({
  ...t,
  nhan: NHAN_TREN_BANG[t.key],
}));

const GIA_TRI_CHON_DON_THU_PHUONG = {
  trangThai: (Object.keys(PETITION_STATUS_LABEL) as PetitionStatus[]).map((s) => ({
    value: s,
    label: PETITION_STATUS_LABEL[s],
  })),
};

export default function WardPetitionsPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<PetitionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
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

  // ── Tìm kiếm, lọc, phân trang, thẻ KPI: ĐỀU ở máy chủ ──────────────────────
  // Trước 17/09/2026 màn tải `limit=100` trên 47.352 đơn rồi lọc tại chỗ: tìm kiếm và thẻ KPI chỉ tính
  // trong 100 đơn mới nhất.
  const theBat = useFeatureBatMacDinh('TIM_KIEM_THE');
  const timKiem = useTheTimKiem({
    prefix: 'wardPetitions',
    khai: KHAI_DON_THU_PHUONG,
    giaTriChon: GIA_TRI_CHON_DON_THU_PHUONG,
    bat: theBat,
  });
  // Khoá theo GIÁ TRỊ: `tkGui` đổi tham chiếu mỗi lần URL đổi.
  const tkKey = JSON.stringify(timKiem.tkGui);

  /** Tham số lọc chung của danh sách và thẻ KPI (không gồm trạng thái, trang). */
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
    if (filters.petitionType) p.set('petitionType', filters.petitionType);
    // Chỉ gửi ngày HỢP LỆ: gõ năm từng chữ số, ô ngày bắn 0002-09-17… — gửi đi là 400 cả màn.
    if (filters.fromDate && laGiaTriNgay(filters.fromDate)) p.set('fromDate', filters.fromDate);
    if (filters.toDate && laGiaTriNgay(filters.toDate)) p.set('toDate', filters.toDate);
    p.set('thongKeTruongNgay', TRUONG_NGAY_DE_XUAT);
    return p.toString();
  }, [theBat, tkKey, filters.quickSearch, filters.petitionType, filters.fromDate, filters.toDate, wardTeamId]);

  // Trang gắn với KHOÁ bộ lọc: bộ lọc đổi thì về trang 1 ngay lúc vẽ (không effect), ghi đè khoá cũ.
  const khoaLoc = `${thamSoLoc}|${filters.status}`;
  const [trangTheoLoc, setTrangTheoLoc] = useState({ khoa: khoaLoc, page: 1 });
  if (trangTheoLoc.khoa !== khoaLoc) setTrangTheoLoc({ khoa: khoaLoc, page: 1 });
  const page = trangTheoLoc.khoa === khoaLoc ? trangTheoLoc.page : 1;
  const setPage = (doi: (p: number) => number) => setTrangTheoLoc({ khoa: khoaLoc, page: doi(page) });
  const [total, setTotal] = useState(0);
  const [thongKe, setThongKe] = useState<ThongKeDonThu | null>(null);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  /** Số lượt tải — kết quả về trễ của lượt cũ không đè lượt mới. */
  const luotTai = useRef(0);
  /** Khung cuộn ngang của bảng — thanh cuộn trên bám theo nó. */
  const khungBangRef = useRef<HTMLDivElement>(null);
  /** Tăng để tải lại cùng bộ lọc (nút Làm mới). */
  const [lanTai, setLanTai] = useState(0);

  const taiDuLieu = useCallback(async () => {
    const luot = ++luotTai.current;
    const danhSach = new URLSearchParams(thamSoLoc);
    if (filters.status) danhSach.set('status', filters.status);
    danhSach.set('limit', String(PAGE_SIZE));
    danhSach.set('offset', String((page - 1) * PAGE_SIZE));
    setLoading(true);
    setLoadError("");
    try {
      const [res, tk] = await Promise.all([
        api.get<{ data?: PetitionRow[]; total?: number }>(`/petitions?${danhSach}`),
        api.get<ThongKeDonThu>(`/petitions/stats?${thamSoLoc}`),
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
      setLoadError(extractApiError(e, "Không tải được dữ liệu. Vui lòng thử lại.").messages.join(", "));
    } finally {
      if (luot === luotTai.current) setLoading(false);
    }
  }, [thamSoLoc, filters.status, page, khoaLoc, lanTai]);

  useEffect(() => { void taiDuLieu(); }, [taiDuLieu]);

  const handleResetFilters = () => {
    timKiem.xoaHet();
    setFilters({
      quickSearch: '',
      fromDate: '',
      toDate: '',
      petitionType: '',
      status: '',
    });
    setLanTai((n) => n + 1);
  };

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      // CÙNG bộ lọc với bảng: tệp xuất là đúng những đơn cán bộ đang nhìn thấy (mọi trang).
      const q = new URLSearchParams(thamSoLoc);
      if (filters.status) q.set('status', filters.status);
      const res = await api.get(`/petitions/export/ward?${q}`, { responseType: 'blob' });
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
  }, [thamSoLoc, filters.status]);

  // Thẻ KPI lấy số từ MÁY CHỦ trên cùng thẻ/phường/loại/ngày. Chưa có số → undefined → dấu gạch.
  const dem = (ds: PetitionStatus[]) =>
    thongKe ? ds.reduce((n, st) => n + (thongKe.byStatus[st] ?? 0), 0) : undefined;
  const totalCount = thongKe?.total;
  const pendingCount = dem([PetitionStatus.MOI_TIEP_NHAN]);
  const processingCount = dem(PROCESSING_STATUSES);
  const resolvedCount = dem(RESOLVED_STATUSES);

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

  return (
    <div className="p-6 space-y-6" data-testid="ward-petitions-page">
      <div>
        <h1 className="text-2xl font-bold text-[#003973]">Đơn thư theo phường/xã</h1>
        <p className="text-slate-600 text-sm mt-1">
          Danh sách đơn thư (Tố cáo, Khiếu nại, Kiến nghị, Phản ánh) theo địa bàn quản lý của tổ phường/xã.
        </p>
      </div>

      {/* KPI cards */}
      <LoadErrorBanner error={loadError} what="danh sách đơn thư phường/xã" data-testid="ward-petitions-load-error" />

      {thongKe?.ky && (
        <p className="text-sm text-slate-500" data-testid="ward-petitions-ky">
          Thống kê:{' '}
          <span className="text-slate-700 font-medium">
            {nhanKyApDung(
              thongKe.ky,
              laGiaTriNgay(filters.fromDate) ? filters.fromDate : '',
              laGiaTriNgay(filters.toDate) ? filters.toDate : '',
            )}
          </span>
          {' '}— danh sách và thẻ số cùng tính trong kỳ này; chọn ngày ở Bộ lọc để đổi.
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div data-testid="kpi-card-total" className="bg-white rounded-lg border-2 border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 mb-1">Tổng đơn thư</p>
              <p className="text-3xl font-bold text-[#003973]">{soLieuHienThi(totalCount, !!loadError)}</p>
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
              <p className="text-3xl font-bold text-amber-600">{soLieuHienThi(pendingCount, !!loadError)}</p>
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
              <p className="text-3xl font-bold text-blue-600">{soLieuHienThi(processingCount, !!loadError)}</p>
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
              <p className="text-3xl font-bold text-green-600">{soLieuHienThi(resolvedCount, !!loadError)}</p>
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
            <>Có <span data-testid="ward-petitions-total" className="font-medium text-[#003973]">{total}</span> đơn thư</>
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
          {theBat ? (
            <div className="md:col-span-2">
              <OTimKiemThe
                the={timKiem.the}
                truong={KHAI_DON_THU_PHUONG}
                khai={KHAI_DON_THU_PHUONG}
                giaTriChon={GIA_TRI_CHON_DON_THU_PHUONG}
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
                placeholder="Tìm kiếm theo STT, Người gửi, Tóm tắt..."
                className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973] focus:border-transparent"
              />
            </div>
          )}
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
      {/* `overflow-clip` chứ không `overflow-hidden`: hidden tạo khung cuộn riêng, thanh cuộn trên (`sticky`)
          bám vào khung này thay vì trang và trôi mất khi cuộn xuống — cùng lý do với TABLE_SECTION_CARD. */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-clip">
        {/* Anh yêu cầu 18/09/2026: thanh cuộn ngang ở TRÊN bảng, dùng chung với 3 màn danh sách. */}
        <ThanhCuonNgangTren khung={khungBangRef} />
        <div ref={khungBangRef} className="overflow-x-auto">
          <table className="w-full" data-testid="ward-petitions-table">
            <thead className="bg-[#003973]/5 border-b-2 border-[#003973]/20">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-bold text-[#003973] uppercase tracking-wider w-20 sticky left-0 bg-[#eef2f7] z-10 border-r border-slate-200">
                  Thao tác
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-[#003973] uppercase tracking-wider">STT</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-[#003973] uppercase tracking-wider">Người gửi</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-[#003973] uppercase tracking-wider">Loại đơn</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-[#003973] uppercase tracking-wider min-w-[20rem]">Tóm tắt</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-[#003973] uppercase tracking-wider">Phường/Xã</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-[#003973] uppercase tracking-wider">Ngày đề xuất</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-[#003973] uppercase tracking-wider">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center" data-testid="ward-petitions-loading">
                    <p className="text-slate-500">Đang tải dữ liệu...</p>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center" data-testid="ward-petitions-empty">
                    <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">{loadError ? 'Chưa hỏi được máy chủ — xem thông báo phía trên' : 'Không tìm thấy đơn thư nào'}</p>
                    {!loadError && theBat && timKiem.the.length > 0 ? (
                      <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 text-sm text-slate-600">
                        <span>Không tìm thấy với:</span>
                        <DanhSachThe
                          the={timKiem.the}
                          khai={KHAI_DON_THU_PHUONG}
                          giaTriChon={GIA_TRI_CHON_DON_THU_PHUONG}
                          onBoThe={timKiem.boThe}
                        />
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 mt-1">Thử điều chỉnh bộ lọc tìm kiếm</p>
                    )}
                  </td>
                </tr>
              ) : (
                rows.map((p) => {
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
                      <td className="px-4 py-3 align-top text-sm">
                        {/* 5 dòng + "Xem thêm" bung tại chỗ — nút chặn lan lên dòng (dòng mở hồ sơ). */}
                        <SummaryCell value={p.detailContent} />
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
                            {formatVNDate(p.ngayDeXuat)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">{getStatusBadge(p)}</td>
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
              Trang {page} / {totalPages} — {total} đơn thư
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="ward-petitions-prev-page"
                aria-label="Trang trước"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 text-slate-500 hover:text-slate-700 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                data-testid="ward-petitions-next-page"
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
