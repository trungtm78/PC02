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
import { Eye, FileSignature, Plus, Trash2 } from 'lucide-react';
import axios from 'axios';
import { api } from '@/lib/api';
import { formatVNDate } from '@/lib/dates';
import {
  ListPageShell,
  useListPageUrlState,
  type ColumnDef,
  type TableState,
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
import { CaseType } from '@/shared/enums/generated';
import {
  A11Y_FOCUS_RING,
  BTN_PRIMARY,
  BTN_SECONDARY,
  OVERDUE_ROW_HIGHLIGHT,
} from '@/constants/styles';

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
  trangThaiPhanHoi?: TrangThaiPhanHoi;
  investigator: { id: string; firstName?: string; lastName?: string; username: string } | null;
  createdBy: { id: string; firstName?: string; lastName?: string } | null;
  createdAt: string;
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

// Trust boundary: validate enum-shaped URL params before passing to API.
const TRANG_THAI_PHAN_HOI_VALUES = new Set<string>([
  'DA_PHAN_HOI',
  'KHONG_THUC_HIEN_DUOC',
  'QUA_HAN',
  'CHUA_PHAN_HOI',
]);
function isValidTrangThai(v: string | null): v is TrangThaiPhanHoi {
  return v != null && TRANG_THAI_PHAN_HOI_VALUES.has(v);
}

const PAGE_SIZE = 20;

// ─── Component ──────────────────────────────────────────────────────

export default function UyThacDieuTraListPage() {
  const navigate = useNavigate();
  const url = useListPageUrlState('utdt');

  // Primary status filter (4-state response status)
  const rawTrangThai = url.getParam('status');
  const trangThai = isValidTrangThai(rawTrangThai) ? rawTrangThai : null;

  // Secondary filters — kept in URL for bookmark/back-button restore
  const caseStatus = url.getParam('cs') ?? '';
  const loaiUyThac = url.getParam('lut') ?? '';
  const donViGiao = url.getParam('dv') ?? '';
  const ngayTiepNhanFrom = url.getParam('tnf') ?? '';
  const ngayTiepNhanTo = url.getParam('tnt') ?? '';
  const investigatorSearch = url.getParam('inv') ?? '';
  const page = Math.max(1, url.getNumberParam('page', 1));
  const searchQuery = url.getParam('q') ?? '';

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
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (trangThai) params.set('trangThaiPhanHoi', trangThai);
    if (caseStatus) params.set('status', caseStatus);
    if (loaiUyThac) params.set('loaiUyThac', loaiUyThac);
    if (donViGiao) params.set('donViGiao', donViGiao);
    if (ngayTiepNhanFrom) params.set('ngayTiepNhanFrom', ngayTiepNhanFrom);
    if (ngayTiepNhanTo) params.set('ngayTiepNhanTo', ngayTiepNhanTo);
    if (debouncedInvestigator) params.set('investigatorName', debouncedInvestigator);

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
          !!debouncedSearch ||
          !!trangThai ||
          !!caseStatus ||
          !!loaiUyThac ||
          !!donViGiao ||
          !!ngayTiepNhanFrom ||
          !!ngayTiepNhanTo ||
          !!debouncedInvestigator;
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
  ]);

  useEffect(() => {
    fetchData();
    return () => abortRef.current?.abort();
  }, [fetchData]);

  // Stats chip counts: deliberately UNDEFINED in PR3 — UTDT doesn't have a
  // /stats endpoint (caseType=UY_THAC_DIEU_TRA is sliced from /cases) and
  // showing per-page-only counts would mislead users (badge "3" while full
  // dataset has 47 = bug report). PR4 follow-up adds /cases/stats?caseType=
  // for full counts. Until then chips show labels only.
  // /review specialist fix (PR3 testing-maint, confidence 9).
  const chipOptions = useMemo(
    () =>
      TRANG_THAI_PHAN_HOI_CHIPS.map((c) => ({
        value: c.value,
        shortLabel: c.shortLabel,
        label: c.label,
        count: undefined,
      })),
    [],
  );

  const columns: ColumnDef<UyThacFromApi>[] = useMemo(
    () => [
      {
        key: 'caseCode',
        header: 'Mã hồ sơ',
        render: (r) => (
          <span className="font-mono text-xs text-blue-700">{r.caseCode ?? '—'}</span>
        ),
      },
      {
        key: 'ngayTiepNhan',
        header: 'Ngày tiếp nhận',
        render: (r) => (r.ngayTiepNhan ? formatVNDate(r.ngayTiepNhan) : '—'),
      },
      {
        key: 'donViGiao',
        header: 'Đơn vị giao',
        render: (r) => (
          <span className="font-medium text-slate-800">{r.donViGiao ?? '—'}</span>
        ),
      },
      {
        key: 'soQuyetDinhUyThac',
        header: 'Số QĐ/Phiếu',
        render: (r) => r.soQuyetDinhUyThac ?? '—',
      },
      {
        key: 'nghiVan',
        header: 'Đối tượng nghi vấn',
        render: (r) => {
          const nghiVan = getNghiVan(r);
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
        render: (r) => (
          <span className="block max-w-[140px] truncate" title={r.crime ?? undefined}>
            {r.crime ?? '—'}
          </span>
        ),
      },
      {
        key: 'investigator',
        header: 'Điều tra viên',
        render: (r) => getInvestigatorName(r.investigator),
      },
      {
        key: 'thoiHanUyThac',
        header: 'Thời hạn',
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
        render: (r) =>
          r.createdBy
            ? [r.createdBy.firstName, r.createdBy.lastName].filter(Boolean).join(' ') || '—'
            : '—',
      },
      {
        key: 'actions',
        header: 'Thao tác',
        render: (r) => (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/uy-thac-dieu-tra/${r.id}/edit`);
              }}
              className={`p-1 rounded hover:bg-slate-200 text-slate-500 ${A11Y_FOCUS_RING}`}
              title="Xem / Chỉnh sửa"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteTarget(r);
                setDeleteReason('');
                setDeleteError(null);
              }}
              className={`p-1 rounded hover:bg-red-100 text-red-500 hover:text-red-700 ${A11Y_FOCUS_RING}`}
              title="Xóa ủy thác"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ),
      },
    ],
    [navigate],
  );

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
    (donViGiao ? 1 : 0) +
    (ngayTiepNhanFrom ? 1 : 0) +
    (ngayTiepNhanTo ? 1 : 0) +
    (investigatorSearch ? 1 : 0) +
    (searchQuery ? 1 : 0);

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
        <ListPageShell.StatusChips
          options={chipOptions}
          activeValue={trangThai}
          onChange={handleStatusChange}
          totalCount={totalCount}
          countsLoading={tableState === 'loading'}
        />
        <ListPageShell.Toolbar
          searchValue={searchQuery}
          onSearchChange={handleSearchChange}
          searchPlaceholder="Tìm theo tên, đơn vị giao, số QĐ, đối tượng..."
          activeFilterCount={activeFilterCount}
          onResetFilters={handleResetFilters}
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
        <ListPageShell.Table<UyThacFromApi>
          state={tableState}
          columns={columns}
          data={rows}
          rowKey={(r) => r.id}
          title="Danh sách Ủy Thác Điều Tra"
          totalCount={totalCount}
          error={error}
          emptyState={{
            title: 'Chưa có ủy thác điều tra nào',
            description: 'Tạo ủy thác đầu tiên theo Điều 171 BLTTHS 2015.',
            actionLabel: 'Nhập ủy thác mới',
            onAction: () => navigate('/uy-thac-dieu-tra/new'),
          }}
          emptyFilteredState={{ onClearFilters: handleResetFilters }}
          getRowClassName={(r) =>
            computeTrangThai(r) === 'QUA_HAN' ? OVERDUE_ROW_HIGHLIGHT : ''
          }
        />
        <ListPageShell.Pagination
          page={page}
          totalPages={totalPages}
          totalCount={totalCount}
          onPageChange={handlePageChange}
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
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full text-sm border border-slate-300 rounded-md py-1.5 px-2 ${A11Y_FOCUS_RING}`}
      />
    </div>
  );
}
