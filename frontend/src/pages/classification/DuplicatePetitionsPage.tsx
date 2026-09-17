/**
 * DuplicatePetitionsPage — Đơn trùng.
 *
 * 18/09/2026: nguồn dữ liệu THẬT từ `/petitions/duplicates`. Trước đó màn tải `limit=100` đơn bất kỳ rồi
 * hiện chúng như đơn trùng — cột "Tiêu chí trùng" và "Hồ sơ gốc gợi ý" luôn rỗng, "độ tương đồng %" và các
 * nút hợp nhất / tách / so sánh không có API nào phía sau (đã gỡ).
 *
 * Máy chủ gom theo cột chuẩn hoá GIỮ DẤU THANH (migration `don_trung_chuan_hoa`), loại nhóm "nặc danh",
 * phân trang theo NHÓM. Đo prod 17/09 trên 47.352 đơn: 7.571 nhóm / 29.788 đơn theo họ tên.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Download,
  RotateCcw,
  Eye,
  Calendar,
  Copy,
  FileText,
  ChevronLeft,
  ChevronRight,
  Link2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { extractApiError } from '@/lib/api-errors';
import { soLieuHienThi } from '@/lib/soLieuHienThi';
import { LoadErrorBanner } from '@/components/shared/LoadErrorBanner';
import { formatVNDate } from '../../lib/dates';
import { OTimKiemThe, DanhSachThe, useTheTimKiem, formatHoSoCode } from '@/components/shared/ListPageShell';
import { useFeatureBatMacDinh } from '@/lib/features/useFeature';
import { TIM_KIEM_DON_THU } from '@/shared/tim-kiem/generated';
import { laGiaTriNgay } from '@/shared/tim-kiem/the';
import { nhanKyApDung, TRUONG_NGAY_DE_XUAT } from '@/constants/thongKeSettings';
import { PetitionStatus } from '@/shared/enums/generated';
import { PETITION_STATUS_LABEL, PETITION_STATUS_BADGE, BADGE_DEFAULT } from '@/shared/enums/status-labels';

interface DonTrong {
  id: string;
  stt: string | null;
  senderName: string | null;
  detailContent?: string | null;
  ngayDeXuat?: string | null;
  status: PetitionStatus;
}

interface NhomTrung {
  giaTri: string;
  soDon: number;
  goc: DonTrong | null;
  dons: DonTrong[];
}

interface KetQuaTrung {
  data: NhomTrung[];
  total: number;
  criteria: string;
  ky?: { ky: string; tuNgay: string | null; denNgay: string | null };
}

const PAGE_SIZE = 20;

/**
 * Tiêu chí gom — khớp từng dòng với `backend/src/petitions/don-trung.types.ts`. Mã lạ máy chủ trả 400,
 * nên ô chọn chỉ nhận đúng bốn mã này.
 */
const TIEU_CHI = [
  { value: 'senderName', label: 'Họ tên người gửi' },
  { value: 'senderPhone', label: 'Số điện thoại' },
  { value: 'senderAddress', label: 'Địa chỉ' },
  { value: 'suspectedPerson', label: 'Đối tượng bị tố giác' },
] as const;

/** Cột của bảng — khoá `timKiem` là thẻ tìm được trên cột ấy (khai Đơn thư của máy chủ). */
const COT = [
  { tieuDe: 'Mã đơn', timKiem: 'stt' },
  { tieuDe: 'Người gửi', timKiem: 'nguoiGui' },
  { tieuDe: 'Tóm tắt', timKiem: 'tomTat' },
  { tieuDe: 'Ngày đề xuất', timKiem: 'ngayDeXuat' },
  { tieuDe: 'Trạng thái', timKiem: 'trangThai' },
] as const;

const NHAN_TREN_BANG: Record<string, string> = {
  stt: 'Mã đơn',
  nguoiGui: 'Người gửi',
  tomTat: 'Tóm tắt',
  ngayDeXuat: 'Ngày đề xuất',
  trangThai: 'Trạng thái',
};
const KHAI_DON_TRUNG = TIM_KIEM_DON_THU.filter((t) => t.key in NHAN_TREN_BANG).map((t) => ({
  ...t,
  nhan: NHAN_TREN_BANG[t.key],
}));

const GIA_TRI_CHON_DON_TRUNG = {
  trangThai: (Object.keys(PETITION_STATUS_LABEL) as PetitionStatus[]).map((s) => ({
    value: s,
    label: PETITION_STATUS_LABEL[s],
  })),
};

/** Khoá testid ổn định cho một nhóm: bỏ dấu + gạch nối (giá trị gom là chữ tự do). */
const khoaNhom = (giaTri: string) =>
  giaTri
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

interface FilterData {
  quickSearch: string;
  criteria: string;
  status: string;
  fromDate: string;
  toDate: string;
}

const BO_LOC_TRONG: FilterData = {
  quickSearch: '',
  criteria: 'senderName',
  status: '',
  fromDate: '',
  toDate: '',
};

export default function DuplicatePetitionsPage() {
  const navigate = useNavigate();
  const [nhom, setNhom] = useState<NhomTrung[]>([]);
  const [total, setTotal] = useState(0);
  const [ky, setKy] = useState<KetQuaTrung['ky']>(undefined);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [filters, setFilters] = useState<FilterData>(BO_LOC_TRONG);

  const theBat = useFeatureBatMacDinh('TIM_KIEM_THE');
  const timKiem = useTheTimKiem({
    prefix: 'duplicatePetitions',
    khai: KHAI_DON_TRUNG,
    giaTriChon: GIA_TRI_CHON_DON_TRUNG,
    bat: theBat,
  });
  // Khoá theo GIÁ TRỊ: `tkGui` đổi tham chiếu mỗi lần URL đổi.
  const tkKey = JSON.stringify(timKiem.tkGui);

  /** Tham số chung của danh sách và tệp xuất (không gồm trang). */
  const thamSoLoc = useMemo(() => {
    const p = new URLSearchParams();
    if (theBat) {
      for (const v of JSON.parse(tkKey) as string[]) p.append('tk', v);
    } else if (filters.quickSearch.trim()) {
      p.set('search', filters.quickSearch.trim());
    }
    p.set('criteria', filters.criteria);
    if (filters.status) p.set('status', filters.status);
    // Chỉ gửi ngày HỢP LỆ: gõ năm từng chữ số, ô ngày bắn 0002-01-01… — gửi đi là 400 cả màn.
    if (filters.fromDate && laGiaTriNgay(filters.fromDate)) p.set('fromDate', filters.fromDate);
    if (filters.toDate && laGiaTriNgay(filters.toDate)) p.set('toDate', filters.toDate);
    // Lọc ngày theo ĐÚNG cột đang hiện, không theo cấu hình "tính theo Ngày tạo" của admin.
    p.set('thongKeTruongNgay', TRUONG_NGAY_DE_XUAT);
    return p.toString();
  }, [theBat, tkKey, filters.quickSearch, filters.criteria, filters.status, filters.fromDate, filters.toDate]);

  // Trang gắn với KHOÁ bộ lọc: bộ lọc đổi thì về trang 1 ngay lúc vẽ (không effect).
  const [trangTheoLoc, setTrangTheoLoc] = useState({ khoa: thamSoLoc, page: 1 });
  if (trangTheoLoc.khoa !== thamSoLoc) setTrangTheoLoc({ khoa: thamSoLoc, page: 1 });
  const page = trangTheoLoc.khoa === thamSoLoc ? trangTheoLoc.page : 1;
  const setPage = (doi: (p: number) => number) => setTrangTheoLoc({ khoa: thamSoLoc, page: doi(page) });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  /** Số lượt tải — kết quả về trễ của lượt cũ không đè lượt mới. */
  const luotTai = useRef(0);
  /** Tăng để tải lại cùng bộ lọc (Làm mới). */
  const [lanTai, setLanTai] = useState(0);

  const taiDuLieu = useCallback(async () => {
    const luot = ++luotTai.current;
    const q = new URLSearchParams(thamSoLoc);
    q.set('limit', String(PAGE_SIZE));
    q.set('offset', String((page - 1) * PAGE_SIZE));
    setLoading(true);
    setLoadError('');
    try {
      const res = await api.get<KetQuaTrung>(`/petitions/duplicates?${q}`);
      if (luot !== luotTai.current) return;
      const tong = Number(res.data?.total ?? 0);
      const trangCuoi = Math.max(1, Math.ceil(tong / PAGE_SIZE));
      if (page > trangCuoi) {
        // Tổng giảm dưới trang đang xem → kẹp về trang cuối (lượt này không hạ cờ loading).
        luotTai.current++;
        setTrangTheoLoc({ khoa: thamSoLoc, page: trangCuoi });
        return;
      }
      setNhom(Array.isArray(res.data?.data) ? res.data.data : []);
      setTotal(tong);
      setKy(res.data?.ky);
    } catch (e) {
      if (luot !== luotTai.current) return;
      // KHÔNG biến "không hỏi được máy chủ" thành "không có gì cả": mảng rỗng làm thẻ số ra 0, và số 0
      // đọc như một câu trả lời. Giữ lỗi lại để giao diện nói ra.
      setNhom([]);
      setTotal(0);
      setKy(undefined);
      setLoadError(extractApiError(e, 'Không tải được dữ liệu. Vui lòng thử lại.').messages.join(', '));
    } finally {
      if (luot === luotTai.current) setLoading(false);
    }
  }, [thamSoLoc, page, lanTai]);

  useEffect(() => {
    void taiDuLieu();
  }, [taiDuLieu]);

  const handleReset = () => {
    timKiem.xoaHet();
    setFilters(BO_LOC_TRONG);
    setLanTai((n) => n + 1);
  };

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      // CÙNG tham số với bảng: tệp xuất là đúng những nhóm cán bộ đang nhìn thấy (mọi trang).
      const res = await api.get(`/petitions/export/duplicates?${thamSoLoc}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DonTrungLap_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert('Xuất Excel thất bại. Vui lòng thử lại.');
    } finally {
      setIsExporting(false);
    }
  }, [thamSoLoc]);

  const nhanTieuChi = TIEU_CHI.find((t) => t.value === filters.criteria)?.label ?? '';

  return (
    <div className="p-6 space-y-6" data-testid="duplicate-petitions-page">
      <div>
        <h1 className="text-2xl font-bold text-[#003973]">Đơn trùng</h1>
        <p className="text-slate-600 text-sm mt-1">
          Nhóm đơn có cùng {nhanTieuChi.toLowerCase()} — trong phạm vi dữ liệu của tài khoản. Đơn tiếp nhận sớm
          nhất mỗi nhóm là hồ sơ gốc.
        </p>
      </div>

      <LoadErrorBanner error={loadError} what="danh sách đơn trùng" data-testid="duplicate-petitions-load-error" />

      {ky && (
        <p className="text-sm text-slate-500" data-testid="don-trung-ky">
          Thống kê:{' '}
          <span className="text-slate-700 font-medium">
            {nhanKyApDung(
              ky,
              laGiaTriNgay(filters.fromDate) ? filters.fromDate : '',
              laGiaTriNgay(filters.toDate) ? filters.toDate : '',
            )}
          </span>{' '}
          — nhóm trùng tính trong kỳ này; chọn ngày để đổi.
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div data-testid="don-trung-tong-nhom" className="bg-white rounded-lg border-2 border-amber-200 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-amber-700 font-medium mb-1">Nhóm trùng</p>
              <p className="text-3xl font-bold text-amber-600">{soLieuHienThi(loading ? undefined : total, !!loadError)}</p>
            </div>
            <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
              <Copy className="w-6 h-6 text-amber-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-slate-600">
          {loading ? <span>Đang tải...</span> : <>Trang {page} / {totalPages}</>}
        </div>
        <div className="flex items-center gap-3">
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
            onClick={handleReset}
            data-testid="reset-filters-btn"
            className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <RotateCcw className="w-4 h-4" /> Làm mới
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            {theBat ? (
              <OTimKiemThe
                the={timKiem.the}
                truong={KHAI_DON_TRUNG}
                khai={KHAI_DON_TRUNG}
                giaTriChon={GIA_TRI_CHON_DON_TRUNG}
                onThem={timKiem.them}
                onBoThe={timKiem.boThe}
                onBoGiaTri={timKiem.boGiaTri}
                placeholder="Tìm trong mọi cột — gõ rồi chọn cột (phím /)"
              />
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  data-testid="quick-search-input"
                  value={filters.quickSearch}
                  onChange={(e) => setFilters({ ...filters, quickSearch: e.target.value })}
                  placeholder="Tìm theo mã đơn, người gửi, tóm tắt..."
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973]"
                />
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Trùng theo</label>
            <select
              data-testid="chon-tieu-chi"
              value={filters.criteria}
              onChange={(e) => setFilters({ ...filters, criteria: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973] bg-white"
            >
              {TIEU_CHI.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Trạng thái</label>
            <select
              data-testid="loc-trang-thai"
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973] bg-white"
            >
              <option value="">Tất cả</option>
              {GIA_TRI_CHON_DON_TRUNG.trangThai.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
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
                data-testid="loc-den-ngay"
                value={filters.toDate}
                onChange={(e) => setFilters({ ...filters, toDate: e.target.value })}
                className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973]"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-16 text-center" data-testid="don-trung-loading">
            <p className="text-slate-500">Đang tải dữ liệu...</p>
          </div>
        ) : nhom.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-16 text-center" data-testid="don-trung-empty">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">
              {loadError ? 'Chưa hỏi được máy chủ — xem thông báo phía trên' : 'Không có nhóm trùng nào'}
            </p>
            {!loadError && theBat && timKiem.the.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 text-sm text-slate-600">
                <span>Không tìm thấy với:</span>
                <DanhSachThe
                  the={timKiem.the}
                  khai={KHAI_DON_TRUNG}
                  giaTriChon={GIA_TRI_CHON_DON_TRUNG}
                  onBoThe={timKiem.boThe}
                />
              </div>
            )}
          </div>
        ) : (
          nhom.map((n) => (
            <div
              key={n.giaTri}
              data-testid={`nhom-trung-${khoaNhom(n.giaTri)}`}
              className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden"
            >
              <div className="flex items-center justify-between gap-3 px-5 py-3 bg-amber-50 border-b border-amber-200">
                <div className="flex items-center gap-2 text-sm">
                  <Link2 className="w-4 h-4 text-amber-700" />
                  <span className="text-slate-600">Trùng {nhanTieuChi.toLowerCase()}:</span>
                  <span className="font-bold text-slate-800">{n.giaTri}</span>
                </div>
                <span className="text-sm font-medium text-amber-800">{n.soDon} đơn</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-bold text-slate-600 uppercase w-24">Thao tác</th>
                      {COT.map((c) => (
                        <th key={c.tieuDe} className="px-4 py-2 text-left text-xs font-bold text-slate-600 uppercase">
                          {c.tieuDe}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {n.dons.map((d) => {
                      const laGoc = n.goc?.id === d.id;
                      return (
                        <tr
                          key={d.id}
                          data-testid={`don-trung-${d.id}`}
                          onClick={() => navigate(`/petitions/${d.id}/edit`)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              navigate(`/petitions/${d.id}/edit`);
                            }
                          }}
                          tabIndex={0}
                          className={`cursor-pointer hover:bg-blue-50 transition-colors ${laGoc ? 'bg-green-50/60' : ''}`}
                        >
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => navigate(`/petitions/${d.id}/edit`)}
                              data-testid={`view-btn-${d.id}`}
                              className="p-1.5 text-[#003973] hover:bg-[#003973]/10 rounded transition-colors"
                              title="Mở đơn"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="text-sm font-mono font-bold text-[#003973]">{formatHoSoCode(d.stt)}</span>
                            {laGoc ? (
                              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border border-green-300 bg-green-100 text-green-800">
                                Hồ sơ gốc
                              </span>
                            ) : (
                              // Nói thẳng đơn này trùng với hồ sơ gốc NÀO: không có dòng này thì cán bộ phải tự dò
                              // lên đầu nhóm để biết mã cần đối chiếu.
                              n.goc && (
                                <span className="ml-2 text-xs text-slate-500">
                                  Trùng với {formatHoSoCode(n.goc.stt)}
                                </span>
                              )
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-800">{d.senderName || '—'}</td>
                          <td className="px-4 py-3">
                            <p className="text-sm text-slate-700 line-clamp-2 max-w-md">{d.detailContent || '—'}</p>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                            {formatVNDate(d.ngayDeXuat)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${PETITION_STATUS_BADGE[d.status] ?? BADGE_DEFAULT}`}
                            >
                              {PETITION_STATUS_LABEL[d.status] ?? d.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>

      {!loading && total > PAGE_SIZE && (
        <div className="flex items-center justify-between px-2">
          <p className="text-sm text-slate-500">
            Trang {page} / {totalPages} — {total} nhóm trùng
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="don-trung-prev-page"
              aria-label="Trang trước"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 text-slate-500 hover:text-slate-700 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              data-testid="don-trung-next-page"
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
  );
}
