/**
 * PetitionListPageShell — PR2/T5 ListPageShell consumer cho Petitions.
 *
 * Mirror canonical CaseListPageShell + IncidentListPageShell pattern:
 * - useListPageUrlState('petitions') — status + page + search
 * - GET /api/v1/petitions/stats fetch + merge với PETITION_STATUS_CHIPS
 * - Toolbar search 300ms debounce
 * - Table state machine + overdue highlight (deadline < today)
 * - Pagination 20 rows/page
 *
 * Petition không có phase tabs (đơn giản hơn Incident — single workflow).
 *
 * v0.56: ĐÃ thay thế production PetitionListPage (route /petitions trỏ vào Shell này).
 */
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useListShortcuts } from '@/hooks/useListShortcuts';
import { ShortcutHint } from '@/components/ShortcutCheatSheet';
import { Mail, Plus, AlertCircle, X, Inbox, RefreshCw, CheckCircle, Archive } from 'lucide-react';
import axios from 'axios';
import { api } from '@/lib/api';
import {
  ListPageShell,
  useListPageUrlState,
  useListSort,
  DateCell,
  SummaryCell,
  LegacyFilterPanel,
  formatHoSoCode,
  type ColumnDef,
  type TableState,
  type LegacyFilterField,
} from '@/components/shared/ListPageShell';
import { useOfficerOptions } from '@/hooks/useOfficerOptions';
import { useBulkSelection } from '@/features/_shared/bulk/useBulkSelection';
import { BulkActionBar } from '@/features/_shared/bulk/BulkActionBar';
import { buildPetitionsAdapter } from '@/features/_shared/bulk/adapters/petitions';
import { BatchExportDocumentsModal } from '@/features/document-templates/components/BatchExportDocumentsModal';
import { resolveFilename, parseBlobError } from '@/features/document-templates/export.api';
import { extractApiError } from '@/lib/api-errors';
import type { BulkAction, BulkResult } from '@/features/_shared/bulk/types';
import {
  PETITION_STATUS_CHIPS,
  PETITION_STATUS_LABEL,
  PETITION_STATUS_BADGE,
} from '@/shared/enums/status-labels';
import { PetitionStatus } from '@/shared/enums/generated';
import { BTN_PRIMARY, A11Y_FOCUS_RING, OVERDUE_ROW_HIGHLIGHT } from '@/constants/styles';
import { StatsCardsStrip, type StatCard } from '@/components/shared/StatsCardsStrip';
import { getPetitionStatusIcon } from '@/shared/enums/status-icons';
import { formatVNDate } from '@/lib/dates';
// v0.65 PR3 — registry-driven row actions + advanced filters
import { RowActions } from '@/features/_shared/row-actions/RowActions';
import { Filters } from '@/features/_shared/list-filters/Filters';
import { useListFilters } from '@/features/_shared/list-filters/useListFilters';
import { useAssignModal } from '@/features/_shared/modals/AssignModalProvider';
import { useDeleteResourceModal } from '@/features/_shared/modals/DeleteResourceModalProvider';
import { usePermission } from '@/hooks/usePermission';
import type { ActionContext } from '@/features/_shared/row-actions/registry';
import { petitionsRowActions } from '@/features/petitions/row-actions';
import { petitionsListFilters, type PetitionFilterValue } from '@/features/petitions/list-filters';

const PETITION_STATUS_VALUES = new Set<string>(Object.values(PetitionStatus));
function isValidPetitionStatus(value: string | null): value is PetitionStatus {
  return value != null && PETITION_STATUS_VALUES.has(value);
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
    return 'Không tải được danh sách đơn thư';
  }
  return 'Lỗi không xác định';
}

interface PetitionRow {
  id: string;
  stt: string;
  receivedDate: string;
  unit?: string | null;
  senderName: string;
  suspectedPerson?: string | null;
  status: PetitionStatus;
  deadline?: string | null;
  createdAt: string;
  updatedAt?: string; // optimistic-lock cho assign action
  // Các cột hệ cũ hiển thị trên danh sách (25/08/2026). `summary` phủ 99,99% đơn thư.
  summary?: string | null;
  nguonDon?: string | null;
  ketQuaXuLyKhac?: string | null;
  sttCu?: string | null;
  enteredBy?: { id: string; firstName?: string | null; lastName?: string | null; username?: string } | null;
}

interface PetitionsStatsResponse {
  total: number;
  byStatus: Record<PetitionStatus, number>;
  /** Số theo NHÓM trạng thái, do server đếm (PETITION_STATUS_GROUPS). */
  byGroup: Record<string, number>;
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
 * Số trên thẻ lấy thẳng từ `stats.byGroup` do server đếm — KHÔNG cộng tay ở đây nữa.
 * Server đếm từ cùng một `where` với danh sách nên bấm thẻ ra đúng số dòng như thẻ hiển
 * thị. Cộng ở client thì frontend phải nắm nhóm gồm trạng thái nào (trùng lặp) và số dễ
 * lệch khỏi danh sách.
 *
 * `filterValue` = khoá nhóm ở backend (`PETITION_STATUS_GROUPS`). Thẻ "Tổng" mang `null`.
 */
function buildPetitionsCards(stats: PetitionsStatsResponse | null): StatCard[] {
  const g = stats?.byGroup;
  const at = (key: string) => (g ? (g[key] ?? 0) : null);
  return [
    { label: 'Tổng đơn thư', value: stats?.total ?? null, filterValue: null, icon: Mail, iconBgClass: 'bg-[#003973]/10', iconColorClass: 'text-[#003973]', valueColorClass: 'text-[#003973]' },
    { label: 'Mới tiếp nhận', value: at('moi-tiep-nhan'), filterValue: 'moi-tiep-nhan', icon: Inbox, iconBgClass: 'bg-blue-100', iconColorClass: 'text-blue-600', valueColorClass: 'text-blue-600' },
    { label: 'Đang xử lý', value: at('dang-xu-ly'), filterValue: 'dang-xu-ly', icon: RefreshCw, iconBgClass: 'bg-amber-100', iconColorClass: 'text-amber-600', valueColorClass: 'text-amber-600' },
    { label: 'Đã giải quyết', value: at('da-giai-quyet'), filterValue: 'da-giai-quyet', icon: CheckCircle, iconBgClass: 'bg-green-100', iconColorClass: 'text-green-600', valueColorClass: 'text-green-600' },
    { label: 'Lưu đơn', value: at('da-luu-don'), filterValue: 'da-luu-don', icon: Archive, iconBgClass: 'bg-slate-100', iconColorClass: 'text-slate-600', valueColorClass: 'text-slate-600' },
  ];
}

function isOverdue(deadline?: string | null): boolean {
  if (!deadline) return false;
  return new Date(deadline) < new Date(new Date().setHours(0, 0, 0, 0));
}

export function PetitionListPageShell() {
  const navigate = useNavigate();
  const url = useListPageUrlState('petitions');
  const sort = useListSort('petitions');

  const rawStatus = url.getParam('status');
  const statusFilter = isValidPetitionStatus(rawStatus) ? rawStatus : null;
  // Nhóm trạng thái do bấm thẻ thống kê. Backend validate bằng @IsIn nên key rác → 400;
  // ở đây chỉ cần đọc nguyên văn.
  const groupFilter = url.getParam('statusGroup');
  const page = Math.max(1, url.getNumberParam('page', 1));
  const searchQuery = url.getParam('q') ?? '';

  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  const [rows, setRows] = useState<PetitionRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState<PetitionsStatsResponse | null>(null);
  const [tableState, setTableState] = useState<TableState>('loading');
  const [error, setError] = useState<string | undefined>();
  const [refetchCounter, setRefetchCounter] = useState(0);
  useListShortcuts({ onNew: () => navigate('/petitions/new'), onRefresh: () => setRefetchCounter((n) => n + 1) });
  const [transientBanner, setTransientBanner] = useState<{
    kind: 'success' | 'error';
    text: string;
  } | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  // v0.65 PR3 — Action context + advanced filter state.
  const { canDispatch, canEdit, canDelete } = usePermission();
  const assignModal = useAssignModal();
  const deleteModal = useDeleteResourceModal();
  const actionCtx: ActionContext = useMemo(
    () => ({
      navigate,
      perms: {
        canDispatch,
        canEdit: canEdit('petitions'),
        canDelete: canDelete('petitions'),
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
    }),
    [navigate, canDispatch, canEdit, canDelete, assignModal, deleteModal],
  );
  const listFilters = useListFilters<PetitionFilterValue>({
    prefix: 'petitions',
    registry: petitionsListFilters,
  });
  const appliedFilters = listFilters.applied;

  /**
   * Param dùng CHUNG cho cả request danh sách lẫn request thống kê.
   *
   * Trước đây hai chỗ dựng hai object riêng và stats chỉ có `search` → bật bộ lọc nâng cao
   * là số trên thẻ không còn khớp danh sách. Một nguồn duy nhất thì không lệch lại được.
   *
   * Tên param phải KHỚP `QueryPetitionsDto`: `senderName` (không phải `sender`). Backend
   * bật `forbidNonWhitelisted` nên gửi sai tên là 400 — đây chính là lỗi đang tồn tại.
   */
  const baseQueryParams = useMemo(
    () => ({
      ...(debouncedSearch && { search: debouncedSearch }),
      ...(appliedFilters.fromDate && { fromDate: appliedFilters.fromDate }),
      ...(appliedFilters.toDate && { toDate: appliedFilters.toDate }),
      ...(appliedFilters.sender && { senderName: appliedFilters.sender }),
      ...(appliedFilters.unit && { unit: appliedFilters.unit }),
    }),
    [debouncedSearch, appliedFilters],
  );

  /**
   * Khoá deps theo GIÁ TRỊ: `appliedFilters` đổi identity mỗi lần URL đổi, dùng thẳng
   * object sẽ khiến stats refetch mỗi lần bấm thẻ.
   */
  const baseQueryKey = JSON.stringify(baseQueryParams);

  const handleCardSelect = useCallback(
    (value: string | null) => {
      // Thẻ và chip loại trừ nhau: chọn nhóm thì bỏ status đơn lẻ.
      // `history:'push'` để nút Back quay lại được bộ lọc trước.
      url.setParams(
        { statusGroup: value, status: null, page: '1' },
        { history: 'push' },
      );
    },
    [url],
  );

  useEffect(() => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setTableState('loading');
    setError(undefined);

    const params = {
      ...baseQueryParams,
      ...(statusFilter && { status: statusFilter }),
      ...(groupFilter && { statusGroup: groupFilter }),
      ...sort.params,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    };

    api
      .get<{ data: PetitionRow[]; total: number }>('/petitions', { params, signal: ctrl.signal })
      .then((listRes) => {
        if (ctrl.signal.aborted) return;
        setRows(listRes.data.data);
        setTotalCount(listRes.data.total);
        if (listRes.data.total === 0) {
          setTableState(
            debouncedSearch || statusFilter || groupFilter ? 'empty-filtered' : 'empty',
          );
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, groupFilter, page, debouncedSearch, refetchCounter, appliedFilters, sort.sortBy, sort.sortOrder]);

  useEffect(() => {
    const ctrl = new AbortController();
    // Stats dùng CHUNG baseQueryParams với danh sách (trừ status/statusGroup do backend
    // strip): trước đây chỉ truyền `search`, nên bật lọc ngày là thẻ hiện một đằng danh
    // sách một nẻo. KHÔNG phụ thuộc groupFilter → bấm thẻ không refetch stats.
    const statsParams = baseQueryParams;
    api
      .get<PetitionsStatsResponse>('/petitions/stats', { params: statsParams, signal: ctrl.signal })
      .then((statsRes) => {
        if (ctrl.signal.aborted) return;
        setStats(statsRes.data);
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted || axios.isCancel(e)) return;
      });

    return () => ctrl.abort();
    // refetchCounter cần có: xoá/đổi trạng thái hàng loạt mà chỉ refetch danh sách thì
    // thẻ giữ số cũ → lệch với danh sách.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseQueryKey, refetchCounter]);

  const chipOptions = useMemo(
    () =>
      PETITION_STATUS_CHIPS.map((c) => ({
        value: c.value,
        shortLabel: c.shortLabel,
        label: c.label,
        count: stats?.byStatus[c.value],
      })),
    [stats],
  );

  // /investigate v0.61 Bug 2 — bulk integration.
  const selection = useBulkSelection<PetitionRow>({
    rowKey: 'id',
    pageRows: rows,
    totalCountMatchingFilter: totalCount,
  });
  // Ids được CHỤP tại đây: thanh bulk gọi selection.clear() ngay sau khi action chạy.
  const [wordExportIds, setWordExportIds] = useState<string[] | null>(null);
  const adapter = useMemo(
    () => buildPetitionsAdapter({ enableDelete: true, onExportWord: setWordExportIds }),
    [],
  );
  const selectionClearRef = useRef(selection.clear);
  selectionClearRef.current = selection.clear;
  useEffect(() => {
    // Đổi bộ lọc → bỏ chọn, tránh thao tác hàng loạt lên các dòng không còn hiển thị.
    selectionClearRef.current();
  }, [statusFilter, groupFilter, page, debouncedSearch]);
  const handleBulkSuccess = useCallback(
    (result: BulkResult | void, action: BulkAction<PetitionRow>) => {
      if (action.key === 'export') {
        setTransientBanner({ kind: 'success', text: 'Đã xuất Excel' });
        return;
      }
      // "Xuất Word" chỉ chụp ids rồi mở modal chọn mẫu — banner do handleBatchExportWord đặt
      // sau khi thực sự tải xong, không báo "thành công" ở đây.
      if (action.key === 'export-word') return;
      if (result && typeof result === 'object') {
        const { succeeded, skipped, failed } = result;
        const parts: string[] = [];
        if (succeeded?.length) parts.push(`Đã xử lý ${succeeded.length} đơn thư`);
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
    (err: unknown, action: BulkAction<PetitionRow>) => {
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

  const columns: ColumnDef<PetitionRow>[] = useMemo(
    () => [
      // Thứ tự cột theo hệ cũ: STT → Ngày → Nguồn đơn → Tên người → Tóm tắt → Đơn vị →
      // Kết quả → Người nhập → Thao tác (CUỐI). Hệ mới trước đây để Thao tác ở ĐẦU.
      {
        key: 'stt',
        header: 'STT',
        render: (r) => (
          // Hệ cũ hiện `26-11171`; dữ liệu trong CSDL vẫn là `2026-11171`, không đổi.
          <span className="font-mono text-xs text-slate-700">{formatHoSoCode(r.stt)}</span>
        ),
      },
      {
        key: 'nguonDon',
        header: 'Nguồn đơn/Đơn vị giao',
        render: (r) => r.nguonDon ?? '—',
      },
      {
        key: 'senderName',
        header: 'Tên cá nhân, cơ quan, tổ chức cung cấp, bị hại',
        render: (r) => <span className="font-medium text-slate-800">{r.senderName}</span>,
      },
      {
        key: 'summary',
        header: 'Tóm tắt nội dung',
        render: (r) => <SummaryCell value={r.summary} />,
      },
      {
        key: 'suspectedPerson',
        header: 'Đối tượng bị tố',
        render: (r) => r.suspectedPerson ?? '—',
      },
      {
        key: 'unit',
        header: 'Đơn vị giải quyết',
        render: (r) => r.unit ?? '—',
      },
      {
        key: 'ketQuaXuLyKhac',
        header: 'Kết quả xử lý, giải quyết khác',
        render: (r) => r.ketQuaXuLyKhac ?? '—',
      },
      {
        key: 'enteredBy',
        header: 'Người nhập',
        render: (r) =>
          r.enteredBy
            ? `${r.enteredBy.lastName ?? ''} ${r.enteredBy.firstName ?? ''}`.trim() ||
              (r.enteredBy.username ?? '—')
            : '—',
      },
      {
        key: 'status',
        header: 'Trạng thái',
        render: (r) => (
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium ${PETITION_STATUS_BADGE[r.status]}`}>
            {getPetitionStatusIcon(r.status)}
            {PETITION_STATUS_LABEL[r.status]}
          </span>
        ),
      },
      {
        key: 'receivedDate',
        header: 'Ngày nhận',
        sortKey: 'receivedDate',
        render: (r) => <DateCell value={r.receivedDate} />,
      },
      {
        key: 'deadline',
        header: 'Hạn xử lý',
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
        sortKey: 'createdAt',
        // Hồ sơ di trú đều mang cùng một ngày tạo (ngày chuyển dữ liệu) — chú giải để
        // cán bộ không tưởng là lỗi hiển thị.
        render: (r) => (
          <span title="Ngày nhập vào hệ thống. Hồ sơ di trú đều là ngày chuyển dữ liệu.">
            {formatVNDate(r.createdAt)}
          </span>
        ),
      },
      // Thao tác ở CUỐI như hệ cũ — cán bộ quen quét mắt từ trái sang rồi mới bấm.
      {
        key: 'actions',
        header: 'Thao tác',
        width: '8rem',
        render: (r) => (
          <RowActions
            registry={petitionsRowActions}
            row={{
              id: r.id,
              status: r.status as unknown as string,
              stt: r.stt,
              updatedAt: r.updatedAt,
            }}
            ctx={actionCtx}
          />
        ),
      },
    ],
    [actionCtx],
  );

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const handleStatusChange = useCallback(
    (value: string | null) => {
      // Chip và thẻ loại trừ nhau — chọn trạng thái đơn lẻ thì bỏ nhóm đang lọc.
      url.setParams({ status: value, statusGroup: null, page: '1' });
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

  // ── Thẻ lọc theo kiểu hệ cũ ───────────────────────────────────────────────
  // Giá trị đọc/ghi thẳng vào địa chỉ trang như mọi bộ lọc khác, nên tải lại trang hay gửi
  // đường dẫn cho đồng nghiệp đều giữ nguyên bộ lọc.
  const { data: officerOptions } = useOfficerOptions();

  const legacyFilterFields: LegacyFilterField[] = useMemo(
    () => [
      {
        key: 'enteredById',
        label: 'Cán bộ nhập',
        type: 'select',
        side: 'left',
        options: [{ value: '', label: 'Tất cả' }, ...(officerOptions ?? [])],
      },
      { key: 'stt', label: 'STT', type: 'text', placeholder: 'vd 26-11171', side: 'right' },
      { key: 'sttCu', label: 'STT cũ', type: 'text', side: 'right' },
      { key: 'fromDate', label: 'Từ ngày', type: 'date', side: 'right' },
      { key: 'toDate', label: 'Đến ngày', type: 'date', side: 'right' },
    ],
    [officerOptions],
  );

  const legacyFilterValues = useMemo(
    () => ({
      enteredById: url.getParam('enteredById') ?? '',
      stt: url.getParam('stt') ?? '',
      sttCu: url.getParam('sttCu') ?? '',
      fromDate: url.getParam('fromDate') ?? '',
      toDate: url.getParam('toDate') ?? '',
    }),
    [url],
  );

  const handleLegacyFilterChange = useCallback(
    (updates: Record<string, string>) => {
      // Đổi bộ lọc thì về trang 1 — giữ nguyên trang cũ sẽ ra bảng trống mà không rõ vì sao.
      url.setParams({ ...updates, page: '1' });
    },
    [url],
  );

  const handleResetFilters = useCallback(() => {
    url.clearAll();
    listFilters.reset();
  }, [url, listFilters]);

  const appliedFilterCount = Object.values(appliedFilters).filter((v) => v && v !== '').length;
  const activeFilterCount =
    (statusFilter ? 1 : 0) + (groupFilter ? 1 : 0) + (searchQuery ? 1 : 0) + appliedFilterCount;

  // Xuất Word đồng loạt — mẫu lấy ĐỘNG từ DB qua BatchExportDocumentsModal
  // (không còn dùng danh sách DOC_TYPES hardcode).
  const [isBatchExporting, setIsBatchExporting] = useState(false);

  /**
   * Xuất Word đồng loạt: N đơn đã tích × M mẫu đã chọn → 1 file ZIP.
   *
   * `ids` nhận qua tham số (KHÔNG đọc `selection.selectedIds` tại đây): thanh bulk gọi
   * `selection.clear()` ngay sau khi action chạy, nên phải dùng bản đã chụp lúc mở modal.
   */
  const handleBatchExportWord = useCallback(async (ids: string[], docTypes: string[]) => {
    if (isBatchExporting || ids.length === 0 || docTypes.length === 0) return;
    setIsBatchExporting(true);
    let url: string | null = null;
    try {
      const response = await api.post<Blob>(
        '/petitions/export-document-batch',
        { docTypes, petitionIds: ids },
        { responseType: 'blob' },
      );
      const headers = response.headers as Record<string, string>;
      const filename = resolveFilename(headers, 'ChungTu_batch.zip');
      url = URL.createObjectURL(response.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // X-Batch-Total/Ok/Failed đếm theo SỐ FILE (N×M), X-Batch-Records là số hồ sơ —
      // gọi tất cả là "đơn" sẽ báo sai (3 đơn × 2 mẫu ra "6/6 đơn").
      const total = Number(headers['x-batch-total'] ?? ids.length * docTypes.length);
      const failed = Number(headers['x-batch-failed'] ?? 0);
      const ok = Number(headers['x-batch-ok'] ?? total);
      const records = Number(headers['x-batch-records'] ?? ids.length);
      const sysErrors = Number(headers['x-batch-system-error'] ?? 0);
      if (sysErrors > 0) {
        setTransientBanner({
          kind: 'error',
          text: `Đã xuất ${ok}/${total} file (${records} đơn) → ${filename}. ${sysErrors} file lỗi hệ thống — vui lòng báo quản trị (chi tiết trong manifest.json).`,
        });
      } else if (failed > 0) {
        setTransientBanner({
          kind: 'error',
          text: `Đã xuất ${ok}/${total} file (${records} đơn) → ${filename}. ${failed} file thiếu thông tin bắt buộc (xem manifest.json trong ZIP).`,
        });
      } else {
        setTransientBanner({
          kind: 'success',
          text: `Đã xuất ${ok} file cho ${records} đơn → ${filename}`,
        });
      }
    } catch (e) {
      // Thân lỗi về dạng Blob (responseType:'blob') → phải parse mới đọc được message
      // nghiệp vụ thật ("Lô quá lớn…", "Mẫu X chưa cấu hình series…"). Báo "kiểm tra kết
      // nối" cho mọi lỗi khiến người dùng thử lại vô ích.
      const parsed = await parseBlobError(e);
      const msg = extractApiError(parsed, 'Xuất Word đồng loạt thất bại. Vui lòng thử lại.').message;
      setTransientBanner({ kind: 'error', text: msg });
      // NÉM lại để modal giữ nguyên lựa chọn mẫu thay vì tự đóng như đã thành công.
      throw new Error(msg);
    } finally {
      if (url) URL.revokeObjectURL(url);
      setIsBatchExporting(false);
    }
  }, [isBatchExporting]);

  return (
    <ListPageShell>
      <ListPageShell.Header
        icon={Mail}
        title="Danh sách đơn thư"
        subtitle="Tố cáo, khiếu nại, kiến nghị, phản ánh — quản lý theo BLTTHS"
        actions={
          /* Nút "Xuất Word" nay nằm ở THANH CHỌN dưới cùng (cùng chỗ Xuất Excel/Xóa), cho
             chọn NHIỀU mẫu một lượt. Dropdown hổ phách cũ ở đây chỉ chọn được 1 mẫu và bị
             khuất trên header → đã gỡ để tránh hai lối vào làm hai việc khác nhau. */
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/petitions/new')}
              className={`${BTN_PRIMARY} ${A11Y_FOCUS_RING} flex items-center gap-2`}
            >
              <Plus className="w-4 h-4" />
              <span>Tạo mới</span>
              <ShortcutHint action="newRecord" className="ml-1" />
            </button>
          </div>
        }
      />
      <StatsCardsStrip
        cards={buildPetitionsCards(stats)}
        loading={stats == null}
        activeValue={groupFilter ?? (statusFilter ? OTHER_FILTER_ACTIVE : null)}
        onCardSelect={handleCardSelect}
      />
      <ListPageShell.StatusChips
        options={chipOptions}
        activeValue={statusFilter}
        onChange={handleStatusChange}
        totalCount={stats?.total}
        countsLoading={stats == null}
        groupActive={groupFilter != null}
      />
      <ListPageShell.Toolbar
        searchValue={searchQuery}
        onSearchChange={handleSearchChange}
        searchPlaceholder="Tìm kiếm theo STT, người gửi, đối tượng..."
        activeFilterCount={activeFilterCount}
        onResetFilters={handleResetFilters}
        cardStyle
      >
        <Filters<PetitionFilterValue>
          registry={petitionsListFilters}
          value={listFilters.draft}
          onChange={listFilters.setField}
          onApply={listFilters.apply}
          onReset={listFilters.reset}
          hasUnappliedChanges={listFilters.hasUnappliedChanges}
        />
      </ListPageShell.Toolbar>
      {/* Thẻ lọc theo kiểu hệ cũ — bổ sung các ô hệ mới còn thiếu. Ô "Từ khóa" nằm ở
          thanh công cụ ngay trên, nên không dựng hai ô tìm kiếm cùng màn hình. */}
      <LegacyFilterPanel
        fields={legacyFilterFields}
        values={legacyFilterValues}
        onChange={handleLegacyFilterChange}
        onApply={() => url.setParam('page', '1')}
        onReset={handleResetFilters}
      />
      {transientBanner && (
        <div
          data-testid="petitions-bulk-banner"
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
      <ListPageShell.Table<PetitionRow>
        state={tableState}
        columns={columns}
        data={rows}
        sortBy={sort.sortBy}
        sortOrder={sort.sortOrder}
        onSort={sort.onSort}
        rowKey={(r) => r.id}
        title="Danh sách đơn thư"
        sectionTitle="Danh sách đơn thư"
        totalCount={totalCount}
        error={error}
        emptyState={{
          title: 'Chưa có đơn thư nào',
          description: 'Tiếp nhận đơn thư đầu tiên để bắt đầu.',
          actionLabel: 'Tạo đơn thư mới',
          onAction: () => navigate('/petitions/new'),
        }}
        emptyFilteredState={{ onClearFilters: handleResetFilters }}
        onRowClick={(r) => navigate(`/petitions/${r.id}`)}
        getRowClassName={(r) => (isOverdue(r.deadline) ? OVERDUE_ROW_HIGHLIGHT : '')}
        bulkSelection={selection}
        bulkRowsLabel="đơn thư"
        bulkRowLabel={(r) => `đơn thư ${r.stt}`}
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

      {wordExportIds && (
        <BatchExportDocumentsModal
          entity="petitions"
          entityIds={wordExportIds}
          onClose={() => setWordExportIds(null)}
          onConfirm={handleBatchExportWord}
        />
      )}
    </ListPageShell>
  );
}

export default PetitionListPageShell;
