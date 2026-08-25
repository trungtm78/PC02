/**
 * IncidentListPageShell — PR2/T4 ListPageShell consumer cho Incidents.
 *
 * Mirror canonical CaseListPageShell pattern:
 * - useListPageUrlState('incidents') cho status + page + search + phase
 * - GET /api/v1/incidents/stats fetch + merge với INCIDENT_STATUS_CHIPS
 * - Toolbar search 300ms debounce
 * - Table state machine + overdue highlight
 * - Pagination 20 rows/page
 * - Phase tabs render giữa Header + StatusChips (positional child trong compound API)
 *
 * KHÔNG thay thế production IncidentListPage directly — swap qua feature flag
 * trong PR3 sau khi soak. PR2 ships shell-consumers alongside legacy pages.
 */
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useListShortcuts } from '@/hooks/useListShortcuts';
import { ShortcutHint } from '@/components/ShortcutCheatSheet';
import { FileSearch, Plus, AlertCircle, X, Inbox, Search as SearchIcon, CheckCircle, PauseCircle } from 'lucide-react';
import axios from 'axios';
import { api } from '@/lib/api';
import {
  ListPageShell,
  useListPageUrlState,
  useListSort,
  DateCell,
  SummaryCell,
  formatHoSoCode,
  type ColumnDef,
  type TableState,
  ColumnPicker,
  useColumnVisibility,
} from '@/components/shared/ListPageShell';
import { useOfficerOptions } from '@/hooks/useOfficerOptions';
import { DateRangePresets } from '@/features/_shared/list-filters/DateRangePresets';
import { useBulkSelection } from '@/features/_shared/bulk/useBulkSelection';
import { BulkActionBar } from '@/features/_shared/bulk/BulkActionBar';
import { buildIncidentsAdapter } from '@/features/_shared/bulk/adapters/incidents';
import type { BulkAction, BulkResult } from '@/features/_shared/bulk/types';
import {
  INCIDENT_STATUS_CHIPS,
  INCIDENT_STATUS_LABEL,
  INCIDENT_STATUS_BADGE,
} from '@/shared/enums/status-labels';
import { IncidentStatus } from '@/shared/enums/generated';
import {
  BTN_PRIMARY,
  A11Y_FOCUS_RING,
  OVERDUE_ROW_HIGHLIGHT,
  TABLE_CELL_TRUNCATE,
} from '@/constants/styles';
import { StatsCardsStrip, type StatCard } from '@/components/shared/StatsCardsStrip';
import { getIncidentStatusIcon } from '@/shared/enums/status-icons';
import { formatVNDate } from '@/lib/dates';
// v0.64 PR2 — registry-driven row actions + advanced filters
import { RowActions } from '@/features/_shared/row-actions/RowActions';
import { Filters } from '@/features/_shared/list-filters/Filters';
import { useListFilters } from '@/features/_shared/list-filters/useListFilters';
import { useAssignModal } from '@/features/_shared/modals/AssignModalProvider';
import { useDeleteResourceModal } from '@/features/_shared/modals/DeleteResourceModalProvider';
import { nhanKyThongKe } from '@/constants/thongKeSettings';
import { useStatusTransitionModal } from '@/features/_shared/modals/StatusTransitionModalProvider';
import { useProsecuteModal } from '@/features/_shared/modals/ProsecuteModalProvider';
import { usePermission } from '@/hooks/usePermission';
import type { ActionContext } from '@/features/_shared/row-actions/registry';
import { incidentsRowActions } from '@/features/incidents/row-actions';
import { incidentsListFilters, type IncidentFilterValue } from '@/features/incidents/list-filters';
import { hoTen } from '@/lib/hoTen';

// Trust boundary — URL `?incidents_status=__proto__` must not land in lookups.
const INCIDENT_STATUS_VALUES = new Set<string>(Object.values(IncidentStatus));
function isValidIncidentStatus(value: string | null): value is IncidentStatus {
  return value != null && INCIDENT_STATUS_VALUES.has(value);
}

// Phase = grouping of statuses per BCA TT28/2020 4-stage workflow.
// Values MUST match backend PHASE_STATUSES keys at
// backend/src/incidents/incidents.constants.ts:4-17 (kebab-case lowercase).
// /codex review found that UPPER_SNAKE_CASE silently no-ops because backend
// looks up keys directly, never throws on miss.
const PHASE_VALUES = ['tiep-nhan', 'xac-minh', 'ket-qua', 'tam-dinh-chi'] as const;
type IncidentPhase = (typeof PHASE_VALUES)[number];
const PHASE_LABEL: Record<IncidentPhase, string> = {
  'tiep-nhan': 'Tiếp nhận',
  'xac-minh': 'Xác minh',
  'ket-qua': 'Kết quả',
  'tam-dinh-chi': 'Tạm đình chỉ',
};
const PHASE_VALUE_SET = new Set<string>(PHASE_VALUES);
function isValidPhase(value: string | null): value is IncidentPhase {
  return value != null && PHASE_VALUE_SET.has(value);
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
    return 'Không tải được danh sách vụ việc';
  }
  return 'Lỗi không xác định';
}

interface IncidentRow {
  id: string;
  code: string;
  name: string;
  status: IncidentStatus;
  deadline?: string | null;
  investigator?: { firstName?: string; lastName?: string; username: string } | null;
  donViGiaiQuyet?: string | null;
  ngayDeXuat?: string | null;
  createdAt: string;
  updatedAt?: string;
  // Các cột hệ cũ hiển thị trên danh sách (25/08/2026). `description` phủ 99,98% vụ việc.
  description?: string | null;
  ketQuaXuLy?: string | null;
  sttCu?: string | null;
  doiTuongCaNhan?: string | null;
  canBoNhap?: { id: string; firstName?: string | null; lastName?: string | null; username?: string } | null;
}

interface KyDaGiaiFE {
  ky: string;
  truong: string;
  tuNgay: string | null;
  denNgay: string | null;
}

interface IncidentsStatsResponse {
  total: number;
  byStatus: Record<IncidentStatus, number>;
  /** Số theo 4 giai đoạn BCA, do server đếm (PHASE_STATUSES). */
  byGroup: Record<string, number>;
  /** Kỳ MÁY CHỦ thật sự đã áp — nhãn hiện trên thanh thẻ lấy từ đây, không tự đoán. */
  ky?: KyDaGiaiFE;
}

const PAGE_SIZE = 20;

/**
 * Giá trị "đang lọc bằng thứ khác" cho `activeValue` của thanh thẻ.
 *
 * Khi user lọc bằng CHIP trạng thái (không phải thẻ), nhóm là null → thẻ "Tổng"
 * (filterValue null) sẽ tự sáng và bị khoá, dù danh sách ĐANG bị lọc. Vừa nói dối vừa
 * khiến user không bấm "Tổng" để xoá lọc được. Sentinel này không khớp thẻ nào nên không
 * thẻ nào sáng, và "Tổng" bấm được để xoá sạch.
 */
const OTHER_FILTER_ACTIVE = '__other__';


/**
 * 4 thẻ trạng thái của Vụ việc trùng KHÍT 4 giai đoạn BCA (`PHASE_STATUSES`), nên
 * `filterValue` dùng luôn khoá giai đoạn — không cần param lọc mới, tái dùng `phase`
 * mà backend đã có sẵn.
 */
function buildIncidentsCards(stats: IncidentsStatsResponse | null): StatCard[] {
  const g = stats?.byGroup;
  const at = (key: string) => (g ? (g[key] ?? 0) : null);
  return [
    { label: 'Tổng vụ việc', value: stats?.total ?? null, filterValue: null, icon: FileSearch, iconBgClass: 'bg-[#003973]/10', iconColorClass: 'text-[#003973]', valueColorClass: 'text-[#003973]' },
    { label: 'Tiếp nhận', value: at('tiep-nhan'), filterValue: 'tiep-nhan', icon: Inbox, iconBgClass: 'bg-blue-100', iconColorClass: 'text-blue-600', valueColorClass: 'text-blue-600' },
    { label: 'Xác minh', value: at('xac-minh'), filterValue: 'xac-minh', icon: SearchIcon, iconBgClass: 'bg-amber-100', iconColorClass: 'text-amber-600', valueColorClass: 'text-amber-600' },
    { label: 'Kết quả', value: at('ket-qua'), filterValue: 'ket-qua', icon: CheckCircle, iconBgClass: 'bg-green-100', iconColorClass: 'text-green-600', valueColorClass: 'text-green-600' },
    { label: 'Tạm đình chỉ', value: at('tam-dinh-chi'), filterValue: 'tam-dinh-chi', icon: PauseCircle, iconBgClass: 'bg-slate-100', iconColorClass: 'text-slate-600', valueColorClass: 'text-slate-600' },
  ];
}

function isOverdue(deadline?: string | null): boolean {
  if (!deadline) return false;
  return new Date(deadline) < new Date(new Date().setHours(0, 0, 0, 0));
}

export function IncidentListPageShell() {
  const navigate = useNavigate();
  const url = useListPageUrlState('incidents');
  const sort = useListSort('incidents');

  const rawStatus = url.getParam('status');
  const statusFilter = isValidIncidentStatus(rawStatus) ? rawStatus : null;
  const rawPhase = url.getParam('phase');
  const phaseFilter = isValidPhase(rawPhase) ? rawPhase : null;
  const page = Math.max(1, url.getNumberParam('page', 1));
  const searchQuery = url.getParam('q') ?? '';

  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  const [rows, setRows] = useState<IncidentRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState<IncidentsStatsResponse | null>(null);
  const [tableState, setTableState] = useState<TableState>('loading');
  const [refetchCounter, setRefetchCounter] = useState(0);
  useListShortcuts({ onNew: () => navigate('/vu-viec/new'), onRefresh: () => setRefetchCounter((n) => n + 1) });
  const [error, setError] = useState<string | undefined>();

  const abortRef = useRef<AbortController | null>(null);

  // v0.64 PR2 — Action context (perms + modal openers).
  // v0.67 PR1 PR2-bis — wire StatusTransition + Prosecute modals.
  const { canDispatch, canEdit, canDelete } = usePermission();
  const assignModal = useAssignModal();
  const deleteModal = useDeleteResourceModal();
  const statusTransitionModal = useStatusTransitionModal();
  const prosecuteModal = useProsecuteModal();
  const actionCtx: ActionContext = useMemo(
    () => ({
      navigate,
      perms: {
        canDispatch,
        canEdit: canEdit('incidents'),
        canDelete: canDelete('incidents'),
      },
      assignModal,
      deleteModal: {
        open: (args) =>
          deleteModal.open({
            ...args,
            onSuccess: () => {
              args.onSuccess?.();
              setRefetchCounter((n) => n + 1);
            },
          }),
      },
      statusTransition: {
        open: (args) =>
          statusTransitionModal.open({
            ...args,
            onSuccess: () => {
              args.onSuccess?.();
              setRefetchCounter((n) => n + 1);
            },
          }),
      },
      prosecute: {
        open: (args) =>
          prosecuteModal.open({
            ...args,
            onSuccess: (caseId) => {
              args.onSuccess?.(caseId);
              // Navigate sang Vụ án mới sau khi atomic transaction tạo Case.
              navigate(`/cases/${caseId}`);
            },
          }),
      },
    }),
    [
      navigate,
      canDispatch,
      canEdit,
      canDelete,
      assignModal,
      deleteModal,
      statusTransitionModal,
      prosecuteModal,
    ],
  );

  // v0.64 PR2 — Advanced filter state + URL sync.
  const listFilters = useListFilters<IncidentFilterValue>({
    prefix: 'incidents',
    registry: incidentsListFilters,
  });
  const appliedFilters = listFilters.applied;

  /**
   * Param dùng CHUNG cho cả request danh sách lẫn thống kê — một nguồn duy nhất thì số
   * trên thẻ không lệch khỏi danh sách được.
   *
   * Tên param phải KHỚP `QueryIncidentsDto`. Trước đây gửi `keyword`/`reporter`/`unit`
   * mà DTO không có → `forbidNonWhitelisted` trả 400, bộ lọc nâng cao GÃY hoàn toàn:
   *  - `keyword` đã gỡ khỏi registry vì trùng chức năng với ô tìm kiếm trên thanh công cụ
   *  - `reporter` nay tra theo CCCD/SĐT (schema không có cột TÊN người tố giác)
   *  - `unit` → `donViGiaiQuyet` (cột text đơn vị thụ lý)
   */

  const baseQueryParams = useMemo(
    () => ({
      ...(debouncedSearch && { search: debouncedSearch }),
      ...(appliedFilters.loaiDonVu && { loaiDonVu: appliedFilters.loaiDonVu }),
      ...(appliedFilters.reporter && { reporter: appliedFilters.reporter }),
      ...(appliedFilters.unit && { donViGiaiQuyet: appliedFilters.unit }),
      // Bộ lọc theo kiểu hệ cũ. Thiếu phần này thì thẻ lọc chỉ ghi vào địa chỉ trang
      // mà KHÔNG đi xuống API — người dùng thấy ô lọc đổi còn danh sách đứng yên.
      ...(appliedFilters.stt && { stt: appliedFilters.stt }),
      ...(appliedFilters.sttCu && { sttCu: appliedFilters.sttCu }),
      ...(appliedFilters.canBoNhapId && { canBoNhapId: appliedFilters.canBoNhapId }),
      ...(appliedFilters.fromDateRange && { fromDateRange: appliedFilters.fromDateRange }),
      ...(appliedFilters.toDateRange && { toDateRange: appliedFilters.toDateRange }),
      // Cán bộ đổi TẠM kỳ tính theo ngày nào; rỗng thì máy chủ dùng cấu hình hệ thống.
      ...(appliedFilters.thongKeTruongNgay && {
        thongKeTruongNgay: appliedFilters.thongKeTruongNgay,
      }),
    }),
    [debouncedSearch, appliedFilters],
  );
  const baseQueryKey = JSON.stringify(baseQueryParams);

  useEffect(() => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setTableState('loading');
    setError(undefined);

    const params = {
      ...baseQueryParams,
      ...(statusFilter && { status: statusFilter }),
      ...(phaseFilter && { phase: phaseFilter }),
      ...sort.params,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    };

    api
      .get<{ data: IncidentRow[]; total: number }>('/incidents', { params, signal: ctrl.signal })
      .then((listRes) => {
        if (ctrl.signal.aborted) return;
        setRows(listRes.data.data);
        setTotalCount(listRes.data.total);
        if (listRes.data.total === 0) {
          setTableState(debouncedSearch || statusFilter || phaseFilter ? 'empty-filtered' : 'empty');
        } else {
          setTableState('ready');
        }
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted || axios.isCancel(e)) return;
        setError(getVietnameseErrorMessage(e));
        setTableState('error');
      });

    return () => ctrl.abort();
    // refetchCounter forces refetch after bulk action success (declared below for hoisting OK at runtime)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, phaseFilter, page, debouncedSearch, refetchCounter, appliedFilters, sort.sortBy, sort.sortOrder]);

  // Stats fetch: search + phase pass-through, status purposely stripped.
  useEffect(() => {
    const ctrl = new AbortController();
    // KHÔNG gửi `phase`: thẻ phải đếm toàn bộ, nếu lọc theo giai đoạn đang chọn thì 3 thẻ
    // kia về 0 và hết chỗ bấm sang. Backend cũng đã chặn `phase` ở DTO stats.
    // Nhưng PHẢI gửi các bộ lọc còn lại, nếu không số trên thẻ lệch khỏi danh sách.
    const statsParams = baseQueryParams;
    api
      .get<IncidentsStatsResponse>('/incidents/stats', { params: statsParams, signal: ctrl.signal })
      .then((statsRes) => {
        if (ctrl.signal.aborted) return;
        setStats(statsRes.data);
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted || axios.isCancel(e)) return;
        // Non-blocking: chips chỉ ẩn counts khi stats fail.
      });

    return () => ctrl.abort();
    // KHÔNG phụ thuộc phaseFilter → bấm thẻ không refetch stats (tránh nháy khung xương).
    // Khoá theo GIÁ TRỊ (`baseQueryKey`) vì `appliedFilters` đổi identity mỗi lần URL đổi.
    // `refetchCounter`: xoá/đổi trạng thái hàng loạt cũng phải cập nhật lại số trên thẻ.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseQueryKey, refetchCounter]);

  const chipOptions = useMemo(
    () =>
      INCIDENT_STATUS_CHIPS.map((c) => ({
        value: c.value,
        shortLabel: c.shortLabel,
        label: c.label,
        count: stats?.byStatus[c.value],
      })),
    [stats],
  );

  // /investigate v0.61 fix Bug 2 — bulk integration mirror Cases pattern.
  const selection = useBulkSelection<IncidentRow>({
    rowKey: 'id',
    pageRows: rows,
    totalCountMatchingFilter: totalCount,
  });
  const adapter = useMemo(() => buildIncidentsAdapter({ enableDelete: true }), []);
  const selectionClearRef = useRef(selection.clear);
  selectionClearRef.current = selection.clear;
  useEffect(() => {
    selectionClearRef.current();
  }, [statusFilter, phaseFilter, page, debouncedSearch]);
  const [transientBanner, setTransientBanner] = useState<{
    kind: 'success' | 'error';
    text: string;
  } | null>(null);
  const handleBulkSuccess = useCallback(
    (result: BulkResult | void, action: BulkAction<IncidentRow>) => {
      if (action.key === 'export') {
        setTransientBanner({ kind: 'success', text: 'Đã xuất Excel' });
        return;
      }
      if (result && typeof result === 'object') {
        const { succeeded, skipped, failed } = result;
        const parts: string[] = [];
        if (succeeded?.length) parts.push(`Đã xử lý ${succeeded.length} vụ việc`);
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
    (err: unknown, action: BulkAction<IncidentRow>) => {
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

  const columns: ColumnDef<IncidentRow>[] = useMemo(
    () => [
      // BỀ RỘNG CỘT LẤY TỪ SỐ ĐO DỮ LIỆU THẬT (bản chạy thật, 25/08/2026) — không đoán.
      //   Tóm tắt nội dung  855 / 1776  → 30rem, cột rộng nhất
      //   Kết quả xử lý                 → 16rem
      //   Tên cá nhân…      855 / 1776  → 14rem  ← xem cảnh báo dưới
      //
      // CẢNH BÁO DỮ LIỆU: 4.598/4.716 vụ việc (97,5%) có ô "Tên" TRÙNG Y HỆT ô "Tóm tắt" —
      // di trú hệ cũ đổ mô tả vào cả hai cột. Vì vậy bề rộng cột Tên đặt theo NGHĨA của nó
      // (tên người / cơ quan) chứ không theo độ dài đang có; đặt theo độ dài đang có là hợp
      // thức hoá một lỗi dữ liệu và tốn thêm 30rem để hiện lại đúng thứ cột bên cạnh đã hiện.
      // Thao tác là cột ĐẦU, ngay sau ô tick — CỐ Ý KHÁC hệ cũ (hệ cũ để cuối).
      // Bảng này rộng nên phải cuộn ngang; để Thao tác ở cuối thì mỗi lần muốn bấm là cuộn
      // sang phải rồi cuộn ngược về. Anh quyết định 25/08/2026, ưu tiên thao tác nhanh.
      // Ghim ở mép trái khi cuộn ngang. Không ghim thì cột này trôi mất ngay khi cuộn, và
      // việc đưa nó lên đầu hôm qua thành vô nghĩa.
      {
        key: 'actions',
        header: 'Thao tác',
        width: '7rem',
        sticky: true,
        render: (r) => (
          <RowActions
            registry={incidentsRowActions}
            row={{
              id: r.id,
              status: r.status as unknown as string,
              name: r.name,
              updatedAt: r.updatedAt,
            }}
            ctx={actionCtx}
          />
        ),
      },
      // Các cột nội dung giữ NGUYÊN thứ tự hệ cũ — chỉ riêng Thao tác đứng trước chúng.

      {
        key: 'code',
        header: 'STT',
        width: '6rem',
        render: (r) => (
          // Hệ cũ hiện `26-9706`; dữ liệu trong CSDL vẫn là `2026-9706`, không đổi.
          <span className="font-mono text-xs text-slate-700">{formatHoSoCode(r.code)}</span>
        ),
      },

      {
        key: 'ngayDeXuat',
        header: 'Ngày đề xuất',
        width: '7rem',
        optional: 'show',
        sortKey: 'ngayDeXuat',
        render: (r) => <DateCell value={r.ngayDeXuat} />,
      },

      {
        key: 'name',
        header: 'Tên cá nhân, cơ quan, tổ chức cung cấp, bị hại',
        width: '11rem',
        optional: 'show',
        cellClassName: TABLE_CELL_TRUNCATE,
        render: (r) => <span className="font-medium text-slate-800">{r.doiTuongCaNhan || r.name}</span>,
      },

      {
        key: 'description',
        header: 'Tóm tắt nội dung',
        width: '22rem',
        optional: 'show',
        render: (r) => <SummaryCell value={r.description} />,
      },

      {
        key: 'donViGiaiQuyet',
        header: 'Đơn vị giải quyết',
        width: '10rem',
        optional: 'show',
        cellClassName: TABLE_CELL_TRUNCATE,
        render: (r) => r.donViGiaiQuyet ?? '—',
      },

      {
        key: 'ketQuaXuLy',
        header: 'Kết quả xử lý, giải quyết khác',
        width: '11rem',
        optional: 'show',
        cellClassName: TABLE_CELL_TRUNCATE,
        render: (r) => r.ketQuaXuLy ?? '—',
      },

      {
        key: 'canBoNhap',
        header: 'Người nhập',
        width: '8rem',
        optional: 'show',
        render: (r) =>
          r.canBoNhap
            ? `${r.canBoNhap.lastName ?? ''} ${r.canBoNhap.firstName ?? ''}`.trim() ||
              (r.canBoNhap.username ?? '—')
            : '—',
      },

      {
        key: 'status',
        header: 'Trạng thái',
        width: '9rem',
        optional: 'show',
        render: (r) => (
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium ${INCIDENT_STATUS_BADGE[r.status]}`}>
            {getIncidentStatusIcon(r.status)}
            {INCIDENT_STATUS_LABEL[r.status]}
          </span>
        ),
      },

      {
        key: 'investigator',
        header: 'Điều tra viên',
        width: '10rem',
        optional: 'hide',
        cellClassName: TABLE_CELL_TRUNCATE,
        render: (r) => {
          if (!r.investigator) return '—';
          const name = hoTen(r.investigator);
          return name || r.investigator.username;
        },
      },

      {
        key: 'deadline',
        header: 'Hạn xử lý',
        width: '8rem',
        optional: 'hide',
        sortKey: 'deadline',
        render: (r) => {
          if (!r.deadline) return '—';
          const overdue = isOverdue(r.deadline);
          return (
            <span className={overdue ? 'text-red-700 font-semibold' : 'text-slate-700'}>
              {formatVNDate(r.deadline)}
            </span>
          );
        },
      },

      {
        key: 'createdAt',
        header: 'Ngày tạo',
        width: '7rem',
        optional: 'hide',
        sortKey: 'createdAt',
        render: (r) => formatVNDate(r.createdAt),
      },
    ],
    [actionCtx],
  );

  // Chọn cột hiển thị kiểu treeview Odoo. Cột nào vào menu và tích sẵn hay không là do
  // `optional` khai ngay trên từng cột ở khối trên, không phải một danh sách riêng ở đây.
  const { visibleColumns, toggleableColumns, isVisible, toggle, reset: resetColumns } =
    useColumnVisibility('incidents', columns);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const handleStatusChange = useCallback(
    (value: string | null) => {
      // Chip và thẻ/tab giai đoạn loại trừ nhau. Backend cho `phase` thắng `status`, nên
      // để cả hai cùng bật thì chip sáng mà danh sách không lọc theo nó — giao diện nói dối.
      url.setParams({ status: value, phase: null, page: '1' });
    },
    [url],
  );

  const handlePhaseChange = useCallback(
    (value: IncidentPhase | null) => {
      // history push để nút Back quay lại được giai đoạn trước (thẻ thống kê cũng gọi hàm này).
      url.setParams({ phase: value, status: null, page: '1' }, { history: 'push' });
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


  // Danh sách cán bộ cho ô "Cán bộ nhập" — nạp lúc chạy nên truyền qua `dynamicOptions`
  // của mặt lọc chung, không khai cứng được trong registry.
  const { data: officerOptions } = useOfficerOptions();

  const handleResetFilters = useCallback(() => {
    url.clearAll();
    listFilters.reset();
  }, [url, listFilters]);

  const appliedFilterCount = Object.values(appliedFilters).filter((v) => v && v !== '').length;
  const activeFilterCount =
    (statusFilter ? 1 : 0) +
    (phaseFilter ? 1 : 0) +
    (searchQuery ? 1 : 0) +
    appliedFilterCount;

  return (
    <ListPageShell>
      <ListPageShell.Header
        icon={FileSearch}
        title="Danh sách vụ việc"
        subtitle="Nguồn tin tội phạm (Đ.144 BLTTHS) — tiếp nhận, xác minh, kết quả"
        actions={
          <button
            type="button"
            onClick={() => navigate('/incidents/new')}
            className={`${BTN_PRIMARY} ${A11Y_FOCUS_RING} flex items-center gap-2`}
          >
            <Plus className="w-4 h-4" />
            <span>Tạo mới</span>
            <ShortcutHint action="newRecord" className="ml-1" />
          </button>
        }
      />
      <StatsCardsStrip
        cards={buildIncidentsCards(stats)}
        loading={stats == null}
        periodLabel={stats?.ky ? nhanKyThongKe(stats.ky.ky, stats.ky.tuNgay, stats.ky.denNgay) : null}
        activeValue={phaseFilter ?? (statusFilter ? OTHER_FILTER_ACTIVE : null)}
        onCardSelect={(v) => handlePhaseChange(v as IncidentPhase | null)}
      />
      {/* Phase tabs render giữa Header + StatusChips theo plan PR2 compound API */}
      <div
        role="tablist"
        aria-label="Giai đoạn xử lý"
        className="flex items-center gap-2 px-4 py-2 bg-slate-50 border-b border-slate-200 overflow-x-auto"
      >
        <button
          type="button"
          role="tab"
          aria-selected={phaseFilter === null}
          onClick={() => handlePhaseChange(null)}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${A11Y_FOCUS_RING} ${
            phaseFilter === null
              ? 'bg-blue-600 text-white'
              : 'bg-white text-slate-700 hover:bg-slate-100'
          }`}
        >
          Tất cả giai đoạn
        </button>
        {PHASE_VALUES.map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={phaseFilter === p}
            onClick={() => handlePhaseChange(p)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${A11Y_FOCUS_RING} ${
              phaseFilter === p
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            {PHASE_LABEL[p]}
          </button>
        ))}
      </div>
      <ListPageShell.StatusChips
        options={chipOptions}
        activeValue={statusFilter}
        onChange={handleStatusChange}
        totalCount={stats?.total}
        countsLoading={stats == null}
        groupActive={phaseFilter != null}
      />
      <ListPageShell.Toolbar
        searchValue={searchQuery}
        onSearchChange={handleSearchChange}
        searchPlaceholder="Tìm kiếm theo mã, tên, đối tượng..."
        activeFilterCount={activeFilterCount}
        onResetFilters={handleResetFilters}
        cardStyle
        columnPicker={
          <ColumnPicker
            columns={toggleableColumns}
            isVisible={isVisible}
            onToggle={toggle}
            onReset={resetColumns}
          />
        }
      >
        <Filters<IncidentFilterValue>
          registry={incidentsListFilters}
          value={listFilters.draft}
          onChange={listFilters.setField}
          onApply={listFilters.apply}
          onReset={listFilters.reset}
          hasUnappliedChanges={listFilters.hasUnappliedChanges}
          dynamicOptions={{
            canBoNhapId: [{ value: '', label: 'Tất cả' }, ...(officerOptions ?? [])],
          }}
        >
          <DateRangePresets
            onPick={(khoang) => {
              // Ghi vào ĐÚNG hai ô ngày của mặt lọc này — không tạo trạng thái thứ hai.
              listFilters.setField('fromDateRange', khoang.fromDate);
              listFilters.setField('toDateRange', khoang.toDate);
            }}
          />
        </Filters>
      </ListPageShell.Toolbar>
      {transientBanner && (
        <div
          data-testid="incidents-bulk-banner"
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
      <ListPageShell.Table<IncidentRow>
        // Bố cục cột CỐ ĐỊNH: bề rộng dưới đây do dữ liệu thật quyết, không do chuỗi dài
        // nhất trong cột quyết. Xem chú thích ở khối `columns`.
        fixedLayout
        sortBy={sort.sortBy}
        sortOrder={sort.sortOrder}
        onSort={sort.onSort}
        state={tableState}
        columns={visibleColumns}
        data={rows}
        rowKey={(r) => r.id}
        title="Danh sách vụ việc"
        sectionTitle="Danh sách vụ việc"
        totalCount={totalCount}
        error={error}
        emptyState={{
          title: 'Chưa có vụ việc nào',
          description: 'Tạo vụ việc đầu tiên để bắt đầu xác minh nguồn tin.',
          actionLabel: 'Tạo vụ việc mới',
          onAction: () => navigate('/incidents/new'),
        }}
        emptyFilteredState={{ onClearFilters: handleResetFilters }}
        onRowClick={(r) => navigate(`/incidents/${r.id}`)}
        getRowClassName={(r) => (isOverdue(r.deadline) ? OVERDUE_ROW_HIGHLIGHT : '')}
        bulkSelection={selection}
        bulkRowsLabel="vụ việc"
        bulkRowLabel={(r) => `vụ việc ${r.code}`}
      />
      <ListPageShell.Pagination
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        onPageChange={handlePageChange}
      />
      <BulkActionBar
        selection={selection}
        adapter={adapter}
        pageRows={rows}
        onSuccess={handleBulkSuccess}
        onError={handleBulkError}
      />
    </ListPageShell>
  );
}

export default IncidentListPageShell;
