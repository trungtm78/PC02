/**
 * TransferAndReturnPage — Chuyển đội và Trả hồ sơ.
 *
 * 18/09/2026: danh sách đọc dữ liệu THẬT ở máy chủ và hai nút làm THẬT. Trước đó màn tải 50 hồ sơ mỗi
 * loại rồi gộp/lọc/phân trang tại chỗ; "Mã hồ sơ" của Vụ án là id cắt 8 ký tự; "Đội hiện tại" đọc ô chữ
 * `unit`/`unitId` (prod rỗng); "Chuyển đội" ghi đè ô chữ `unit` và nhét lý do vào `metadata` (prod 0 bản
 * ghi có `metadata.transferReason` — chưa từng chạy được); "Trả hồ sơ" và "Xuất Excel" không gọi API nào.
 *
 * Nay: mỗi loại hồ sơ hỏi đúng endpoint của nó với CÙNG thẻ tìm `*` + ngày, gộp rồi cắt trang; Chuyển đội
 * gọi `PATCH /:id/assign` (đường phân công thật, có kiểm quyền và ghi nhật ký); Trả hồ sơ ghi trạng thái
 * "Đã chuyển đơn vị khác" — chỉ Vụ án và Vụ việc có trạng thái ấy, Đơn thư thì nút tắt kèm lý do.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Search,
  RotateCcw,
  Eye,
  ArrowRightLeft,
  CornerUpLeft,
  X,
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileText,
  Info,
} from 'lucide-react';
import { api } from '@/lib/api';
import { extractApiError } from '@/lib/api-errors';
import { LoadErrorBanner } from '@/components/shared/LoadErrorBanner';
import { soLieuHienThi } from '@/lib/soLieuHienThi';
import { formatVNDate } from '../../lib/dates';
import { OTimKiemThe, DanhSachThe, useTheTimKiem, formatHoSoCode } from '@/components/shared/ListPageShell';
import { useFeatureBatMacDinh } from '@/lib/features/useFeature';
import { TIM_KIEM_DON_THU } from '@/shared/tim-kiem/generated';
import { laGiaTriNgay } from '@/shared/tim-kiem/the';
import { TRUONG_NGAY_DE_XUAT } from '@/constants/thongKeSettings';
import { CaseStatus, IncidentStatus } from '@/shared/enums/generated';
import {
  CASE_STATUS_LABEL,
  INCIDENT_STATUS_LABEL,
  PETITION_STATUS_LABEL,
} from '@/shared/enums/status-labels';
import { hoTen } from '@/lib/hoTen';

type LoaiHoSo = 'Vụ án' | 'Vụ việc' | 'Đơn thư';

interface NguonHoSo {
  loai: LoaiHoSo;
  duong: '/cases' | '/incidents' | '/petitions';
  /** Tên tham số ngày của endpoint ấy (Vụ việc dùng `fromDateRange`). */
  tuNgay: string;
  denNgay: string;
  nhanTrangThai: Record<string, string>;
  /** Trạng thái "đã chuyển đơn vị khác" — Đơn thư KHÔNG có, nên không trả hồ sơ được. */
  trangThaiTra: string | null;
  /** Cột ghi đơn vị nhận khi trả (chỉ Vụ việc có). */
  cotDonViNhan?: string;
  mauNhan: string;
}

const NGUON: NguonHoSo[] = [
  {
    loai: 'Vụ án',
    duong: '/cases',
    tuNgay: 'fromDate',
    denNgay: 'toDate',
    nhanTrangThai: CASE_STATUS_LABEL,
    trangThaiTra: CaseStatus.DA_CHUYEN_DON_VI,
    mauNhan: 'bg-red-100 text-red-700',
  },
  {
    loai: 'Vụ việc',
    duong: '/incidents',
    tuNgay: 'fromDateRange',
    denNgay: 'toDateRange',
    nhanTrangThai: INCIDENT_STATUS_LABEL,
    trangThaiTra: IncidentStatus.DA_CHUYEN_DON_VI,
    cotDonViNhan: 'chuyenDenDonVi',
    mauNhan: 'bg-purple-100 text-purple-700',
  },
  {
    loai: 'Đơn thư',
    duong: '/petitions',
    tuNgay: 'fromDate',
    denNgay: 'toDate',
    nhanTrangThai: PETITION_STATUS_LABEL,
    // Đơn thư không có trạng thái "đã chuyển đơn vị khác" (chỉ có lưu đơn / chuyển vụ việc / vụ án).
    trangThaiTra: null,
    mauNhan: 'bg-blue-100 text-blue-700',
  },
];

interface DongHoSo {
  id: string;
  loai: LoaiHoSo;
  ma: string | null;
  ten: string;
  toId: string | null;
  toTen: string;
  nguoiPhuTrach: string;
  ngayDeXuat: string | null;
  trangThai: string;
  nhanTrangThai: string;
}

interface HoSoMayChu {
  id: string;
  caseCode?: string | null;
  code?: string | null;
  stt?: string | null;
  name?: string | null;
  summary?: string | null;
  detailContent?: string | null;
  status: string;
  ngayDeXuat?: string | null;
  assignedTeam?: { id?: string | null; name?: string | null } | null;
  investigator?: { firstName?: string | null; lastName?: string | null; username?: string } | null;
  assignedTo?: { firstName?: string | null; lastName?: string | null; username?: string } | null;
}

const PAGE_SIZE = 20;

/** Cột của bảng — `timKiem` chỉ có thẻ `*` vì ba loại hồ sơ có khai khác nhau (chỉ "mọi cột" là chung). */
const COT = ['Loại', 'Mã hồ sơ', 'Tên hồ sơ', 'Đội hiện tại', 'Người phụ trách', 'Ngày đề xuất', 'Trạng thái'] as const;

/**
 * Ô tìm chỉ nhận thẻ "tất cả các cột": bảng gộp ba loại hồ sơ, mỗi loại một khai riêng ở máy chủ, nên
 * thẻ theo cột của loại này sẽ là khoá lạ (400) với hai loại kia.
 */
const KHAI_CHUYEN_TRA = TIM_KIEM_DON_THU.filter(() => false);

interface FilterData {
  quickSearch: string;
  loai: string;
  fromDate: string;
  toDate: string;
}

const BO_LOC_TRONG: FilterData = { quickSearch: '', loai: '', fromDate: '', toDate: '' };

const mocThoiGian = (d: DongHoSo) => (d.ngayDeXuat ? new Date(d.ngayDeXuat).getTime() : -Infinity);

export default function TransferAndReturnPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [rows, setRows] = useState<DongHoSo[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [filters, setFilters] = useState<FilterData>(BO_LOC_TRONG);
  const [chon, setChon] = useState<string[]>([]);
  const [moChuyen, setMoChuyen] = useState(false);
  const [moTra, setMoTra] = useState(false);

  const theBat = useFeatureBatMacDinh('TIM_KIEM_THE');
  const timKiem = useTheTimKiem({ prefix: 'transferReturn', khai: KHAI_CHUYEN_TRA, bat: theBat });
  const tkKey = JSON.stringify(timKiem.tkGui);

  /** Tham số chung gửi cho CẢ BA nguồn (chỉ những khoá mọi endpoint đều nhận). */
  const thamSoLoc = useMemo(() => {
    const p = new URLSearchParams();
    if (theBat) {
      for (const v of JSON.parse(tkKey) as string[]) p.append('tk', v);
    } else if (filters.quickSearch.trim()) {
      p.set('search', filters.quickSearch.trim());
    }
    p.set('thongKeTruongNgay', TRUONG_NGAY_DE_XUAT);
    return p.toString();
  }, [theBat, tkKey, filters.quickSearch]);

  const khoaLoc = `${thamSoLoc}|${filters.loai}|${filters.fromDate}|${filters.toDate}`;
  const [trangTheoLoc, setTrangTheoLoc] = useState({ khoa: khoaLoc, page: 1 });
  if (trangTheoLoc.khoa !== khoaLoc) setTrangTheoLoc({ khoa: khoaLoc, page: 1 });
  const page = trangTheoLoc.khoa === khoaLoc ? trangTheoLoc.page : 1;
  const setPage = (doi: (p: number) => number) => setTrangTheoLoc({ khoa: khoaLoc, page: doi(page) });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const luotTai = useRef(0);
  const [lanTai, setLanTai] = useState(0);

  const taiDuLieu = useCallback(async () => {
    const luot = ++luotTai.current;
    const nguonCanHoi = NGUON.filter((n) => !filters.loai || n.loai === filters.loai);
    // Gộp ba nguồn rồi cắt trang: mỗi nguồn phải lấy TỚI HẾT trang đang xem, vì dòng của trang 2 có thể
    // nằm ở nguồn nào cũng được.
    const denHetTrang = page * PAGE_SIZE;
    setLoading(true);
    setLoadError('');
    try {
      const ketQua = await Promise.all(
        nguonCanHoi.map(async (n) => {
          const q = new URLSearchParams(thamSoLoc);
          q.set('limit', String(denHetTrang));
          q.set('offset', '0');
          if (filters.fromDate && laGiaTriNgay(filters.fromDate)) q.set(n.tuNgay, filters.fromDate);
          if (filters.toDate && laGiaTriNgay(filters.toDate)) q.set(n.denNgay, filters.toDate);
          const res = await api.get<{ data?: HoSoMayChu[]; total?: number }>(`${n.duong}?${q}`);
          const ds = Array.isArray(res.data?.data) ? res.data.data : [];
          return {
            tong: Number(res.data?.total ?? 0),
            dong: ds.map<DongHoSo>((r) => ({
              id: r.id,
              loai: n.loai,
              ma: r.caseCode ?? r.code ?? r.stt ?? null,
              ten: r.name ?? r.detailContent ?? r.summary ?? '',
              toId: r.assignedTeam?.id ?? null,
              toTen: r.assignedTeam?.name ?? '',
              nguoiPhuTrach: hoTen(r.investigator ?? r.assignedTo ?? undefined),
              ngayDeXuat: r.ngayDeXuat ?? null,
              trangThai: r.status,
              nhanTrangThai: n.nhanTrangThai[r.status] ?? r.status,
            })),
          };
        }),
      );
      if (luot !== luotTai.current) return;
      const gop = ketQua
        .flatMap((k) => k.dong)
        .sort((a, b) => mocThoiGian(b) - mocThoiGian(a) || a.id.localeCompare(b.id));
      const tong = ketQua.reduce((n, k) => n + k.tong, 0);
      const trangCuoi = Math.max(1, Math.ceil(tong / PAGE_SIZE));
      if (page > trangCuoi) {
        luotTai.current++;
        setTrangTheoLoc({ khoa: khoaLoc, page: trangCuoi });
        return;
      }
      setRows(gop.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE));
      setTotal(tong);
    } catch (e) {
      if (luot !== luotTai.current) return;
      // KHÔNG biến "không hỏi được máy chủ" thành "không có gì cả".
      setRows([]);
      setTotal(0);
      setLoadError(extractApiError(e, 'Không tải được dữ liệu. Vui lòng thử lại.').messages.join(', '));
    } finally {
      if (luot === luotTai.current) setLoading(false);
    }
  }, [thamSoLoc, filters.loai, filters.fromDate, filters.toDate, page, khoaLoc, lanTai]);

  useEffect(() => {
    void taiDuLieu();
  }, [taiDuLieu]);

  // Chọn chỉ gồm dòng ĐANG THẤY: giữ id của dòng đã rời bảng là thao tác lên hồ sơ cán bộ không nhìn thấy.
  const idsDangThay = rows.map((r) => r.id).join('|');
  useEffect(() => {
    const con = new Set(idsDangThay.split('|'));
    setChon((truoc) => {
      const giu = truoc.filter((id) => con.has(id));
      return giu.length === truoc.length ? truoc : giu;
    });
  }, [idsDangThay]);

  // Hồ sơ được chọn sẵn khi điều hướng từ màn khác.
  const [banner, setBanner] = useState<{ ma: string; tuMan: string } | null>(null);
  useEffect(() => {
    const state = location.state as {
      preselectedRecord?: { id: string; caseNumber?: string };
      sourceScreen?: string;
    } | null;
    if (!state?.preselectedRecord) return;
    const dong = rows.find((r) => r.id === state.preselectedRecord?.id);
    if (!dong) return;
    setChon([dong.id]);
    setBanner({
      ma: state.preselectedRecord.caseNumber ?? formatHoSoCode(dong.ma),
      tuMan: state.sourceScreen ?? '',
    });
    window.history.replaceState({}, document.title);
  }, [location, rows]);

  const daChon = rows.filter((r) => chon.includes(r.id));
  const loaiKhongTraDuoc = [...new Set(daChon.filter((r) => !nguonCua(r.loai).trangThaiTra).map((r) => r.loai))];
  const traDuoc = daChon.length > 0 && loaiKhongTraDuoc.length === 0;

  const handleReset = () => {
    timKiem.xoaHet();
    setFilters(BO_LOC_TRONG);
    setChon([]);
    setLanTai((n) => n + 1);
  };

  const xemHoSo = (r: DongHoSo) => {
    const duong = r.loai === 'Vụ án' ? 'cases' : r.loai === 'Vụ việc' ? 'incidents' : 'petitions';
    navigate(`/${duong}/${r.id}`);
  };

  return (
    <div className="p-6 space-y-6" data-testid="transfer-return-page">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Chuyển đội và Trả hồ sơ</h1>
        <p className="text-slate-600 text-sm mt-1">
          Chuyển hồ sơ sang tổ khác (ghi nhật ký phân công) hoặc trả hồ sơ về đơn vị khác
        </p>
      </div>

      <LoadErrorBanner error={loadError} what="danh sách chuyển đội / trả hồ sơ" data-testid="transfer-load-error" />

      {banner && (
        <div className="bg-blue-50 border-l-4 border-blue-600 rounded-lg p-4 shadow-sm" data-testid="context-banner">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-700 mt-0.5" />
            <p className="text-sm text-blue-900">
              Hồ sơ <span className="font-semibold">{banner.ma}</span> đã được chọn sẵn
              {banner.tuMan ? ` từ ${banner.tuMan}` : ''}.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div data-testid="chuyen-tra-tong" className="bg-white rounded-lg border-2 border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 mb-1">Tổng hồ sơ</p>
              <p className="text-3xl font-bold text-[#003973]">{soLieuHienThi(loading ? undefined : total, !!loadError)}</p>
            </div>
            <div className="w-12 h-12 bg-[#003973]/10 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-[#003973]" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            {theBat ? (
              <OTimKiemThe
                the={timKiem.the}
                truong={KHAI_CHUYEN_TRA}
                khai={KHAI_CHUYEN_TRA}
                onThem={timKiem.them}
                onBoThe={timKiem.boThe}
                onBoGiaTri={timKiem.boGiaTri}
                placeholder="Tìm trong mọi cột của cả ba loại hồ sơ"
              />
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  data-testid="quick-search-input"
                  value={filters.quickSearch}
                  onChange={(e) => setFilters({ ...filters, quickSearch: e.target.value })}
                  placeholder="Tìm theo mã hồ sơ, tên hồ sơ..."
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Loại hồ sơ</label>
            <select
              data-testid="loc-loai-ho-so"
              value={filters.loai}
              onChange={(e) => setFilters({ ...filters, loai: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">Tất cả</option>
              {NGUON.map((n) => (
                <option key={n.loai} value={n.loai}>
                  {n.loai}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={handleReset}
              data-testid="refresh-btn"
              className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <RotateCcw className="w-4 h-4" /> Làm mới
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Ngày đề xuất từ</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="date"
                data-testid="loc-tu-ngay"
                value={filters.fromDate}
                onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })}
                className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Đến ngày</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="date"
                data-testid="loc-den-ngay"
                value={filters.toDate}
                onChange={(e) => setFilters({ ...filters, toDate: e.target.value })}
                className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          {loading ? 'Đang tải...' : `Đã chọn ${daChon.length} hồ sơ`}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            data-testid="btn-chuyen-doi"
            disabled={daChon.length === 0}
            onClick={() => setMoChuyen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowRightLeft className="w-4 h-4" /> Chuyển đội
          </button>
          <div className="flex flex-col">
            <button
              type="button"
              data-testid="btn-tra-ho-so"
              disabled={!traDuoc}
              onClick={() => setMoTra(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CornerUpLeft className="w-4 h-4" /> Trả hồ sơ
            </button>
            {loaiKhongTraDuoc.length > 0 && (
              <span data-testid="btn-tra-ho-so-ly-do" className="text-xs text-amber-700 mt-1 max-w-xs">
                {loaiKhongTraDuoc.join(', ')} không có trạng thái "Đã chuyển đơn vị khác" nên không trả được.
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="chuyen-tra-table">
            <thead className="bg-slate-50 border-b-2 border-slate-200">
              <tr>
                <th className="px-3 py-3 w-10" />
                <th className="px-3 py-3 text-left text-xs font-bold text-slate-700 uppercase w-16">Xem</th>
                {COT.map((c) => (
                  <th key={c} className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={COT.length + 2} className="px-4 py-16 text-center" data-testid="chuyen-tra-loading">
                    <p className="text-slate-500">Đang tải dữ liệu...</p>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={COT.length + 2} className="px-4 py-16 text-center" data-testid="chuyen-tra-empty">
                    <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">
                      {loadError ? 'Chưa hỏi được máy chủ — xem thông báo phía trên' : 'Không tìm thấy hồ sơ nào'}
                    </p>
                    {!loadError && theBat && timKiem.the.length > 0 && (
                      <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 text-sm text-slate-600">
                        <span>Không tìm thấy với:</span>
                        <DanhSachThe the={timKiem.the} khai={KHAI_CHUYEN_TRA} onBoThe={timKiem.boThe} />
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} data-testid={`chuyen-tra-row-${r.id}`} data-record-id={r.id} className="hover:bg-slate-50">
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        data-testid={`chon-${r.id}`}
                        checked={chon.includes(r.id)}
                        onChange={(e) =>
                          setChon((truoc) =>
                            e.target.checked ? [...truoc, r.id] : truoc.filter((id) => id !== r.id),
                          )
                        }
                        className="w-4 h-4"
                        aria-label={`Chọn hồ sơ ${formatHoSoCode(r.ma)}`}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => xemHoSo(r)}
                        data-testid={`view-record-${r.id}`}
                        className="p-1.5 text-slate-600 hover:bg-slate-100 rounded transition-colors"
                        title="Xem chi tiết"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${nguonCua(r.loai).mauNhan}`}>
                        {r.loai}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-sm font-mono font-bold text-blue-600">{formatHoSoCode(r.ma)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-slate-800 line-clamp-2 max-w-md">{r.ten}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{r.toTen || '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{r.nguoiPhuTrach || '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">{formatVNDate(r.ngayDeXuat)}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                        {r.nhanTrangThai}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && total > PAGE_SIZE && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200">
            <p className="text-sm text-slate-500">
              Trang {page} / {totalPages} — {total} hồ sơ
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="chuyen-tra-prev-page"
                aria-label="Trang trước"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 text-slate-500 hover:text-slate-700 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                data-testid="chuyen-tra-next-page"
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

      {moChuyen && (
        <HopChuyenDoi
          hoSo={daChon}
          onClose={() => setMoChuyen(false)}
          onXong={() => {
            setMoChuyen(false);
            setChon([]);
            setLanTai((n) => n + 1);
          }}
        />
      )}
      {moTra && (
        <HopTraHoSo
          hoSo={daChon}
          onClose={() => setMoTra(false)}
          onXong={() => {
            setMoTra(false);
            setChon([]);
            setLanTai((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}

function nguonCua(loai: LoaiHoSo): NguonHoSo {
  return NGUON.find((n) => n.loai === loai) as NguonHoSo;
}

interface To {
  id: string;
  name: string;
}

/**
 * Chuyển đội = PHÂN CÔNG lại tổ: gọi `PATCH /{loại}/{id}/assign` — đường có kiểm quyền điều phối và ghi
 * nhật ký. Bản cũ gọi `PUT` ghi đè ô chữ đơn vị và nhét lý do vào `metadata`; prod không có bản ghi nào
 * mang `metadata.transferReason`, tức nó chưa từng chạy được.
 */
function HopChuyenDoi({
  hoSo,
  onClose,
  onXong,
}: {
  hoSo: DongHoSo[];
  onClose: () => void;
  onXong: () => void;
}) {
  const [toId, setToId] = useState('');
  const [dsTo, setDsTo] = useState<To[]>([]);
  const [dangGui, setDangGui] = useState(false);
  const [ketQua, setKetQua] = useState<{ xong: string[]; hong: string[] } | null>(null);

  useEffect(() => {
    api
      .get<{ data: To[] }>('/teams')
      .then((r) => setDsTo(r.data.data ?? []))
      .catch(() => setDsTo([]));
  }, []);

  const guiDi = async () => {
    if (!toId) return;
    setDangGui(true);
    const xong: string[] = [];
    const hong: string[] = [];
    for (const r of hoSo) {
      const duong = nguonCua(r.loai).duong;
      try {
        await api.patch(`${duong}/${r.id}/assign`, { assignedTeamId: toId });
        xong.push(formatHoSoCode(r.ma) || r.id);
      } catch (e) {
        hong.push(
          `${formatHoSoCode(r.ma) || r.id}: ${extractApiError(e, 'Không chuyển được').messages.join(', ')}`,
        );
      }
    }
    setDangGui(false);
    setKetQua({ xong, hong });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" data-testid="transfer-modal">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="font-bold text-slate-800">Chuyển đội ({hoSo.length} hồ sơ)</h2>
          <button type="button" onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {ketQua ? (
            <div data-testid="ket-qua-chuyen" className="space-y-2 text-sm">
              {ketQua.xong.length > 0 && (
                <p className="text-green-700">Đã chuyển: {ketQua.xong.join(', ')}</p>
              )}
              {ketQua.hong.length > 0 && (
                <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-red-700">
                  <strong className="font-medium">Chưa chuyển được: </strong>
                  {ketQua.hong.join(' · ')}
                </div>
              )}
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Tổ nhận <span className="text-red-500">*</span>
                </label>
                <select
                  data-testid="chon-to-nhan"
                  value={toId}
                  onChange={(e) => setToId(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Chọn tổ --</option>
                  {dsTo.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-slate-500">
                Việc phân công được ghi nhật ký; hồ sơ ngoài quyền điều phối của bạn sẽ bị máy chủ từ chối và
                báo rõ ở đây.
              </p>
            </>
          )}
        </div>
        <div className="border-t border-slate-200 px-6 py-4 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={ketQua ? onXong : onClose}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
          >
            {ketQua ? 'Đóng' : 'Hủy bỏ'}
          </button>
          {!ketQua && (
            <button
              type="button"
              data-testid="btn-xac-nhan-chuyen"
              disabled={!toId || dangGui}
              onClick={() => void guiDi()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
            >
              {dangGui ? 'Đang chuyển...' : 'Xác nhận chuyển'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Trả hồ sơ = ghi trạng thái "Đã chuyển đơn vị khác". Vụ việc có cột `chuyenDenDonVi` để ghi đơn vị nhận;
 * Vụ án chỉ có trạng thái. Đơn thư không có trạng thái ấy nên nút gọi hộp này đã bị tắt từ ngoài.
 */
function HopTraHoSo({
  hoSo,
  onClose,
  onXong,
}: {
  hoSo: DongHoSo[];
  onClose: () => void;
  onXong: () => void;
}) {
  const [donViNhan, setDonViNhan] = useState('');
  const [dangGui, setDangGui] = useState(false);
  const [ketQua, setKetQua] = useState<{ xong: string[]; hong: string[] } | null>(null);

  const guiDi = async () => {
    setDangGui(true);
    const xong: string[] = [];
    const hong: string[] = [];
    for (const r of hoSo) {
      const n = nguonCua(r.loai);
      if (!n.trangThaiTra) continue;
      try {
        await api.put(`${n.duong}/${r.id}`, {
          status: n.trangThaiTra,
          ...(n.cotDonViNhan && donViNhan.trim()
            ? { [n.cotDonViNhan]: donViNhan.trim() }
            : {}),
        });
        xong.push(formatHoSoCode(r.ma) || r.id);
      } catch (e) {
        hong.push(
          `${formatHoSoCode(r.ma) || r.id}: ${extractApiError(e, 'Không trả được').messages.join(', ')}`,
        );
      }
    }
    setDangGui(false);
    setKetQua({ xong, hong });
  };

  const coCotDonVi = hoSo.some((r) => nguonCua(r.loai).cotDonViNhan);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" data-testid="return-modal">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="font-bold text-slate-800">Trả hồ sơ ({hoSo.length} hồ sơ)</h2>
          <button type="button" onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {ketQua ? (
            <div data-testid="ket-qua-tra" className="space-y-2 text-sm">
              {ketQua.xong.length > 0 && <p className="text-green-700">Đã trả: {ketQua.xong.join(', ')}</p>}
              {ketQua.hong.length > 0 && (
                <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-red-700">
                  <strong className="font-medium">Chưa trả được: </strong>
                  {ketQua.hong.join(' · ')}
                </div>
              )}
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-700">
                Hồ sơ sẽ chuyển sang trạng thái <strong>Đã chuyển đơn vị khác</strong>.
              </p>
              {coCotDonVi && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Đơn vị nhận</label>
                  <input
                    type="text"
                    data-testid="tra-don-vi-nhan"
                    value={donViNhan}
                    onChange={(e) => setDonViNhan(e.target.value)}
                    placeholder="Ví dụ: Công an Quận 1"
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">Chỉ Vụ việc lưu được đơn vị nhận (cột dành riêng).</p>
                </div>
              )}
            </>
          )}
        </div>
        <div className="border-t border-slate-200 px-6 py-4 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={ketQua ? onXong : onClose}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
          >
            {ketQua ? 'Đóng' : 'Hủy bỏ'}
          </button>
          {!ketQua && (
            <button
              type="button"
              data-testid="btn-xac-nhan-tra"
              disabled={dangGui}
              onClick={() => void guiDi()}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium disabled:opacity-50"
            >
              {dangGui ? 'Đang trả...' : 'Xác nhận trả'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
