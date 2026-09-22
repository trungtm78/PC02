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
import { BE_RONG_COT_THAO_TAC } from '@/components/shared/ListPageShell/cotThaoTac';
import { hienThiEdtf } from '@/shared/ngay-thieu/edtf';
import { NutXuatTheoBoLoc } from '@/features/_shared/list-filters/NutXuatTheoBoLoc';
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
  ChonMatDo,
  useMatDoDong,
  formatHoSoCode,
  phanSttCu,
  type ColumnDef,
  type TableState,
  ColumnPicker,
  useBoCucCot,
  OTimKiemThe,
  DanhSachThe,
  useTheTimKiem,
  truongGoiY,
} from '@/components/shared/ListPageShell';
import { useOfficerOptions } from '@/hooks/useOfficerOptions';
import { DateRangePresets } from '@/features/_shared/list-filters/DateRangePresets';
import { useBulkSelection } from '@/features/_shared/bulk/useBulkSelection';
import { BulkActionBar } from '@/features/_shared/bulk/BulkActionBar';
import { buildPetitionsAdapter } from '@/features/_shared/bulk/adapters/petitions';
import { BatchExportDocumentsModal } from '@/features/document-templates/components/BatchExportDocumentsModal';
import { KetQuaXuLyModal } from '@/features/petitions/components/KetQuaXuLyModal';
import { resolveFilename, parseBlobError } from '@/features/document-templates/export.api';
import { extractApiError } from '@/lib/api-errors';
import type { BulkAction, BulkResult } from '@/features/_shared/bulk/types';
import {
  PETITION_STATUS_CHIPS,
  PETITION_STATUS_LABEL,
  PETITION_STATUS_BADGE,
} from '@/shared/enums/status-labels';
import { PetitionStatus } from '@/shared/enums/generated';
import {
  BTN_PRIMARY,
  A11Y_FOCUS_RING,
  OVERDUE_ROW_HIGHLIGHT,
} from '@/constants/styles';
import { StatsCardsStrip, type StatCard } from '@/components/shared/StatsCardsStrip';
import { getPetitionStatusIcon } from '@/shared/enums/status-icons';
// v0.65 PR3 — registry-driven row actions + advanced filters
import { RowActions } from '@/features/_shared/row-actions/RowActions';
import { Filters } from '@/features/_shared/list-filters/Filters';
import { nhanKyApDung } from '@/constants/thongKeSettings';
import { useListFilters } from '@/features/_shared/list-filters/useListFilters';
import { useAssignModal } from '@/features/_shared/modals/AssignModalProvider';
import { usePrintDocumentsModal } from '@/features/_shared/modals/PrintDocumentsModalProvider';
import { useDeleteResourceModal } from '@/features/_shared/modals/DeleteResourceModalProvider';
import { usePermission } from '@/hooks/usePermission';
import type { ActionContext } from '@/features/_shared/row-actions/registry';
import { petitionsRowActions } from '@/features/petitions/row-actions';
import { petitionsListFilters, type PetitionFilterValue } from '@/features/petitions/list-filters';
import { TIM_KIEM_DON_THU } from '@/shared/tim-kiem/generated';
import { KHOA_TAT_CA } from '@/shared/tim-kiem/the';
import { useFeatureBatMacDinh } from '@/lib/features/useFeature';

const PETITION_STATUS_VALUES = new Set<string>(Object.values(PetitionStatus));
function isValidPetitionStatus(value: string | null): value is PetitionStatus {
  return value != null && PETITION_STATUS_VALUES.has(value);
}

/**
 * Tham số trước thời thẻ → khoá thẻ. Đường dẫn cũ (dấu trang, tin nhắn) mở ra vẫn đúng bộ lọc:
 * ô tìm kiếm `q` thành thẻ "tất cả các cột", các ô lọc chữ cũ thành thẻ theo cột.
 */
const THAM_SO_CU_DON_THU = {
  q: KHOA_TAT_CA,
  sender: 'nguoiGui',
  unit: 'donViGiaiQuyet',
  stt: 'stt',
  stt_cu: 'sttCu',
} as const;

/** Cột "Trạng thái" tìm theo MÃ; nhãn lấy từ đúng bảng nhãn mà cột trên bảng dùng. */
const GIA_TRI_CHON_DON_THU = {
  trangThai: Object.values(PetitionStatus).map((v) => ({
    value: v,
    label: PETITION_STATUS_LABEL[v],
  })),
};

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
  /** Ngày ĐỀ XUẤT (`ngay_de_xuat` hệ cũ) — khác `receivedDate` = ngày tiếp nhận nguồn tin. */
  ngayDeXuat?: string | null;
  /** Nội dung đầy đủ — cột ô "Tóm tắt nội dung" trên form ghi vào, khớp bản gốc hệ cũ. */
  detailContent?: string | null;
  /** Đơn vị GIẢI QUYẾT (`don_vi_giai_quyet` hệ cũ) — khác `unit` = đơn vị tiếp nhận. */
  donViGiaiQuyet?: string | null;
  senderName: string;
  /** "Loại thông tin" — lưu thẳng NHÃN ("Tố giác"), không lưu mã danh mục. */
  loaiThongTin?: string | null;
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
  /*
    Sáu cột ngày mở cho tìm kiếm ngày 21/09/2026 — đo trên 46.741 đơn thật, tất cả đều ĐẦY dữ
    liệu mà trước đó không tìm được. Cột hiển thị ẩn sẵn; khai ở đây để cột render đọc được.
  */
  ngayTiepNhanNguonTin?: string | null;
  /** Ngày viết đơn — CÓ THỂ rỗng khi hồ sơ chỉ biết ngày thiếu thành phần (xem dưới). */
  petitionDate?: string | null;
  /** Ngày viết đơn dạng EDTF (`2026-12-XX`) — ~4.4k đơn chỉ có thứ này, cột ngày thật rỗng. */
  ngayVietDonEdtf?: string | null;
  ngayVietDonChu?: string | null;
  ngayGiaoDonViGiaiQuyet?: string | null;
  ngayPhieuChuyen?: string | null;
  senderIdIssueDate?: string | null;
}

interface KyDaGiaiFE {
  ky: string;
  truong: string;
  tuNgay: string | null;
  denNgay: string | null;
}

interface PetitionsStatsResponse {
  total: number;
  byStatus: Record<PetitionStatus, number>;
  /** Số theo NHÓM trạng thái, do server đếm (PETITION_STATUS_GROUPS). */
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
  // Ô tìm kiếm dạng thẻ. Cờ `TIM_KIEM_THE` là công tắc khẩn: quản trị tắt thì trang trở lại ô
  // chữ `q` → `search` như trước, không cần deploy. Máy chủ nhận cả hai.
  const theBat = useFeatureBatMacDinh('TIM_KIEM_THE');
  const timKiem = useTheTimKiem({
    prefix: 'petitions',
    khai: TIM_KIEM_DON_THU,
    thamSoCu: THAM_SO_CU_DON_THU,
    bat: theBat,
  });

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
  /*
    Popup nhập nhanh "Kết quả xử lý" — mở từ CHÍNH Ô ấy trên bảng.

    Không thêm nút thứ sáu vào cột Thao tác: cột đang khai `12rem` cho 5 nút, và nút thứ sáu là
    đúng hình học đã làm mất nút In trên prod hôm 21/09 (#464). Bấm vào ô để sửa chính ô ấy
    cũng là thao tác tự nhiên hơn một icon không nhãn.
  */
  const [popupKetQua, setPopupKetQua] = useState<{
    id: string;
    stt: string;
    giaTri: string;
    updatedAt?: string;
  } | null>(null);
  useListShortcuts({ onNew: () => navigate('/petitions/new'), onRefresh: () => setRefetchCounter((n) => n + 1) });
  const [transientBanner, setTransientBanner] = useState<{
    kind: 'success' | 'error';
    text: string;
  } | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  // v0.65 PR3 — Action context + advanced filter state.
  const { canDispatch, canEdit, canDelete } = usePermission();
  const assignModal = useAssignModal();
  const printModal = usePrintDocumentsModal();
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
      printModal,
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
      // Thẻ đi xuống CẢ danh sách lẫn thống kê qua object này — số trên thẻ thống kê khớp dòng.
      // Các ô lọc chữ cũ (người gửi, đơn vị, STT, STT cũ) nay là thẻ, không gửi riêng nữa.
      ...(theBat
        ? timKiem.tkGui.length > 0 && { tk: timKiem.tkGui }
        : debouncedSearch && { search: debouncedSearch }),
      ...(appliedFilters.fromDate && { fromDate: appliedFilters.fromDate }),
      ...(appliedFilters.toDate && { toDate: appliedFilters.toDate }),
      // Cán bộ đổi TẠM kỳ tính theo ngày nào; rỗng thì máy chủ dùng cấu hình hệ thống.
      ...(appliedFilters.thongKeTruongNgay && {
        thongKeTruongNgay: appliedFilters.thongKeTruongNgay,
      }),
      // Thiếu dòng này thì ô lọc chỉ ghi vào địa chỉ trang mà KHÔNG đi xuống API — người dùng
      // thấy ô lọc đổi còn danh sách đứng yên.
      ...(appliedFilters.enteredById && { enteredById: appliedFilters.enteredById }),
      // `fromDate`/`toDate` đã khai ở trên — hai ô ngày là MỘT, dùng chung khoá. Khai lại
      // lần nữa ở đây là tàn dư của lúc màn hình còn hai mặt lọc.
    }),
    [theBat, timKiem.tkGui, debouncedSearch, appliedFilters],
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
            // Có lọc ở mặt lọc (ngày, cán bộ nhập…) cũng là "lọc không ra" — không mời tạo hồ sơ đầu tiên.
            debouncedSearch ||
            statusFilter ||
            groupFilter ||
            timKiem.the.length > 0 ||
            Object.values(appliedFilters).some((v) => v)
              ? 'empty-filtered'
              : 'empty',
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
  }, [statusFilter, groupFilter, page, baseQueryKey, refetchCounter, sort.sortBy, sort.sortOrder]);

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
  }, [statusFilter, groupFilter, page, baseQueryKey]);
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
      // BỀ RỘNG CỘT LẤY TỪ SỐ ĐO DỮ LIỆU THẬT (bản chạy thật, 25/08/2026) — không đoán.
      // Độ dài nội dung, trung vị / phân vị 90:
      //   Tóm tắt nội dung  350 / 973   → 30rem, cột rộng nhất
      //   Kết quả xử lý      39 /  85   → 16rem
      //   Tên cá nhân…       16 /  38   → 14rem
      //   Nguồn đơn           9 /  33   → 12rem
      //   STT                 9 /   9   →  7rem
      // Anh nêu đích danh: Tóm tắt phải rộng hơn Tên cá nhân. Có ca kiểm chốt điều đó ở cả
      // ba trang, vì đây là thứ dễ bị đảo ngược lặng lẽ khi ai đó chỉnh cho vừa mắt.
      // Thao tác là cột ĐẦU, ngay sau ô tick — CỐ Ý KHÁC hệ cũ (hệ cũ để cuối).
      // Bảng này rộng nên phải cuộn ngang; để Thao tác ở cuối thì mỗi lần muốn bấm là cuộn
      // sang phải rồi cuộn ngược về. Anh quyết định 25/08/2026, ưu tiên thao tác nhanh.
      // Ghim ở mép trái khi cuộn ngang. Không ghim thì cột này trôi mất ngay khi cuộn, và
      // việc đưa nó lên đầu hôm qua thành vô nghĩa.
      {
        key: 'actions',
        header: 'Thao tác',
        width: BE_RONG_COT_THAO_TAC,
        // Bề rộng KHÔNG cho người dùng đặt: cột này chứa nút icon cỡ cố định, số lượng do ta
        // quyết. Bề rộng lưu trước khi thêm một nút sẽ cắt mất nút mới và không tự sửa —
        // ca hỏng thật 21/09/2026, ô lưu 113px cắt mất nút "In chứng từ" và nút ⋮.
        khongDoiBeRong: true,
        sticky: true,
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
      // Các cột nội dung giữ NGUYÊN thứ tự hệ cũ: STT → Ngày → Nguồn đơn → Tên người →
      // Tóm tắt → Đơn vị → Kết quả → Người nhập. Chỉ riêng Thao tác đứng trước chúng.

      {
        key: 'stt',
        header: 'STT',
        timKiem: ['stt', 'sttCu'],
        width: '6rem',
        // Anh yêu cầu 27/08/2026: bấm tiêu đề cột STT để đổi chiều sắp xếp, như cột ngày.
        // Máy chủ sắp trên cột số `sttSort`; tên khoá gửi đi vẫn là `stt`.
        sortKey: 'stt',
        render: (r) => (
          // Hệ cũ hiện `26-11171`; dữ liệu trong CSDL vẫn là `2026-11171`, không đổi.
          // STT cũ ghép ngay sau, đúng chữ và đúng kiểu nghiêng-đỏ của hệ cũ
          // (`doi_1_xem.tpl:44`). Vắng hẳn khi hồ sơ không có số cũ.
          <span className="font-mono text-xs text-slate-700">
            {formatHoSoCode(r.stt)}
            {r.sttCu?.trim() && <em className="italic text-red-600">{phanSttCu(r.sttCu)}</em>}
          </span>
        ),
      },

      {
        // 27/08/2026: đọc `ngayDeXuat`, không đọc `receivedDate`.
        //
        // Nhãn nói "Ngày đề xuất" nhưng cột lấy `receivedDate` — mà `receivedDate` của hồ sơ
        // di trú là NGÀY TIẾP NHẬN NGUỒN TIN (`ngay_tiep_nhan_nguon_tin`), chỉ rơi về ngày đề
        // xuất khi không có ngày tiếp nhận. Đo trên máy thật: 29.026/46.499 hồ sơ hiện sai
        // ngày. Ô "Ngày/Tháng/Năm đề xuất" trên form vẫn luôn ghi `ngayDeXuat`, và Vụ việc
        // lẫn Vụ án cũng đọc `ngayDeXuat` — chỉ màn này lệch.
        key: 'ngayDeXuat',
        header: 'Ngày đề xuất',
        timKiem: 'ngayDeXuat',
        width: '7rem',
        optional: 'show',
        sortKey: 'ngayDeXuat',
        render: (r) => <DateCell value={r.ngayDeXuat} />,
      },

      {
        /*
          Anh yêu cầu 22/09/2026: thêm "Loại thông tin", đứng ngay TRƯỚC "Nguồn đơn/Đơn vị giao".

          Cột lưu thẳng NHÃN ("Tố giác", "Đề nghị"), không lưu mã danh mục — đo bản sao prod
          22/09/2026: 46.721/47.169 hồ sơ (99,0%) có giá trị, giá trị khớp `directories.name`
          của `LOAI_THONG_TIN`. Nên render là in thẳng chuỗi, không phải tra danh mục.
        */
        key: 'loaiThongTin',
        header: 'Loại thông tin',
        /*
          KHÔNG khai `timKiem` — hoãn có chủ ý, không phải bỏ sót.

          Khai một `truong` mới trong `khai/don-thu.khai.ts` với `kieu: 'chu'` là ghép cột ấy
          vào biểu thức cột bóng (`sinh-tim-kiem.ts:236` `cotTatCa`), kéo theo migration đổi
          trigger và nạp lại 47.169 dòng. Việc ấy thuộc đợt tìm kiếm đang dở trên nhánh
          `wip/mo-rong-cot-ghep-tim-tat-ca`, nơi đã có thiết kế expand–migrate–contract để làm
          mà không có cửa sổ suy giảm. Nhét vào đây là đổi một cột hiển thị thành một lượt
          deploy có rủi ro dữ liệu.

          Hiện trạng không xấu đi: cột này vốn đã không tìm được trước bản này.
        */
        width: '8rem',
        optional: 'show',
        render: (r) => r.loaiThongTin ?? '—',
      },

      {
        key: 'nguonDon',
        header: 'Nguồn đơn/Đơn vị giao',
        timKiem: 'nguonDon',
        width: '8rem',
        optional: 'show',
        render: (r) => r.nguonDon ?? '—',
      },

      {
        key: 'senderName',
        header: 'Tên cá nhân, cơ quan, tổ chức cung cấp, bị hại',
        timKiem: 'nguoiGui',
        width: '10rem',
        optional: 'show',
        render: (r) => <span className="font-medium text-slate-800">{r.senderName}</span>,
      },

      {
        // Đọc `detailContent` — cột mà ô "Tóm tắt nội dung" trên form ghi vào, và là cột khớp
        // bản gốc hệ cũ 46.497/46.497. `summary` là bản rút gọn suy lại lúc lưu: nó lệch ở 58
        // hồ sơ và hụt 1, nên danh sách đọc nó thì cán bộ sửa nội dung xong vẫn thấy chữ cũ.
        key: 'detailContent',
        header: 'Tóm tắt nội dung',
        timKiem: 'tomTat',
        width: '20rem',
        optional: 'show',
        render: (r) => <SummaryCell value={r.detailContent} />,
      },

      {
        key: 'donViGiaiQuyet',
        header: 'Đơn vị giải quyết',
        timKiem: 'donViGiaiQuyet',
        width: '9rem',
        optional: 'show',
        render: (r) => r.donViGiaiQuyet ?? '—',
      },

      {
        key: 'ketQuaXuLyKhac',
        header: 'Kết quả xử lý, giải quyết khác',
        timKiem: 'ketQuaXuLyKhac',
        width: '10rem',
        optional: 'show',
        render: (r) => {
          /*
            Đọc cột hiển thị TRƯỚC mọi thứ khác.

            Cổng `cotDanhSachPhaiTroDungCotForm` suy "cột này đọc gì" từ tham chiếu `r.` ĐẦU
            TIÊN trong hàm dựng. Để `r.id` đứng trước (trong trình xử lý bấm) là cổng kết luận
            cột "Kết quả xử lý" đang đọc cột `id` — nó đỏ đúng, chỉ là đỏ vì thứ tự chứ không
            vì hành vi. Tách biến ra cũng làm hàm dễ đọc hơn.
          */
          const chu = r.ketQuaXuLyKhac ?? '—';
          /*
            Không có quyền sửa thì hiện chữ trơn, không hiện thứ bấm được.

            Máy chủ vẫn chặn 403 như cũ — nhưng mời một người chỉ-xem mở popup, gõ xong rồi mới
            báo "không có quyền" là làm mất công người ta và làm họ tưởng hệ hỏng. Cùng luật với
            `chiXem` trên form.
          */
          if (!canEdit('petitions')) return <span>{chu}</span>;
          return (
          <button
            type="button"
            onClick={(e) => {
              // Bảng có hành vi bấm-dòng-để-mở-hồ-sơ; không chặn nổi bọt thì bấm để sửa ô lại
              // nhảy sang màn sửa và popup không bao giờ hiện.
              e.stopPropagation();
              setPopupKetQua({
                id: r.id,
                stt: r.stt,
                giaTri: r.ketQuaXuLyKhac ?? '',
                updatedAt: r.updatedAt,
              });
            }}
            className="w-full text-left hover:underline decoration-dotted underline-offset-2"
            title="Bấm để nhập nhanh kết quả xử lý và tệp nhận từ đơn vị"
            data-testid={`o-ket-qua-${r.id}`}
          >
            {chu}
          </button>
          );
        },
      },

      {
        key: 'enteredBy',
        header: 'Người nhập',
        timKiem: 'nguoiNhap',
        width: '8rem',
        optional: 'show',
        render: (r) =>
          r.enteredBy
            ? `${r.enteredBy.lastName ?? ''} ${r.enteredBy.firstName ?? ''}`.trim() ||
              (r.enteredBy.username ?? '—')
            : '—',
      },

      {
        key: 'status',
        header: 'Trạng thái',
        timKiem: 'trangThai',
        width: '9rem',
        optional: 'show',
        render: (r) => (
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium ${PETITION_STATUS_BADGE[r.status]}`}>
            {getPetitionStatusIcon(r.status)}
            {PETITION_STATUS_LABEL[r.status]}
          </span>
        ),
      },

      {
        key: 'suspectedPerson',
        header: 'Đối tượng bị tố',
        timKiem: 'doiTuong',
        width: '11rem',
        optional: 'hide',
        render: (r) => r.suspectedPerson ?? '—',
      },

      {
        key: 'deadline',
        header: 'Hạn xử lý',
        timKiem: 'hanXuLy',
        width: '8rem',
        optional: 'hide',
        sortKey: 'deadline',
        render: (r) => (
          <DateCell value={r.deadline} quaHan={!!r.deadline && isOverdue(r.deadline)} />
        ),
      },

      {
        key: 'createdAt',
        header: 'Ngày tạo',
        timKiem: 'ngayTao',
        width: '7rem',
        optional: 'hide',
        sortKey: 'createdAt',
        // Hồ sơ di trú đều mang cùng một ngày tạo (ngày chuyển dữ liệu) — chú giải để
        // cán bộ không tưởng là lỗi hiển thị.
        render: (r) => (
          <DateCell
            value={r.createdAt}
            title="Ngày nhập vào hệ thống. Hồ sơ di trú đều là ngày chuyển dữ liệu."
          />
        ),
      },

      /*
        Sáu cột ngày ĐẦY DỮ LIỆU mà trước 21/09/2026 không tìm được — đo trên 46.741 đơn thật.
        Ẩn sẵn (`optional: 'hide'`) vì bảng đã đủ rộng; cán bộ bật được khi cần nhìn.

        Khai cột ở đây KHÔNG phải thủ tục: cổng `timKiemCotKhai` đòi mọi trường tìm được phải có
        một cột mang khoá ấy, và đòi hỏi ấy đúng — tìm theo một thứ không bao giờ xem được là
        nửa vời. Nhờ cột có thật, cổng xanh mà KHÔNG bị nới một dòng nào.
      */
      {
        key: 'receivedDate',
        header: 'Ngày tiếp nhận',
        timKiem: 'ngayTiepNhan',
        width: '7rem',
        optional: 'hide',
        render: (r) => <DateCell value={r.receivedDate} />,
      },
      {
        key: 'ngayTiepNhanNguonTin',
        header: 'Ngày tiếp nhận nguồn tin',
        timKiem: 'ngayTiepNhanNguonTin',
        width: '8rem',
        optional: 'hide',
        render: (r) => <DateCell value={r.ngayTiepNhanNguonTin} />,
      },
      {
        key: 'petitionDate',
        header: 'Ngày viết đơn',
        timKiem: 'ngayVietDon',
        width: '7rem',
        optional: 'hide',
        /*
          Ba nguồn, đúng thứ tự của hàm hiển thị dùng chung phía máy chủ:
          chữ NGUYÊN VĂN → EDTF (`__/12/2026`) → ngày thật.

          ~4.4k đơn chỉ có ngày thiếu thành phần, và từ 21/09/2026 còn có hồ sơ chỉ mang chữ
          nguyên văn ("19/4/2021 (03 đơn), 20/4/2021 (9 đơn), …"). Bỏ nhánh đầu thì đúng những
          hồ sơ ấy hiện `—` như thể trống — mất im lặng ngay trên màn danh sách.
        */
        render: (r) =>
          r.ngayVietDonChu?.trim() ? (
            <span className="text-slate-500">{r.ngayVietDonChu}</span>
          ) : r.petitionDate ? (
            <DateCell value={r.petitionDate} />
          ) : (
            <span className="text-slate-500">
              {hienThiEdtf(r.ngayVietDonEdtf) || '—'}
            </span>
          ),
      },
      {
        key: 'ngayGiaoDonViGiaiQuyet',
        header: 'Ngày giao đơn vị giải quyết',
        timKiem: 'ngayGiaoDonViGiaiQuyet',
        width: '8rem',
        optional: 'hide',
        render: (r) => <DateCell value={r.ngayGiaoDonViGiaiQuyet} />,
      },
      {
        key: 'ngayPhieuChuyen',
        header: 'Ngày phiếu chuyển',
        timKiem: 'ngayPhieuChuyen',
        width: '7rem',
        optional: 'hide',
        render: (r) => <DateCell value={r.ngayPhieuChuyen} />,
      },
      {
        key: 'senderIdIssueDate',
        header: 'Ngày cấp CCCD',
        timKiem: 'ngayCapCCCD',
        width: '7rem',
        optional: 'hide',
        render: (r) => <DateCell value={r.senderIdIssueDate} />,
      },
    ],
    [actionCtx],
  );

  // Chọn cột hiển thị kiểu treeview Odoo. Cột nào vào menu và tích sẵn hay không là do
  // `optional` khai ngay trên từng cột ở khối trên, không phải một danh sách riêng ở đây.
  // Bố cục cột lưu trên MÁY CHỦ theo tài khoản: bề rộng, ẩn/hiện và thứ tự cùng một chỗ.
  // Trước đây ẩn/hiện lưu ở trình duyệt từng máy nên đổi máy là mất.
  const {
    coGhiDeBeRong,
    visibleColumns,
    toggleableColumns,
    isVisible,
    batTat: toggle,
    datBeRong,
    xoaBeRong,
    doiCho,
    datLai: resetColumns,
  } = useBoCucCot('petitions', columns);
  const [matDo, datMatDo] = useMatDoDong('petitions');
  // Gợi ý của ô thẻ = cột đang hiện, đúng thứ tự; ẩn cột là cột ấy rời khỏi gợi ý.
  const truongTimKiem = useMemo(() => truongGoiY(visibleColumns, TIM_KIEM_DON_THU), [visibleColumns]);

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


  // Danh sách cán bộ cho ô "Cán bộ nhập" — nạp lúc chạy nên truyền qua `dynamicOptions`
  // của mặt lọc chung, không khai cứng được trong registry.
  const { data: officerOptions } = useOfficerOptions();

  const handleResetFilters = useCallback(() => {
    // THỨ TỰ CÓ NGHĨA: `setSearchParams(prev => …)` của React Router 7 tính `prev` từ tham số
    // LÚC VẼ, không nối tiếp lần ghi trước trong cùng lượt. Gọi `clearAll` trước rồi `reset` thì
    // `reset` dựng lại địa chỉ từ tham số cũ (còn thẻ, `q`, trạng thái) — "Xóa lọc" chỉ xoá mặt
    // lọc. `clearAll` xoá MỌI khoá `petitions_*` (bao cả khoá của mặt lọc) nên phải là lần ghi cuối.
    listFilters.reset();
    url.clearAll();
  }, [url, listFilters]);

  const appliedFilterCount = Object.values(appliedFilters).filter((v) => v && v !== '').length;
  const activeFilterCount =
    (statusFilter ? 1 : 0) +
    (groupFilter ? 1 : 0) +
    (theBat ? timKiem.the.length : searchQuery ? 1 : 0) +
    appliedFilterCount;

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
        periodLabel={stats?.ky ? nhanKyApDung(stats.ky, appliedFilters.fromDate, appliedFilters.toDate) : null}
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
        searchSlot={
          theBat ? (
            <OTimKiemThe
              the={timKiem.the}
              truong={truongTimKiem}
              khai={TIM_KIEM_DON_THU}
              giaTriChon={GIA_TRI_CHON_DON_THU}
              onThem={timKiem.them}
              onBoThe={timKiem.boThe}
              onBoGiaTri={timKiem.boGiaTri}
              placeholder="Tìm trong mọi cột — gõ rồi chọn cột (phím /)"
            />
          ) : undefined
        }
        searchPlaceholder="Tìm kiếm theo STT, người gửi, đối tượng..."
        activeFilterCount={activeFilterCount}
        onResetFilters={handleResetFilters}
        cardStyle
        columnPicker={
          <div className="flex items-center gap-2">
            {/* Mật độ dòng cạnh nút "Cột" (PR-F2, 18/09/2026) — nhớ theo cán bộ ở máy chủ. */}
            <ChonMatDo giaTri={matDo} onDoi={datMatDo} />
            <ColumnPicker
              columns={toggleableColumns}
              isVisible={isVisible}
              onToggle={toggle}
              onReset={resetColumns}
              onDoiCho={doiCho}
            />
          </div>
        }
      >
        <Filters<PetitionFilterValue>
          registry={petitionsListFilters}
          value={listFilters.draft}
          onChange={listFilters.setField}
          onApply={listFilters.apply}
          onReset={listFilters.reset}
          hasUnappliedChanges={listFilters.hasUnappliedChanges}
          hanhDongPhu={
            // Xuất ĐÚNG bộ tham số của bảng (thẻ, trạng thái, ngày, cán bộ, sắp xếp) và các cột đang hiện.
            <NutXuatTheoBoLoc
              duongDan="/petitions/export/danh-sach"
              thamSo={{
                ...baseQueryParams,
                ...(statusFilter && { status: statusFilter }),
                ...(groupFilter && { statusGroup: groupFilter }),
                ...sort.params,
              }}
              cot={visibleColumns.map((c) => c.key).filter((k) => k !== 'actions')}
              tong={tableState === 'loading' ? null : totalCount}
              hasUnappliedChanges={listFilters.hasUnappliedChanges}
              onApply={listFilters.apply}
              tenDuPhong="danh-sach-don-thu.xlsx"
            />
          }
          dynamicOptions={{
            enteredById: [{ value: '', label: 'Tất cả' }, ...(officerOptions ?? [])],
          }}
        >
          <DateRangePresets
            onPick={(khoang) => {
              // Ghi vào ĐÚNG hai ô ngày của mặt lọc này — không tạo trạng thái thứ hai.
              listFilters.setField('fromDate', khoang.fromDate);
              listFilters.setField('toDate', khoang.toDate);
            }}
          />
        </Filters>
      </ListPageShell.Toolbar>
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
        // Bố cục cột CỐ ĐỊNH: bề rộng dưới đây do dữ liệu thật quyết, không do chuỗi dài
        // nhất trong cột quyết. Xem chú thích ở khối `columns`.
        fixedLayout
        // Anh yêu cầu 18/09/2026: các cột xuống dòng để thấy đủ nội dung + thanh cuộn ngang ở trên bảng.
        xuongDong
        matDo={matDo}
        onKeoGian={datBeRong}
        datTongBeRong={coGhiDeBeRong}
        onVeMacDinhCot={xoaBeRong}
        state={tableState}
        columns={visibleColumns}
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
        emptyFilteredState={{
          onClearFilters: handleResetFilters,
          chiTiet:
            timKiem.the.length > 0 ? (
              <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 text-sm text-slate-600">
                <span>Không tìm thấy với:</span>
                <DanhSachThe
                  the={timKiem.the}
                  khai={TIM_KIEM_DON_THU}
                  giaTriChon={GIA_TRI_CHON_DON_THU}
                  onBoThe={timKiem.boThe}
                />
              </div>
            ) : undefined,
        }}
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
      {popupKetQua && (
        <KetQuaXuLyModal
          petitionId={popupKetQua.id}
          stt={popupKetQua.stt}
          giaTri={popupKetQua.giaTri}
          updatedAt={popupKetQua.updatedAt}
          onClose={() => setPopupKetQua(null)}
          onSaved={() => setRefetchCounter((n) => n + 1)}
        />
      )}
    </ListPageShell>
  );
}

export default PetitionListPageShell;
