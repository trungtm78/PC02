/**
 * UyThacDieuTraListPage — PR3 refactor.
 *
 * Anh's original complaint: UTDT UI inconsistent vs Cases/Incidents/Petitions.
 * Resolution: dùng `<ListPageShell>` compound API (PR1) như Pattern A pages.
 *
 * Changes from pre-PR3 version:
 * - Bỏ PageHeader cũ → ListPageShell.Header
 * - 4-state TrangThaiPhanHoi qua ListPageShell.StatusChips (canonical filter UX)
 * - Search + advanced filter qua ListPageShell.Toolbar (collapsible)
 * - Slate palette thay gray-* (tokens từ constants/styles.ts)
 * - Modal delete với reason textarea thay browser confirm() (a11y + audit trail)
 * - URL state via useListPageUrlState('utdt') — bookmark/back-button safe
 * - Table state machine (loading/error/empty/empty-filtered/ready) qua ListPageShell.Table
 * - Pagination qua ListPageShell.Pagination
 * - Vietnamese error messages
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useListShortcuts } from '@/hooks/useListShortcuts';
import { Pencil, FileSignature, Plus, Trash2, Eye, Clock, CheckCircle, XCircle, AlertTriangle, AlertCircle, X } from 'lucide-react';
import axios from 'axios';
import { useBulkSelection } from '@/features/_shared/bulk/useBulkSelection';
import { BulkActionBar } from '@/features/_shared/bulk/BulkActionBar';
import { buildCasesAdapter } from '@/features/_shared/bulk/adapters/cases';
import type { BulkAction, BulkResult, BulkAdapter } from '@/features/_shared/bulk/types';
import { api } from '@/lib/api';
import { formatVNDate } from '@/lib/dates';
import {
  ListPageShell,
  useListPageUrlState,
  type ColumnDef,
  type TableState,
  OTimKiemThe,
  DanhSachThe,
  useTheTimKiem,
  truongGoiY,
} from '@/components/shared/ListPageShell';
import { Modal } from '@/components/shared/Modal';
import {
  TRANG_THAI_PHAN_HOI_LABEL,
  TRANG_THAI_PHAN_HOI_BADGE,
  TRANG_THAI_PHAN_HOI_CHIPS,
  LOAI_UY_THAC_LABEL,
  LOAI_UY_THAC_OPTIONS,
  CASE_STATUS_LABEL,
  CASE_STATUS_BADGE,
  CASE_STATUS_OPTIONS,
  type TrangThaiPhanHoi,
} from '@/shared/enums/status-labels';
import { CaseType, CaseStatus, LoaiUyThac } from '@/shared/enums/generated';
import {
  A11Y_FOCUS_RING,
  BTN_PRIMARY,
  BTN_SECONDARY,
  OVERDUE_ROW_HIGHLIGHT,
} from '@/constants/styles';
import { StatsCardsStrip, type StatCard } from '@/components/shared/StatsCardsStrip';
import { useOChuDongBo } from '@/components/shared/ListPageShell/useOChuDongBo';
import { TIM_KIEM_VU_AN } from '@/shared/tim-kiem/generated';
import { KHOA_TAT_CA } from '@/shared/tim-kiem/the';
import { useFeatureBatMacDinh } from '@/lib/features/useFeature';
import { nhanKyThongKe } from '@/constants/thongKeSettings';

// Backend DeleteCaseDto enforces same minimum. Drift detection: search this
// constant across repo if changing — see CLAUDE.md WIRE FORMAT pattern.
const AUDIT_REASON_MIN_LENGTH = 10;

// URL param short-code dictionary. Kept short for bookmark/share URL hygiene
// (e.g. ?utdt_status=QUA_HAN&utdt_cs=TIEP_NHAN&utdt_tnf=2026-01-01).
// utdt_status = TrangThaiPhanHoi      utdt_cs  = caseStatus
// utdt_lut    = loaiUyThac            utdt_dv  = donViGiao
// utdt_tnf    = ngayTiepNhanFrom      utdt_tnt = ngayTiepNhanTo
// utdt_inv    = investigatorName      utdt_page = pagination
// utdt_q      = global search query

// ─── API types ──────────────────────────────────────────────────────

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
  /** Nghi vấn đối tượng — cột typed, cũng là cột thẻ `doiTuongNghiVan` lọc. */
  nghiVanDoiTuong?: string | null;
  trangThaiPhanHoi?: TrangThaiPhanHoi;
  investigator: { id: string; firstName?: string; lastName?: string; username: string } | null;
  createdBy: { id: string; firstName?: string; lastName?: string } | null;
  createdAt: string;
}

interface UtdtStatsResponse {
  total: number;
  byTrangThai: Record<TrangThaiPhanHoi, number>;
  /** Kỳ MÁY CHỦ thật sự đã áp — cùng kỳ với danh sách UTDT. Nhãn thanh thẻ lấy từ đây. */
  ky?: { ky: string; truong: string; tuNgay: string | null; denNgay: string | null };
}

// ─── Tìm kiếm dạng thẻ ──────────────────────────────────────────────

/**
 * Tham số trước thời thẻ → khoá thẻ. UTDT dùng CHUNG tệp khai với Vụ án (cùng bảng `cases`), nên
 * thẻ ở đây cùng khoá với màn Vụ án. `dv` (Đơn vị giao) và `inv` (Điều tra viên) là hai ô lọc chữ cũ.
 */
const THAM_SO_CU_UTDT = {
  q: KHOA_TAT_CA,
  dv: 'donViGiao',
  inv: 'dieuTraVien',
} as const;

/** Thẻ "Trạng thái" lọc trạng thái VỤ ÁN (dòng nhỏ trong ô), cùng nhãn cột đang hiện. */
const GIA_TRI_CHON_UTDT = {
  trangThai: Object.values(CaseStatus).map((v) => ({
    value: v,
    label: CASE_STATUS_LABEL[v],
  })),
};

/**
 * Gắn phần tìm kiếm vào tham số của CẢ `/cases` lẫn `/cases/utdt-stats` — một chỗ để hai lời gọi
 * không trôi khỏi nhau (thẻ đếm lệch danh sách). Cờ bật → thẻ `tk`; cờ tắt → ô chữ cũ.
 */
function ganTimKiem(
  params: URLSearchParams,
  o: { theBat: boolean; tk: readonly string[]; search: string; donViGiao: string; dieuTraVien: string },
) {
  if (o.theBat) {
    for (const v of o.tk) params.append('tk', v);
    return;
  }
  if (o.search) params.set('search', o.search);
  if (o.donViGiao) params.set('donViGiao', o.donViGiao);
  if (o.dieuTraVien) params.set('investigatorName', o.dieuTraVien);
}

// ─── Helpers ────────────────────────────────────────────────────────

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

function getNghiVan(row: UyThacFromApi): string | null {
  const meta = row.metadata as Record<string, unknown> | null;
  return (meta?.nghiVanDoiTuong as string | undefined) ?? null;
}

function getVietnameseErrorMessage(e: unknown): string {
  if (axios.isAxiosError(e)) {
    const status = e.response?.status;
    if (status === 401) return 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại';
    if (status === 403) return 'Bạn không có quyền xem dữ liệu này';
    if (status && status >= 500) return 'Lỗi máy chủ, vui lòng thử lại sau';
    const serverMsg = (e.response?.data as { message?: string } | undefined)?.message;
    if (serverMsg) return serverMsg;
    if (e.code === 'ECONNABORTED') return 'Quá thời gian chờ, vui lòng thử lại';
    return 'Không tải được danh sách ủy thác';
  }
  return 'Lỗi không xác định';
}

// Trust boundary: validate every URL-backed filter before passing to API.
// /codex P2 fix — bookmarked/tampered URLs like ?utdt_cs=bad would otherwise
// reach backend as 400 (enum miss) or `new Date('bad')` (NaN date filter).
const TRANG_THAI_PHAN_HOI_VALUES = new Set<string>([
  'DA_PHAN_HOI',
  'KHONG_THUC_HIEN_DUOC',
  'QUA_HAN',
  'CHUA_PHAN_HOI',
]);
const CASE_STATUS_VALUES = new Set<string>(Object.values(CaseStatus));
const LOAI_UY_THAC_VALUES = new Set<string>(Object.values(LoaiUyThac));
// YYYY-MM-DD calendar-valid date (matches <input type="date"> output).
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidTrangThai(v: string | null): v is TrangThaiPhanHoi {
  return v != null && TRANG_THAI_PHAN_HOI_VALUES.has(v);
}
function sanitizeEnumParam(v: string | null, values: Set<string>): string {
  return v != null && values.has(v) ? v : '';
}
function sanitizeDateParam(v: string | null): string {
  if (v == null || !ISO_DATE_RE.test(v)) return '';
  // Reject calendar-invalid like 2026-02-30
  const d = new Date(v);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? '' : v;
}
function sanitizeStringParam(v: string | null, maxLen = 100): string {
  if (v == null) return '';
  // Strip control chars + cap length. Trust boundary for free-text URL fields.
  return v.replace(/[ -]/g, '').slice(0, maxLen);
}

const PAGE_SIZE = 20;

function buildUtdtCards(stats: { total: number; byTrangThai: Record<TrangThaiPhanHoi, number> } | null): StatCard[] {
  return [
    { label: 'Tổng UTDT', value: stats?.total ?? null, icon: FileSignature, iconBgClass: 'bg-[#003973]/10', iconColorClass: 'text-[#003973]', valueColorClass: 'text-[#003973]' },
    { label: 'Chưa phản hồi', value: stats?.byTrangThai.CHUA_PHAN_HOI ?? null, icon: Clock, iconBgClass: 'bg-slate-100', iconColorClass: 'text-slate-600', valueColorClass: 'text-slate-600' },
    { label: 'Đã phản hồi', value: stats?.byTrangThai.DA_PHAN_HOI ?? null, icon: CheckCircle, iconBgClass: 'bg-green-100', iconColorClass: 'text-green-600', valueColorClass: 'text-green-600' },
    { label: 'Không thực hiện', value: stats?.byTrangThai.KHONG_THUC_HIEN_DUOC ?? null, icon: XCircle, iconBgClass: 'bg-red-100', iconColorClass: 'text-red-600', valueColorClass: 'text-red-600' },
    { label: 'Quá hạn', value: stats?.byTrangThai.QUA_HAN ?? null, icon: AlertTriangle, iconBgClass: 'bg-amber-100', iconColorClass: 'text-amber-600', valueColorClass: 'text-amber-600' },
  ];
}

// ─── Component ──────────────────────────────────────────────────────

export default function UyThacDieuTraListPage() {
  const navigate = useNavigate();
  const url = useListPageUrlState('utdt');

  // Primary status filter (4-state response status)
  const rawTrangThai = url.getParam('status');
  const trangThai = isValidTrangThai(rawTrangThai) ? rawTrangThai : null;

  // Secondary filters — kept in URL for bookmark/back-button restore.
  // ALL pass through trust-boundary sanitizers (/codex P2 fix) — invalid enums
  // or malformed dates from tampered URLs degrade gracefully to "no filter".
  const caseStatus = sanitizeEnumParam(url.getParam('cs'), CASE_STATUS_VALUES);
  const loaiUyThac = sanitizeEnumParam(url.getParam('lut'), LOAI_UY_THAC_VALUES);
  const donViGiao = sanitizeStringParam(url.getParam('dv'));
  const ngayTiepNhanFrom = sanitizeDateParam(url.getParam('tnf'));
  const ngayTiepNhanTo = sanitizeDateParam(url.getParam('tnt'));
  const investigatorSearch = sanitizeStringParam(url.getParam('inv'));
  const page = Math.max(1, url.getNumberParam('page', 1));
  const searchQuery = sanitizeStringParam(url.getParam('q'), 200);
  // Ô tìm kiếm dạng thẻ. Cờ `TIM_KIEM_THE` tắt → trở lại ô chữ `q` + hai ô lọc chữ cũ, không deploy.
  const theBat = useFeatureBatMacDinh('TIM_KIEM_THE');
  const timKiem = useTheTimKiem({
    prefix: 'utdt',
    khai: TIM_KIEM_VU_AN,
    thamSoCu: THAM_SO_CU_UTDT,
    bat: theBat,
  });
  // Khoá theo GIÁ TRỊ: `tkGui` đổi tham chiếu mỗi lần URL đổi (cả khi chỉ đổi trang).
  const tkKey = JSON.stringify(timKiem.tkGui);

  // Debounce search + investigator (300ms — same as Pattern A pages)
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const [debouncedInvestigator, setDebouncedInvestigator] = useState(investigatorSearch);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedInvestigator(investigatorSearch), 300);
    return () => clearTimeout(t);
  }, [investigatorSearch]);

  const [rows, setRows] = useState<UyThacFromApi[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [tableState, setTableState] = useState<TableState>('loading');
  const [error, setError] = useState<string | undefined>();
  const abortRef = useRef<AbortController | null>(null);
  const [refetchCounter, setRefetchCounter] = useState(0);
  useListShortcuts({ onNew: () => navigate('/uy-thac-dieu-tra/new'), onRefresh: () => setRefetchCounter((c) => c + 1) });

  // Bulk selection
  const selection = useBulkSelection<UyThacFromApi>({
    rowKey: 'id',
    pageRows: rows,
    totalCountMatchingFilter: totalCount,
  });
  const adapter = useMemo(() => {
    const base = buildCasesAdapter({ enableDelete: true });
    return { ...base, resourceLabel: 'ủy thác' };
  }, []);

  // Clear selection khi filter/page thay đổi (tránh stale ids).
  const selectionClearRef = useRef(selection.clear);
  selectionClearRef.current = selection.clear;
  useEffect(() => {
    selectionClearRef.current();
  }, [trangThai, caseStatus, loaiUyThac, donViGiao, ngayTiepNhanFrom, ngayTiepNhanTo, debouncedInvestigator, page, debouncedSearch, tkKey]);

  // Transient banner (bulk result feedback)
  const [transientBanner, setTransientBanner] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const handleBulkSuccess = useCallback(
    (result: BulkResult | void, action: BulkAction<UyThacFromApi>) => {
      if (action.key === 'export') {
        setTransientBanner({ kind: 'success', text: 'Đã xuất Excel' });
        return;
      }
      if (result && typeof result === 'object') {
        const { succeeded, skipped, failed } = result;
        const parts: string[] = [];
        if (succeeded?.length) parts.push(`Đã xử lý ${succeeded.length} ủy thác`);
        if (skipped?.length) parts.push(`Bỏ qua ${skipped.length}`);
        if (failed?.length) parts.push(`Lỗi ${failed.length}`);
        setTransientBanner({
          kind: failed?.length ? 'error' : 'success',
          text: parts.join(' · ') || 'Hoàn tất',
        });
        setRefetchCounter((c) => c + 1);
      }
    },
    [],
  );
  const handleBulkError = useCallback(
    (err: unknown, action: BulkAction<UyThacFromApi>) => {
      setTransientBanner({
        kind: 'error',
        text: `Thao tác "${action.label}" thất bại: ${getVietnameseErrorMessage(err)}`,
      });
    },
    [],
  );
  useEffect(() => {
    if (!transientBanner) return;
    const t = setTimeout(() => setTransientBanner(null), 5000);
    return () => clearTimeout(t);
  }, [transientBanner]);

  // Modal delete state
  const [deleteTarget, setDeleteTarget] = useState<UyThacFromApi | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setTableState('loading');
    setError(undefined);

    const params = new URLSearchParams();
    params.set('caseType', CaseType.UY_THAC_DIEU_TRA);
    params.set('offset', String((page - 1) * PAGE_SIZE));
    params.set('limit', String(PAGE_SIZE));
    ganTimKiem(params, {
      theBat,
      tk: JSON.parse(tkKey) as string[],
      search: debouncedSearch,
      donViGiao,
      dieuTraVien: debouncedInvestigator,
    });
    if (trangThai) params.set('trangThaiPhanHoi', trangThai);
    if (caseStatus) params.set('status', caseStatus);
    if (loaiUyThac) params.set('loaiUyThac', loaiUyThac);
    if (ngayTiepNhanFrom) params.set('ngayTiepNhanFrom', ngayTiepNhanFrom);
    if (ngayTiepNhanTo) params.set('ngayTiepNhanTo', ngayTiepNhanTo);

    api
      .get<{ data: UyThacFromApi[]; total: number }>(`/cases?${params.toString()}`, {
        signal: ctrl.signal,
      })
      .then((res) => {
        if (ctrl.signal.aborted) return;
        const data = res.data?.data ?? [];
        const total = res.data?.total ?? 0;
        setRows(data);
        setTotalCount(total);
        const hasAnyFilter =
          (theBat
            ? tkKey !== '[]'
            : !!debouncedSearch || !!donViGiao || !!debouncedInvestigator) ||
          !!trangThai ||
          !!caseStatus ||
          !!loaiUyThac ||
          !!ngayTiepNhanFrom ||
          !!ngayTiepNhanTo;
        if (total === 0) {
          setTableState(hasAnyFilter ? 'empty-filtered' : 'empty');
        } else {
          setTableState('ready');
        }
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted || axios.isCancel(e)) return;
        setError(getVietnameseErrorMessage(e));
        setTableState('error');
      });
  }, [
    debouncedSearch,
    trangThai,
    caseStatus,
    loaiUyThac,
    donViGiao,
    ngayTiepNhanFrom,
    ngayTiepNhanTo,
    debouncedInvestigator,
    page,
    refetchCounter,
    theBat,
    tkKey,
  ]);

  useEffect(() => {
    fetchData();
    return () => abortRef.current?.abort();
  }, [fetchData]);

  // /codex P2 fix: clamp out-of-range URL page. Scenarios:
  // 1. User bookmarks ?utdt_page=999 then visits — total=5, totalPages=1
  // 2. User deletes the last row on page 7 — total drops below current page
  // In both cases, totalCount > 0 but `rows` ends up empty for current page.
  // Auto-redirect to page 1 (preserves filters) — alternative is "go to last
  // page", but page=1 is the predictable, single-jump UX.
  useEffect(() => {
    if (totalCount === 0) return; // empty state handles its own UX
    const maxPage = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
    if (page > maxPage) {
      url.setParam('page', '1');
    }
  }, [totalCount, page, url]);

  // F2: Stats chip counts now from GET /cases/utdt-stats (4 parallel counts
  // grouped by computed TrangThaiPhanHoi). Filter scope: search + non-state
  // filters propagate; trangThaiPhanHoi stripped server-side.
  const [utdtStats, setUtdtStats] = useState<UtdtStatsResponse | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    const params = new URLSearchParams();
    ganTimKiem(params, {
      theBat,
      tk: JSON.parse(tkKey) as string[],
      search: debouncedSearch,
      donViGiao,
      dieuTraVien: debouncedInvestigator,
    });
    if (loaiUyThac) params.set('loaiUyThac', loaiUyThac);
    if (ngayTiepNhanFrom) params.set('ngayTiepNhanFrom', ngayTiepNhanFrom);
    if (ngayTiepNhanTo) params.set('ngayTiepNhanTo', ngayTiepNhanTo);

    api
      .get<UtdtStatsResponse>(
        `/cases/utdt-stats?${params.toString()}`,
        { signal: ctrl.signal },
      )
      .then((res) => {
        if (ctrl.signal.aborted) return;
        setUtdtStats(res.data);
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted || axios.isCancel(e)) return;
        // Non-blocking — chips chỉ hide counts khi stats fail
      });
    return () => ctrl.abort();
  }, [
    debouncedSearch,
    caseStatus, // [D3] include caseStatus so stats reflect advanced filter
    loaiUyThac,
    donViGiao,
    ngayTiepNhanFrom,
    ngayTiepNhanTo,
    debouncedInvestigator,
    refetchCounter, // refresh stats after bulk ops
    theBat,
    tkKey,
  ]);

  const chipOptions = useMemo(
    () =>
      TRANG_THAI_PHAN_HOI_CHIPS.map((c) => ({
        value: c.value,
        shortLabel: c.shortLabel,
        label: c.label,
        count: utdtStats?.byTrangThai[c.value],
      })),
    [utdtStats],
  );

  const columns: ColumnDef<UyThacFromApi>[] = useMemo(
    () => [
      {
        key: 'actions',
        header: 'Thao tác',
        width: '8rem',
        render: (r) => (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/cases/${r.id}`);
              }}
              className={`p-2 text-[#003973] hover:bg-[#003973]/10 rounded transition-colors ${A11Y_FOCUS_RING}`}
              title="Xem chi tiết"
            >
              <Eye className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/uy-thac-dieu-tra/${r.id}/edit`);
              }}
              className={`p-2 text-slate-600 hover:bg-slate-100 rounded transition-colors ${A11Y_FOCUS_RING}`}
              title="Sửa ủy thác"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteTarget(r);
                setDeleteReason('');
                setDeleteError(null);
              }}
              className={`p-2 text-red-600 hover:bg-red-50 rounded transition-colors ${A11Y_FOCUS_RING}`}
              title="Xóa ủy thác"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ),
      },
      {
        key: 'caseCode',
        header: 'Mã hồ sơ',
        timKiem: ['stt', 'sttCu'],
        render: (r) => (
          <span className="font-mono text-xs text-blue-700">{r.caseCode ?? '—'}</span>
        ),
      },
      {
        key: 'ngayTiepNhan',
        header: 'Ngày tiếp nhận',
        timKiem: 'ngayTiepNhan',
        render: (r) => (r.ngayTiepNhan ? formatVNDate(r.ngayTiepNhan) : '—'),
      },
      {
        key: 'donViGiao',
        header: 'Đơn vị giao',
        timKiem: 'donViGiao',
        render: (r) => (
          <span className="font-medium text-slate-800">{r.donViGiao ?? '—'}</span>
        ),
      },
      {
        key: 'soQuyetDinhUyThac',
        header: 'Số QĐ/Phiếu',
        timKiem: 'soQuyetDinh',
        render: (r) => r.soQuyetDinhUyThac ?? '—',
      },
      {
        key: 'nghiVan',
        header: 'Đối tượng nghi vấn',
        timKiem: 'doiTuongNghiVan',
        render: (r) => {
          // Cột typed trước — CÙNG cột thẻ tìm kiếm lọc; metadata chỉ đỡ hồ sơ cũ chưa chuẩn hoá.
          const nghiVan = r.nghiVanDoiTuong?.trim() || getNghiVan(r);
          return (
            <span className="block max-w-[180px] truncate" title={nghiVan ?? undefined}>
              {nghiVan ?? '—'}
            </span>
          );
        },
      },
      {
        key: 'crime',
        header: 'Tội danh',
        timKiem: 'toiDanh',
        render: (r) => (
          <span className="block max-w-[140px] truncate" title={r.crime ?? undefined}>
            {r.crime ?? '—'}
          </span>
        ),
      },
      {
        key: 'investigator',
        header: 'Điều tra viên',
        timKiem: 'dieuTraVien',
        render: (r) => getInvestigatorName(r.investigator),
      },
      {
        key: 'thoiHanUyThac',
        header: 'Thời hạn',
        timKiem: 'thoiHan',
        render: (r) => {
          if (!r.thoiHanUyThac) return '—';
          const overdue = computeTrangThai(r) === 'QUA_HAN';
          return (
            <span className={overdue ? 'text-red-700 font-semibold' : 'text-slate-700'}>
              {formatVNDate(r.thoiHanUyThac)}
            </span>
          );
        },
      },
      {
        key: 'status',
        header: 'Trạng thái',
        timKiem: 'trangThai',
        render: (r) => {
          const trangThaiVal = computeTrangThai(r);
          return (
            <div className="flex flex-col gap-0.5">
              <span className={TRANG_THAI_PHAN_HOI_BADGE[trangThaiVal]}>
                {TRANG_THAI_PHAN_HOI_LABEL[trangThaiVal]}
              </span>
              {r.loaiUyThac && (
                <span className="text-xs text-slate-500">
                  {LOAI_UY_THAC_LABEL[r.loaiUyThac as keyof typeof LOAI_UY_THAC_LABEL] ??
                    r.loaiUyThac}
                </span>
              )}
              {r.status && (
                <span
                  className={`text-xs border rounded px-1 py-0.5 w-fit ${
                    CASE_STATUS_BADGE[r.status as keyof typeof CASE_STATUS_BADGE] ??
                    'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  {CASE_STATUS_LABEL[r.status as keyof typeof CASE_STATUS_LABEL] ?? r.status}
                </span>
              )}
            </div>
          );
        },
      },
      {
        key: 'createdBy',
        header: 'Người nhập',
        timKiem: 'nguoiNhap',
        render: (r) =>
          r.createdBy
            ? [r.createdBy.firstName, r.createdBy.lastName].filter(Boolean).join(' ') || '—'
            : '—',
      },
    ],
    [navigate],
  );

  // Màn này chưa có menu chọn cột nên mọi cột đều hiện; gợi ý = các cột khai `timKiem`, đúng thứ tự.
  const truongTimKiem = useMemo(() => truongGoiY(columns, TIM_KIEM_VU_AN), [columns]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const handleStatusChange = useCallback(
    (value: string | null) => {
      url.setParams({ status: value, page: '1' });
    },
    [url],
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      url.setParams({ q: value, page: '1' });
    },
    [url],
  );

  const handlePageChange = useCallback(
    (newPage: number) => {
      url.setParam('page', String(newPage));
    },
    [url],
  );

  const handleResetFilters = useCallback(() => {
    url.clearAll();
  }, [url]);

  const activeFilterCount =
    (trangThai ? 1 : 0) +
    (caseStatus ? 1 : 0) +
    (loaiUyThac ? 1 : 0) +
    (ngayTiepNhanFrom ? 1 : 0) +
    (ngayTiepNhanTo ? 1 : 0) +
    (theBat
      ? timKiem.the.length
      : (donViGiao ? 1 : 0) + (investigatorSearch ? 1 : 0) + (searchQuery ? 1 : 0));

  async function confirmDelete() {
    if (!deleteTarget) return;
    const reason = deleteReason.trim();
    if (reason.length < AUDIT_REASON_MIN_LENGTH) {
      setDeleteError(`Lý do xóa cần tối thiểu ${AUDIT_REASON_MIN_LENGTH} ký tự (audit trail BLTTHS Đ.46).`);
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.delete(`/cases/${deleteTarget.id}`, { data: { reason } });
      setDeleteTarget(null);
      setDeleteReason('');
      fetchData();
    } catch (e: unknown) {
      setDeleteError(getVietnameseErrorMessage(e));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <ListPageShell>
        <ListPageShell.Header
          icon={FileSignature}
          title="Ủy Thác Điều Tra"
          subtitle="Điều 171 BLTTHS 2015 — TT 119/2021/TT-BCA"
          actions={
            <button
              type="button"
              onClick={() => navigate('/uy-thac-dieu-tra/new')}
              className={`${BTN_PRIMARY} ${A11Y_FOCUS_RING} flex items-center gap-2`}
            >
              <Plus className="w-4 h-4" />
              <span>Nhập ủy thác</span>
            </button>
          }
        />
        <StatsCardsStrip
          cards={buildUtdtCards(utdtStats)}
          loading={utdtStats == null}
          periodLabel={
            utdtStats?.ky
              ? nhanKyThongKe(utdtStats.ky.ky, utdtStats.ky.tuNgay, utdtStats.ky.denNgay)
              : null
          }
        />
        <ListPageShell.StatusChips
          options={chipOptions}
          activeValue={trangThai}
          onChange={handleStatusChange}
          totalCount={utdtStats?.total ?? totalCount}
          countsLoading={utdtStats == null && tableState === 'loading'}
          countsUnknown={tableState === 'error'}
        />
        <ListPageShell.Toolbar
          searchValue={searchQuery}
          onSearchChange={handleSearchChange}
          searchSlot={
            theBat ? (
              <OTimKiemThe
                the={timKiem.the}
                truong={truongTimKiem}
                khai={TIM_KIEM_VU_AN}
                giaTriChon={GIA_TRI_CHON_UTDT}
                onThem={timKiem.them}
                onBoThe={timKiem.boThe}
                onBoGiaTri={timKiem.boGiaTri}
                placeholder="Tìm trong mọi cột — gõ rồi chọn cột (phím /)"
              />
            ) : undefined
          }
          searchPlaceholder="Tìm theo tên, đơn vị giao, số QĐ, đối tượng..."
          activeFilterCount={activeFilterCount}
          onResetFilters={handleResetFilters}
          cardStyle
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <FilterSelect
              label="Trạng thái Vụ án"
              value={caseStatus}
              onChange={(v) => url.setParams({ cs: v, page: '1' })}
              options={CASE_STATUS_OPTIONS}
            />
            <FilterSelect
              label="Loại ủy thác"
              value={loaiUyThac}
              onChange={(v) => url.setParams({ lut: v, page: '1' })}
              options={LOAI_UY_THAC_OPTIONS}
            />
            {/* Hai ô chữ này là thẻ `donViGiao` / `dieuTraVien` khi ô thẻ bật — để cả hai là hai lối
                vào một bộ lọc. Chỉ hiện lại khi cờ `TIM_KIEM_THE` tắt (công tắc khẩn). */}
            {!theBat && (
              <>
                <FilterInput
                  label="Đơn vị giao"
                  placeholder="PC01, CA quận X..."
                  value={donViGiao}
                  onChange={(v) => url.setParams({ dv: v, page: '1' })}
                />
                <FilterInput
                  label="Điều tra viên"
                  placeholder="Tên điều tra viên..."
                  value={investigatorSearch}
                  onChange={(v) => url.setParams({ inv: v, page: '1' })}
                />
              </>
            )}
            <FilterInput
              type="date"
              label="Ngày tiếp nhận từ"
              value={ngayTiepNhanFrom}
              onChange={(v) => url.setParams({ tnf: v, page: '1' })}
            />
            <FilterInput
              type="date"
              label="Ngày tiếp nhận đến"
              value={ngayTiepNhanTo}
              onChange={(v) => url.setParams({ tnt: v, page: '1' })}
            />
          </div>
        </ListPageShell.Toolbar>
        {transientBanner && (
          <div
            role="status"
            aria-live="polite"
            className={`flex items-center justify-between gap-3 px-4 py-2 border-b border-slate-200 text-sm ${
              transientBanner.kind === 'success'
                ? 'bg-green-50 text-green-800'
                : 'bg-red-50 text-red-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{transientBanner.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setTransientBanner(null)}
              className={`p-1 rounded hover:bg-white/40 ${A11Y_FOCUS_RING}`}
              aria-label="Đóng thông báo"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        <ListPageShell.Table<UyThacFromApi>
          state={tableState}
          columns={columns}
          data={rows}
          rowKey={(r) => r.id}
          title="Danh sách Ủy Thác Điều Tra"
          sectionTitle="Danh sách Ủy Thác Điều Tra"
          totalCount={totalCount}
          error={error}
          emptyState={{
            title: 'Chưa có ủy thác điều tra nào',
            description: 'Tạo ủy thác đầu tiên theo Điều 171 BLTTHS 2015.',
            actionLabel: 'Nhập ủy thác mới',
            onAction: () => navigate('/uy-thac-dieu-tra/new'),
          }}
          emptyFilteredState={{
            onClearFilters: handleResetFilters,
            chiTiet:
              timKiem.the.length > 0 ? (
                <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 text-sm text-slate-600">
                  <span>Không tìm thấy với:</span>
                  <DanhSachThe
                    the={timKiem.the}
                    khai={TIM_KIEM_VU_AN}
                    giaTriChon={GIA_TRI_CHON_UTDT}
                    onBoThe={timKiem.boThe}
                  />
                </div>
              ) : undefined,
          }}
          getRowClassName={(r) =>
            computeTrangThai(r) === 'QUA_HAN' ? OVERDUE_ROW_HIGHLIGHT : ''
          }
          onRowClick={(r) => navigate(`/uy-thac-dieu-tra/${r.id}/edit`)}
          bulkSelection={selection}
          bulkRowsLabel="ủy thác"
          bulkRowLabel={(r) => `ủy thác ${r.caseCode ?? r.id}`}
        />
        <ListPageShell.Pagination
          page={page}
          totalPages={totalPages}
          totalCount={totalCount}
          onPageChange={handlePageChange}
        />
        <BulkActionBar
          selection={selection}
          adapter={adapter as unknown as BulkAdapter<UyThacFromApi>}
          pageRows={rows}
          onSuccess={handleBulkSuccess}
          onError={handleBulkError}
        />
      </ListPageShell>

      {/* Delete modal — replaces window.confirm(). Reason ≥ 10 chars enforced
          client-side (also backend DeleteCaseDto). */}
      <Modal
        open={deleteTarget !== null}
        onClose={() => {
          if (!deleting) {
            setDeleteTarget(null);
            setDeleteReason('');
            setDeleteError(null);
          }
        }}
        title="Xóa ủy thác điều tra"
        maxWidth="max-w-lg"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setDeleteTarget(null);
                setDeleteReason('');
                setDeleteError(null);
              }}
              disabled={deleting}
              className={`${BTN_SECONDARY} ${A11Y_FOCUS_RING}`}
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={() => void confirmDelete()}
              disabled={deleting || deleteReason.trim().length < AUDIT_REASON_MIN_LENGTH}
              className={`${BTN_PRIMARY} ${A11Y_FOCUS_RING} bg-red-600 hover:bg-red-700 disabled:opacity-50`}
              title="Xóa ủy thác"
            >
              {deleting ? 'Đang xóa...' : 'Xác nhận xóa'}
            </button>
          </div>
        }
      >
        {deleteTarget && (
          <div className="space-y-3">
            <p className="text-sm text-slate-700">
              Bạn sắp xóa ủy thác{' '}
              <span className="font-mono text-blue-700">
                {deleteTarget.caseCode ?? deleteTarget.id}
              </span>
              . Hồ sơ vụ án gốc vẫn được giữ nguyên.
            </p>
            <label className="block">
              <span className="block text-xs font-medium text-slate-700 mb-1">
                Lý do xóa <span className="text-red-600">*</span>
              </span>
              <textarea
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                disabled={deleting}
                rows={3}
                minLength={AUDIT_REASON_MIN_LENGTH}
                placeholder="VD: Trùng lặp với ủy thác PC02-UTDT-2026-00012 do nhập sai mã đơn vị giao."
                className={`w-full text-sm border border-slate-300 rounded-md py-1.5 px-2 ${A11Y_FOCUS_RING}`}
                data-testid="utdt-delete-reason"
              />
              <span className="block text-xs text-slate-500 mt-1">
                Tối thiểu 10 ký tự. Lý do được ghi vào audit log.
              </span>
            </label>
            {deleteError && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">
                {deleteError}
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}

// ─── Inline filter primitives ──────────────────────────────────────

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full text-sm border border-slate-300 rounded-md py-1.5 px-2 ${A11Y_FOCUS_RING}`}
      >
        <option value="">— Tất cả —</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function FilterInput({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: 'text' | 'date';
}) {
  // `value` đọc từ URL (utdt_dv, utdt_inv…) và về trễ — ràng thẳng thì gõ bể chữ. Xem `useOChuDongBo`.
  const o = useOChuDongBo(value, onChange);
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>
      <input
        type={type}
        value={o.value}
        placeholder={placeholder}
        onChange={o.onChange}
        onCompositionStart={o.onCompositionStart}
        onCompositionEnd={o.onCompositionEnd}
        className={`w-full text-sm border border-slate-300 rounded-md py-1.5 px-2 ${A11Y_FOCUS_RING}`}
      />
    </div>
  );
}
