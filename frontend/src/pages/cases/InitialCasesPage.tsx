/**
 * InitialCasesPage — Hồ sơ mới tiếp nhận: vụ án ở trạng thái Tiếp nhận, chờ cán bộ nhận xử lý.
 *
 * 17/09/2026: tìm kiếm, lọc, phân trang và thẻ số chạy ở MÁY CHỦ; cột đọc đúng trường thật. Trước đó màn tải
 * 50/860 hồ sơ rồi lọc tại chỗ; Số hồ sơ là id cắt 8 ký tự, Loại đọc trường API không trả, Mức độ đọc trường
 * Vụ án không có, Hạn xử lý/Quá hạn đọc `deadline` (prod 0/860), Đơn vị đọc `unit` rỗng với ô lọc quận gán cứng.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Calendar,
  Eye,
  Edit,
  Trash2,
  CheckCircle,
  Clock,
  Filter,
  RotateCcw,
  FileText,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { usePermission } from '@/hooks/usePermission';
import { extractApiError } from '@/lib/api-errors';
import { api } from '@/lib/api';
import { soLieuHienThi } from '@/lib/soLieuHienThi';
import { LoadErrorBanner } from '@/components/shared/LoadErrorBanner';
import { formatVNDate } from '../../lib/dates';
import { OTimKiemThe, DanhSachThe, useTheTimKiem, formatHoSoCode } from '@/components/shared/ListPageShell';
import { useFeatureBatMacDinh } from '@/lib/features/useFeature';
import { TIM_KIEM_VU_AN } from '@/shared/tim-kiem/generated';
import { laGiaTriNgay } from '@/shared/tim-kiem/the';
import { nhanKyApDung } from '@/constants/thongKeSettings';
import { CaseStatus } from '@/shared/enums/generated';
import { CASE_PROVENANCE_OPTIONS } from './CaseFormPage/constants';

interface HoSoMoi {
  id: string;
  caseCode: string | null;
  name: string;
  moTaChiTiet?: string | null;
  nguonDon?: string | null;
  donViGiaiQuyet?: string | null;
  caseProvenance?: string | null;
  ngayDeXuat?: string | null;
}

interface ThongKeVuAn {
  byStatus?: Partial<Record<CaseStatus, number>>;
  /** Kỳ máy chủ ĐÃ áp cho cả danh sách lẫn thẻ số: ô ngày trống thì là kỳ mặc định admin đặt. */
  ky?: { ky: string; tuNgay: string | null; denNgay: string | null };
}

const PAGE_SIZE = 20;

/** Nhãn nguồn hồ sơ — cùng bảng với ô chọn trên form Vụ án (một nguồn, không chép). */
const NHAN_NGUON_HO_SO: Record<string, string> = Object.fromEntries(
  CASE_PROVENANCE_OPTIONS.map((o) => [o.value, o.label]),
);

/**
 * Cột của bảng — khoá `timKiem` là thẻ tìm được trên cột ấy (cổng `timKiemCotKhai` đọc đúng khai này).
 * Nguồn hồ sơ là mã enum, lọc bằng thẻ chữ không có nghĩa nên không mang khoá.
 */
const COT = [
  { tieuDe: 'STT', timKiem: 'stt' },
  { tieuDe: 'Tên vụ án', timKiem: 'tenVuAn' },
  { tieuDe: 'Tóm tắt nội dung', timKiem: 'tomTat' },
  { tieuDe: 'Nguồn đơn/Đơn vị giao', timKiem: 'nguonDon' },
  { tieuDe: 'Đơn vị giải quyết', timKiem: 'donViGiaiQuyet' },
  { tieuDe: 'Nguồn hồ sơ' },
  { tieuDe: 'Ngày đề xuất', timKiem: 'ngayDeXuat' },
] as const;

const KHOA_TREN_BANG = new Set<string>(
  COT.flatMap((c) => ('timKiem' in c ? [c.timKiem] : [])),
);
const KHAI_HO_SO_MOI = TIM_KIEM_VU_AN.filter((t) => KHOA_TREN_BANG.has(t.key));

interface FilterData {
  quickSearch: string;
  fromDate: string;
  toDate: string;
}

const BO_LOC_TRONG: FilterData = { quickSearch: '', fromDate: '', toDate: '' };

function InitialCasesPage() {
  const navigate = useNavigate();
  const { canEdit } = usePermission();
  const canEditRow = canEdit('cases');

  const [rows, setRows] = useState<HoSoMoi[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [filters, setFilters] = useState<FilterData>(BO_LOC_TRONG);

  const theBat = useFeatureBatMacDinh('TIM_KIEM_THE');
  const timKiem = useTheTimKiem({ prefix: 'initialCases', khai: KHAI_HO_SO_MOI, bat: theBat });
  // Khoá theo GIÁ TRỊ: `tkGui` đổi tham chiếu mỗi lần URL đổi.
  const tkKey = JSON.stringify(timKiem.tkGui);

  /** Tham số lọc chung của danh sách và thẻ số (không gồm trạng thái, trang). */
  const thamSoLoc = useMemo(() => {
    const p = new URLSearchParams();
    if (theBat) {
      for (const v of JSON.parse(tkKey) as string[]) p.append('tk', v);
    } else if (filters.quickSearch.trim()) {
      p.set('search', filters.quickSearch.trim());
    }
    // Chỉ gửi ngày HỢP LỆ: gõ năm từng chữ số, ô ngày bắn 0002-09-17… — gửi đi là 400 cả màn.
    if (filters.fromDate && laGiaTriNgay(filters.fromDate)) p.set('fromDate', filters.fromDate);
    if (filters.toDate && laGiaTriNgay(filters.toDate)) p.set('toDate', filters.toDate);
    return p.toString();
  }, [theBat, tkKey, filters.quickSearch, filters.fromDate, filters.toDate]);

  // Trang gắn với KHOÁ bộ lọc: bộ lọc đổi thì về trang 1 ngay lúc vẽ (không effect), ghi đè khoá cũ.
  const [trangTheoLoc, setTrangTheoLoc] = useState({ khoa: thamSoLoc, page: 1 });
  if (trangTheoLoc.khoa !== thamSoLoc) setTrangTheoLoc({ khoa: thamSoLoc, page: 1 });
  const page = trangTheoLoc.khoa === thamSoLoc ? trangTheoLoc.page : 1;
  const setPage = (doi: (p: number) => number) => setTrangTheoLoc({ khoa: thamSoLoc, page: doi(page) });
  const [total, setTotal] = useState(0);
  const [thongKe, setThongKe] = useState<ThongKeVuAn | null>(null);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  /** Số lượt tải — kết quả về trễ của lượt cũ không đè lượt mới. */
  const luotTai = useRef(0);
  /** Tăng để tải lại cùng bộ lọc (Làm mới, sau khi nhận/xoá). */
  const [lanTai, setLanTai] = useState(0);

  const taiDuLieu = useCallback(async () => {
    const luot = ++luotTai.current;
    const danhSach = new URLSearchParams(thamSoLoc);
    danhSach.set('status', CaseStatus.TIEP_NHAN);
    danhSach.set('limit', String(PAGE_SIZE));
    danhSach.set('offset', String((page - 1) * PAGE_SIZE));
    setLoading(true);
    setLoadError('');
    try {
      const [res, tk] = await Promise.all([
        api.get<{ data?: HoSoMoi[]; total?: number }>(`/cases?${danhSach}`),
        api.get<ThongKeVuAn>(`/cases/stats?${thamSoLoc}`),
      ]);
      if (luot !== luotTai.current) return;
      const tong = Number(res.data?.total ?? 0);
      const trangCuoi = Math.max(1, Math.ceil(tong / PAGE_SIZE));
      if (page > trangCuoi) {
        // Tổng giảm dưới trang đang xem (vừa nhận/xoá) → kẹp về trang cuối (lượt này không hạ cờ loading).
        luotTai.current++;
        setTrangTheoLoc({ khoa: thamSoLoc, page: trangCuoi });
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
  }, [thamSoLoc, page, lanTai]);

  useEffect(() => {
    void taiDuLieu();
  }, [taiDuLieu]);

  const handleResetFilters = () => {
    timKiem.xoaHet();
    setFilters(BO_LOC_TRONG);
    setLanTai((n) => n + 1);
  };

  // ── Nhận xử lý ──────────────────────────────────────
  const [selectedCase, setSelectedCase] = useState<HoSoMoi | null>(null);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState('');
  const moHopNhan = (hs: HoSoMoi) => {
    setAssignError('');
    setSelectedCase(hs);
  };
  const confirmAssign = async () => {
    if (!selectedCase) return;
    setAssignLoading(true);
    setAssignError('');
    try {
      await api.put(`/cases/${selectedCase.id}`, { status: CaseStatus.DANG_DIEU_TRA });
      setSelectedCase(null);
      setLanTai((n) => n + 1);
    } catch (e) {
      // Giữ hộp mở kèm lý do: đóng hộp khi máy chủ từ chối thì cán bộ tưởng đã nhận xong.
      setAssignError(extractApiError(e, 'Nhận xử lý thất bại. Vui lòng thử lại.').messages.join(', '));
    } finally {
      setAssignLoading(false);
    }
  };

  // ── Xoá ──────────────────────────────────────────────
  const [caseToDelete, setCaseToDelete] = useState<HoSoMoi | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const closeDeleteDialog = () => {
    setCaseToDelete(null);
    setDeleteError('');
  };
  const confirmDelete = async () => {
    if (!caseToDelete) return;
    setDeleteError('');
    setDeleteLoading(true);
    try {
      await api.delete(`/cases/${caseToDelete.id}`);
      closeDeleteDialog();
      setLanTai((n) => n + 1);
    } catch (e) {
      // KHÔNG đóng hộp xác nhận khi máy chủ TỪ CHỐI xoá: đóng ở cả hai nhánh thì xoá hỏng nhìn y hệt
      // xoá xong, hồ sơ vẫn còn mà cán bộ đã tin là đã xoá.
      setDeleteError(extractApiError(e, 'Xoá hồ sơ thất bại. Vui lòng thử lại.').messages.join(', '));
    } finally {
      setDeleteLoading(false);
    }
  };

  const choNhan = thongKe ? (thongKe.byStatus?.[CaseStatus.TIEP_NHAN] ?? 0) : undefined;
  const soCot = COT.length + 1;

  return (
    <div className="p-6 space-y-6" data-testid="initial-cases-page">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Vụ án - Vụ việc ban đầu</h1>
        <p className="text-slate-600 text-sm mt-1">Vụ án đang ở trạng thái Tiếp nhận, chờ cán bộ nhận xử lý</p>
      </div>

      <LoadErrorBanner error={loadError} what="danh sách hồ sơ mới tiếp nhận" data-testid="initial-cases-load-error" />

      {thongKe?.ky && (
        <p className="text-sm text-slate-500" data-testid="initial-cases-ky">
          Thống kê:{' '}
          <span className="text-slate-700 font-medium">
            {nhanKyApDung(
              thongKe.ky,
              laGiaTriNgay(filters.fromDate) ? filters.fromDate : '',
              laGiaTriNgay(filters.toDate) ? filters.toDate : '',
            )}
          </span>{' '}
          — danh sách và thẻ số cùng tính trong kỳ này; chọn ngày để đổi.
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div data-testid="initial-kpi-cho-nhan" className="bg-white rounded-lg border-2 border-amber-200 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-amber-700 font-medium mb-1">Chờ nhận</p>
              <p className="text-3xl font-bold text-amber-600">{soLieuHienThi(choNhan, !!loadError)}</p>
            </div>
            <div className="w-14 h-14 bg-amber-100 rounded-lg flex items-center justify-center">
              <Clock className="w-7 h-7 text-amber-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
        <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Filter className="w-5 h-5" />
          Bộ lọc
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-2">Tìm kiếm</label>
            {theBat ? (
              <OTimKiemThe
                the={timKiem.the}
                truong={KHAI_HO_SO_MOI}
                khai={KHAI_HO_SO_MOI}
                onThem={timKiem.them}
                onBoThe={timKiem.boThe}
                onBoGiaTri={timKiem.boGiaTri}
                placeholder="Tìm trong mọi cột — gõ rồi chọn cột (phím /)"
              />
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={filters.quickSearch}
                  onChange={(e) => setFilters({ ...filters, quickSearch: e.target.value })}
                  placeholder="STT, tên vụ án, đơn vị..."
                  className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  data-testid="initial-search"
                />
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Ngày đề xuất từ</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="date"
                data-testid="initial-from-date"
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
                data-testid="initial-to-date"
                value={filters.toDate}
                onChange={(e) => setFilters({ ...filters, toDate: e.target.value })}
                className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={handleResetFilters}
              data-testid="initial-reset"
              className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Làm mới
            </button>
          </div>
        </div>
        <div className="mt-4 text-sm text-slate-600">
          {loading ? (
            'Đang tải...'
          ) : (
            <>
              Có <span data-testid="initial-cases-total" className="font-medium text-slate-800">{total}</span> hồ sơ
              chờ nhận
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="initial-cases-table">
            <thead className="bg-slate-50 border-b-2 border-slate-200">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider w-56 sticky left-0 bg-slate-50 z-10 border-r border-slate-200">
                  Thao tác
                </th>
                {COT.map((c) => (
                  <th key={c.tieuDe} className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                    {c.tieuDe}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={soCot} className="px-4 py-16 text-center" data-testid="initial-cases-loading">
                    <span className="text-slate-600">Đang tải dữ liệu...</span>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={soCot} className="px-4 py-16 text-center" data-testid="initial-cases-empty">
                    <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <p className="text-lg text-slate-500 font-medium">
                      {loadError ? 'Chưa hỏi được máy chủ — xem thông báo phía trên' : 'Không có hồ sơ chờ xử lý'}
                    </p>
                    {!loadError && theBat && timKiem.the.length > 0 ? (
                      <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 text-sm text-slate-600">
                        <span>Không tìm thấy với:</span>
                        <DanhSachThe the={timKiem.the} khai={KHAI_HO_SO_MOI} onBoThe={timKiem.boThe} />
                      </div>
                    ) : (
                      !loadError && (
                        <p className="text-sm text-slate-400 mt-2">Tất cả hồ sơ đã được nhận hoặc thử điều chỉnh bộ lọc</p>
                      )
                    )}
                  </td>
                </tr>
              ) : (
                rows.map((hs) => (
                  <tr
                    key={hs.id}
                    onClick={canEditRow ? () => navigate(`/cases/${hs.id}/edit`) : undefined}
                    onKeyDown={
                      canEditRow
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              navigate(`/cases/${hs.id}/edit`);
                            }
                          }
                        : undefined
                    }
                    tabIndex={canEditRow ? 0 : undefined}
                    className={`transition-colors ${canEditRow ? 'cursor-pointer hover:bg-blue-50' : 'hover:bg-slate-50'}`}
                    data-testid={`initial-row-${hs.id}`}
                  >
                    <td
                      className="px-3 py-4 whitespace-nowrap sticky left-0 z-10 bg-white border-r border-slate-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => moHopNhan(hs)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                          data-testid={`btn-assign-${hs.id}`}
                        >
                          <CheckCircle className="w-4 h-4" />
                          Nhận
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate(`/cases/${hs.id}`)}
                          className="p-1.5 text-slate-600 hover:bg-slate-100 rounded transition-colors"
                          title="Xem chi tiết"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate(`/cases/${hs.id}/edit`)}
                          className="p-1.5 text-amber-600 hover:bg-amber-50 rounded transition-colors"
                          title="Chỉnh sửa"
                          data-testid={`btn-edit-${hs.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setCaseToDelete(hs)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Xóa"
                          data-testid={`btn-delete-${hs.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="text-sm font-mono font-bold text-blue-600">{formatHoSoCode(hs.caseCode)}</span>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm text-slate-800 font-medium line-clamp-2 max-w-xs">{hs.name}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm text-slate-700 line-clamp-2 max-w-xs">{hs.moTaChiTiet || '—'}</p>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">{hs.nguonDon || '—'}</td>
                    <td className="px-4 py-4 text-sm text-slate-700">{hs.donViGiaiQuyet || '—'}</td>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      {hs.caseProvenance ? (NHAN_NGUON_HO_SO[hs.caseProvenance] ?? hs.caseProvenance) : '—'}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700 whitespace-nowrap">{formatVNDate(hs.ngayDeXuat)}</td>
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
                data-testid="initial-cases-prev-page"
                aria-label="Trang trước"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 text-slate-500 hover:text-slate-700 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                data-testid="initial-cases-next-page"
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

      {selectedCase && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" data-testid="assign-modal">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-800">Xác nhận nhận xử lý</h3>
                <button type="button" onClick={() => setSelectedCase(null)} className="p-1 hover:bg-slate-100 rounded transition-colors">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm font-medium text-blue-900">
                  STT: <span className="font-bold">{formatHoSoCode(selectedCase.caseCode)}</span>
                </p>
                <p className="text-sm text-blue-800 mt-1">Tên vụ án: {selectedCase.name}</p>
              </div>
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  <strong>Lưu ý:</strong> Sau khi nhận, vụ án chuyển sang trạng thái Đang điều tra.
                </p>
              </div>
              {assignError && (
                <div
                  data-testid="initial-assign-error"
                  role="alert"
                  className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700"
                >
                  <strong className="font-medium">Chưa nhận được. </strong>
                  {assignError}
                </div>
              )}
            </div>
            <div className="p-6 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setSelectedCase(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => void confirmAssign()}
                disabled={assignLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                data-testid="btn-confirm-assign"
              >
                {assignLoading ? 'Đang xử lý...' : 'Xác nhận nhận xử lý'}
              </button>
            </div>
          </div>
        </div>
      )}

      {caseToDelete && (
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
                <button type="button" onClick={closeDeleteDialog} className="p-1 hover:bg-slate-100 rounded transition-colors">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-slate-700">Bạn có chắc chắn muốn xóa vụ án này? Thao tác này không thể hoàn tác.</p>
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm font-medium text-red-900">
                  STT: <span className="font-bold">{formatHoSoCode(caseToDelete.caseCode)}</span>
                </p>
                <p className="text-sm text-red-800 mt-1 line-clamp-2">{caseToDelete.name}</p>
              </div>
            </div>
            {deleteError && (
              <div
                data-testid="initial-delete-error"
                role="alert"
                className="mx-6 mb-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                <strong className="font-medium">Chưa xoá được. </strong>
                {deleteError}
              </div>
            )}
            <div className="p-6 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeDeleteDialog}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                data-testid="btn-cancel-delete"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={deleteLoading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50"
                data-testid="btn-confirm-delete"
              >
                {deleteLoading ? 'Đang xóa...' : 'Xóa hồ sơ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default InitialCasesPage;
