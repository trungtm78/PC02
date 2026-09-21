/**
 * ComprehensiveListPageShell — PR2/T6 ListPageShell consumer cho Tra cứu tổng hợp.
 *
 * Tổng hợp 3 entity types (Vụ án / Vụ việc / Đơn thư) trong 1 list duy nhất.
 *
 * Pattern decisions (per plan):
 * - StatusChips dùng làm RECORD_TYPE filter (CASE / INCIDENT / PETITION), không
 *   phải status enum — semantic phù hợp với UI hiện tại (anh phân biệt theo loại
 *   record, không theo status).
 * - "Tất cả" chip fetch parallel 3 endpoints, merge + sort theo createdAt desc.
 *   Preview-only: tối đa MERGE_PREVIEW_SIZE rows mới nhất từ mỗi entity → UI cap
 *   pagination tại merged.length thay vì sum server totals (review fix C1).
 * - Counts derived từ list response `.total` khi fan-out, KHÔNG fire thêm stats
 *   endpoint calls — tiết kiệm 3 request/keystroke (review fix C2). Riêng single-type
 *   mode dùng /stats endpoint cho future per-status drill-down.
 *
 * KHÔNG thay thế production ComprehensiveListPage — feature-flag swap ở PR3.
 */
import { BE_RONG_COT_THAO_TAC } from '@/components/shared/ListPageShell/cotThaoTac';
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useListShortcuts } from '@/hooks/useListShortcuts';
import { ShortcutHint } from '@/components/ShortcutCheatSheet';
import { Layers, Plus } from 'lucide-react';
import axios from 'axios';
import { api } from '@/lib/api';
import {
  ListPageShell,
  ColumnPicker,
  useBoCucCot,
  useListPageUrlState,
  type ColumnDef,
  type TableState,
  OTimKiemThe,
  DanhSachThe,
  useTheTimKiem,
  truongGoiY,
} from '@/components/shared/ListPageShell';
import {
  CASE_STATUS_LABEL,
  CASE_STATUS_BADGE,
  INCIDENT_STATUS_LABEL,
  INCIDENT_STATUS_BADGE,
  PETITION_STATUS_LABEL,
  PETITION_STATUS_BADGE,
  BADGE_DEFAULT,
} from '@/shared/enums/status-labels';
import {
  CaseStatus,
  IncidentStatus,
  PetitionStatus,
} from '@/shared/enums/generated';
import { BTN_PRIMARY, A11Y_FOCUS_RING } from '@/constants/styles';
import { formatVNDate } from '@/lib/dates';
// v0.66 PR4 — polyglot registry-driven row actions + advanced filters
import { RowActions } from '@/features/_shared/row-actions/RowActions';
import { Filters } from '@/features/_shared/list-filters/Filters';
import { useListFilters } from '@/features/_shared/list-filters/useListFilters';
import { useAssignModal } from '@/features/_shared/modals/AssignModalProvider';
import { usePrintDocumentsModal } from '@/features/_shared/modals/PrintDocumentsModalProvider';
import { useDeleteResourceModal } from '@/features/_shared/modals/DeleteResourceModalProvider';
import { usePermission } from '@/hooks/usePermission';
import type { ActionContext } from '@/features/_shared/row-actions/registry';
import { comprehensiveRowActions } from '@/features/comprehensive/row-actions';
import { comprehensiveListFilters, type ComprehensiveFilterValue } from '@/features/comprehensive/list-filters';
import { hoTen } from '@/lib/hoTen';
import { KHOA_TAT_CA, khoaHopLe, type TruongTimKiem } from '@/shared/tim-kiem/the';
import {
  TIM_KIEM_DON_THU,
  TIM_KIEM_VU_AN,
  TIM_KIEM_VU_VIEC,
} from '@/shared/tim-kiem/generated';
import { useFeatureBatMacDinh } from '@/lib/features/useFeature';

type LoaiHoSo = 'CASE' | 'INCIDENT' | 'PETITION';

/** Mỗi loại hồ sơ một khai máy chủ — máy chủ nào cũng trả 400 cho khoá không phải của mình. */
const KHAI_THEO_LOAI: Record<LoaiHoSo, readonly TruongTimKiem[]> = {
  CASE: TIM_KIEM_VU_AN,
  INCIDENT: TIM_KIEM_VU_VIEC,
  PETITION: TIM_KIEM_DON_THU,
};

/**
 * Chế độ "Tất cả" gửi CÙNG thẻ tới ba máy chủ, nên chỉ dùng khoá có ở CẢ BA khai cùng kiểu. Bỏ kiểu
 * chọn: mã trạng thái mỗi loại khác nhau, gửi mã Vụ án tới Đơn thư là 400.
 */
const KHAI_CHUNG: readonly TruongTimKiem[] = TIM_KIEM_DON_THU.filter(
  (t) =>
    t.kieu !== 'chon' &&
    [TIM_KIEM_VU_VIEC, TIM_KIEM_VU_AN].every((k) =>
      k.some((x) => x.key === t.key && x.kieu === t.kieu),
    ),
);

/**
 * Tham số trước thời thẻ → khoá thẻ. `q` = "tất cả các cột"; ba ô lọc chữ cũ (Quận/Huyện, Trạng
 * thái chung, Người tạo) — vốn không đi xuống API — nay mở ra đúng thẻ tương ứng.
 */
const THAM_SO_CU_TONG_HOP = {
  q: KHOA_TAT_CA,
  district: 'donViGiaiQuyet',
  status: 'trangThai',
  created_by: 'nguoiNhap',
} as const;

const chonTu = <T extends string>(ma: readonly T[], nhan: Record<T, string>) =>
  ma.map((v) => ({ value: v, label: nhan[v] }));

/** Giá trị cột "Trạng thái" theo loại đang chọn — mỗi loại một bộ mã. */
const GIA_TRI_CHON_THEO_LOAI = {
  CASE: { trangThai: chonTu(Object.values(CaseStatus), CASE_STATUS_LABEL) },
  INCIDENT: { trangThai: chonTu(Object.values(IncidentStatus), INCIDENT_STATUS_LABEL) },
  PETITION: { trangThai: chonTu(Object.values(PetitionStatus), PETITION_STATUS_LABEL) },
};

/**
 * Thẻ gửi được tới thống kê của loại này không. Loại đang chọn nhận mọi thẻ (đã lọc theo khai của nó).
 * Loại KHÁC chỉ nhận thẻ thuộc khoá chung ba loại: xét theo khoá thôi là chưa đủ — Đơn thư cũng có
 * khoá `trangThai` nhưng mã khác (400), Vụ việc trùng vài mã với Vụ án nên đếm ra số sai nghĩa.
 */
const theHopLeCho = (
  loai: LoaiHoSo,
  loaiDangChon: LoaiHoSo | null,
  tk: readonly string[],
) =>
  loai === loaiDangChon ||
  tk.every((muc) => khoaHopLe(muc.slice(0, muc.indexOf('~')), KHAI_CHUNG));

/**
 * Phần tìm kiếm gửi xuống API. Cờ `TIM_KIEM_THE` bật → thẻ (đã lọc theo khai đang dùng); tắt → ô
 * chữ `search` như trước.
 */
function thamSoTimKiem(
  chuoi: string,
  theBat: boolean,
  tk: readonly string[],
): { tk?: string[]; search?: string } {
  if (!theBat) return chuoi.trim() ? { search: chuoi } : {};
  return tk.length ? { tk: [...tk] } : {};
}

/** Khoảng ngày theo tên tham số của từng API — Vụ việc dùng `fromDateRange`/`toDateRange`. */
function thamSoNgay(loai: LoaiHoSo, tu?: string, den?: string): Record<string, string> {
  const [khoaTu, khoaDen] =
    loai === 'INCIDENT' ? ['fromDateRange', 'toDateRange'] : ['fromDate', 'toDate'];
  return { ...(tu ? { [khoaTu]: tu } : {}), ...(den ? { [khoaDen]: den } : {}) };
}

const RECORD_TYPE = {
  CASE: 'CASE',
  INCIDENT: 'INCIDENT',
  PETITION: 'PETITION',
} as const;
type RecordType = (typeof RECORD_TYPE)[keyof typeof RECORD_TYPE];

const RECORD_TYPE_VALUES = new Set<string>(Object.values(RECORD_TYPE));
function isValidRecordType(value: string | null): value is RecordType {
  return value != null && RECORD_TYPE_VALUES.has(value);
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
    return 'Không tải được dữ liệu tra cứu';
  }
  return 'Lỗi không xác định';
}

interface UnifiedRow {
  id: string;
  recordType: RecordType;
  typeLabel: string;
  caseNumber: string;
  name: string;
  statusLabel: string;
  statusBadge: string;
  createdBy: string;
  receivedDate: string;
  createdAt: string;
  /** Đơn vị GIẢI QUYẾT — cùng cột thẻ `donViGiaiQuyet` lọc (không phải `unit` đơn vị tiếp nhận). */
  district?: string;
  /** Người nhập hồ sơ — cột ẩn sẵn mang thẻ `nguoiNhap`. */
  nguoiNhap: string;
}

const PAGE_SIZE = 20;
// Fan-out preview cap — limit per-entity rows fetched khi "Tất cả".
// 50 × 3 = 150 rows merge buffer, paginated client-side. Review fix C1.
const MERGE_PREVIEW_PER_ENTITY = 50;

function caseToUnified(c: {
  id: string;
  caseCode?: string | null;
  name: string;
  status: CaseStatus;
  donViGiaiQuyet?: string | null;
  investigator?: { firstName?: string; lastName?: string; username: string } | null;
  createdBy?: { firstName?: string | null; lastName?: string | null; username?: string } | null;
  createdAt: string;
}): UnifiedRow {
  return {
    id: c.id,
    recordType: RECORD_TYPE.CASE,
    typeLabel: 'Vụ án',
    caseNumber: c.caseCode ?? c.id.slice(0, 8).toUpperCase(),
    name: c.name,
    statusLabel: CASE_STATUS_LABEL[c.status] ?? c.status,
    statusBadge: CASE_STATUS_BADGE[c.status] ?? BADGE_DEFAULT,
    createdBy: c.investigator
      ? hoTen(c.investigator) ||
        c.investigator.username
      : '—',
    receivedDate: c.createdAt,
    createdAt: c.createdAt,
    district: c.donViGiaiQuyet ?? undefined,
    nguoiNhap: hoTen(c.createdBy) || '—',
  };
}

function incidentToUnified(i: {
  id: string;
  code: string;
  name: string;
  status: IncidentStatus;
  donViGiaiQuyet?: string | null;
  investigator?: { firstName?: string; lastName?: string; username: string } | null;
  canBoNhap?: { firstName?: string | null; lastName?: string | null; username?: string } | null;
  createdAt: string;
}): UnifiedRow {
  return {
    id: i.id,
    recordType: RECORD_TYPE.INCIDENT,
    typeLabel: 'Vụ việc',
    caseNumber: i.code,
    name: i.name,
    statusLabel: INCIDENT_STATUS_LABEL[i.status] ?? i.status,
    statusBadge: INCIDENT_STATUS_BADGE[i.status] ?? BADGE_DEFAULT,
    createdBy: i.investigator
      ? hoTen(i.investigator) ||
        i.investigator.username
      : '—',
    receivedDate: i.createdAt,
    createdAt: i.createdAt,
    district: i.donViGiaiQuyet ?? undefined,
    nguoiNhap: hoTen(i.canBoNhap) || '—',
  };
}

function petitionToUnified(p: {
  id: string;
  stt: string;
  senderName: string;
  status: PetitionStatus;
  donViGiaiQuyet?: string | null;
  enteredBy?: { firstName?: string | null; lastName?: string | null; username?: string } | null;
  receivedDate: string;
  createdAt: string;
}): UnifiedRow {
  return {
    id: p.id,
    recordType: RECORD_TYPE.PETITION,
    typeLabel: 'Đơn thư',
    caseNumber: p.stt,
    name: p.senderName,
    statusLabel: PETITION_STATUS_LABEL[p.status] ?? p.status,
    statusBadge: PETITION_STATUS_BADGE[p.status] ?? BADGE_DEFAULT,
    createdBy: '—',
    receivedDate: p.receivedDate,
    createdAt: p.createdAt,
    district: p.donViGiaiQuyet ?? undefined,
    nguoiNhap: hoTen(p.enteredBy) || '—',
  };
}

export function ComprehensiveListPageShell() {
  const navigate = useNavigate();
  const url = useListPageUrlState('comp');

  const rawType = url.getParam('type');
  const typeFilter = isValidRecordType(rawType) ? rawType : null;
  const page = Math.max(1, url.getNumberParam('page', 1));
  const searchQuery = url.getParam('q') ?? '';
  const theBat = useFeatureBatMacDinh('TIM_KIEM_THE');
  // Khai đổi theo chip loại: "Tất cả" = khoá chung ba loại; một loại = khai đầy đủ của loại ấy. Thẻ
  // không hợp lệ với khai đang dùng hiện ĐỎ và không được gửi (tkGui đã lọc).
  const khaiHienTai = typeFilter ? KHAI_THEO_LOAI[typeFilter] : KHAI_CHUNG;
  const giaTriChon = typeFilter ? GIA_TRI_CHON_THEO_LOAI[typeFilter] : undefined;
  // Mã chọn cũng theo loại: Trạng thái Vụ án mang sang Đơn thư là mã lạ → đỏ, không gửi (không 400).
  const timKiem = useTheTimKiem({
    prefix: 'comp',
    khai: khaiHienTai,
    giaTriChon,
    thamSoCu: THAM_SO_CU_TONG_HOP,
    bat: theBat,
  });
  const lyDoTheDo = typeFilter
    ? 'Không áp dụng cho loại hồ sơ này'
    : 'Chỉ áp dụng khi chọn đúng loại hồ sơ';
  // Khoá theo GIÁ TRỊ: `tkGui` đổi tham chiếu mỗi lần URL đổi (cả khi chỉ đổi trang).
  const tkKey = JSON.stringify(timKiem.tkGui);
  // Còn thẻ (kể cả thẻ đỏ không gửi) thì bảng rỗng vẫn là "lọc không ra": cán bộ cần thấy thẻ để gỡ.
  const coThe = timKiem.the.length > 0;

  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  const [rows, setRows] = useState<UnifiedRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [counts, setCounts] = useState<{
    cases: number | null;
    incidents: number | null;
    petitions: number | null;
  }>({ cases: null, incidents: null, petitions: null });
  const [tableState, setTableState] = useState<TableState>('loading');
  const [error, setError] = useState<string | undefined>();

  const abortRef = useRef<AbortController | null>(null);

  // v0.66 PR4 — Action context + advanced filters.
  const { canDispatch, canEdit, canDelete } = usePermission();
  const assignModal = useAssignModal();
  const printModal = usePrintDocumentsModal();
  const deleteModal = useDeleteResourceModal();
  const [refetchCounter, setRefetchCounter] = useState(0);
  useListShortcuts({ onNew: () => navigate('/cases/new'), onRefresh: () => setRefetchCounter((n) => n + 1) });
  const actionCtx: ActionContext = useMemo(
    () => ({
      navigate,
      perms: {
        canDispatch,
        // canEdit/canDelete checked per resource at action level — caller passes general.
        canEdit: canEdit('cases') || canEdit('incidents') || canEdit('petitions'),
        canDelete: canDelete('cases') || canDelete('incidents') || canDelete('petitions'),
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
  const listFilters = useListFilters<ComprehensiveFilterValue>({
    // CÙNG tiền tố với `useListPageUrlState('comp')`. Trước 15/09/2026 là 'comprehensive', nên
    // `url.clearAll()` (xoá `comp_*`) không bao giờ chạm khoá của mặt lọc — "Xóa lọc" để sót lọc.
    prefix: 'comp',
    registry: comprehensiveListFilters,
  });
  const appliedFilters = listFilters.applied;
  const { fromDate, toDate } = appliedFilters;

  // Fetch LIST — fan-out theo typeFilter
  useEffect(() => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setTableState('loading');
    setError(undefined);

    const searchParam = thamSoTimKiem(debouncedSearch, theBat, JSON.parse(tkKey) as string[]);
    // Tìm kiếm + khoảng ngày của mặt lọc, theo tên tham số từng API.
    const thamSo = (loai: LoaiHoSo) => ({
      ...searchParam,
      ...thamSoNgay(loai, appliedFilters.fromDate, appliedFilters.toDate),
    });
    const coLoc =
      (theBat ? coThe : !!debouncedSearch) ||
      !!appliedFilters.fromDate ||
      !!appliedFilters.toDate;

    const fetchAll = async () => {
      try {
        if (typeFilter === RECORD_TYPE.CASE) {
          const res = await api.get<{ data: Parameters<typeof caseToUnified>[0][]; total: number }>(
            '/cases',
            {
              params: {
                ...thamSo('CASE'),
                limit: PAGE_SIZE,
                offset: (page - 1) * PAGE_SIZE,
              },
              signal: ctrl.signal,
            },
          );
          if (ctrl.signal.aborted) return;
          setRows(res.data.data.map(caseToUnified));
          setTotalCount(res.data.total);
          setTableState(
            res.data.total === 0
              ? coLoc || typeFilter
                ? 'empty-filtered'
                : 'empty'
              : 'ready',
          );
          return;
        }
        if (typeFilter === RECORD_TYPE.INCIDENT) {
          const res = await api.get<{
            data: Parameters<typeof incidentToUnified>[0][];
            total: number;
          }>('/incidents', {
            params: { ...thamSo('INCIDENT'), limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE },
            signal: ctrl.signal,
          });
          if (ctrl.signal.aborted) return;
          setRows(res.data.data.map(incidentToUnified));
          setTotalCount(res.data.total);
          setTableState(
            res.data.total === 0
              ? coLoc || typeFilter
                ? 'empty-filtered'
                : 'empty'
              : 'ready',
          );
          return;
        }
        if (typeFilter === RECORD_TYPE.PETITION) {
          const res = await api.get<{
            data: Parameters<typeof petitionToUnified>[0][];
            total: number;
          }>('/petitions', {
            params: { ...thamSo('PETITION'), limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE },
            signal: ctrl.signal,
          });
          if (ctrl.signal.aborted) return;
          setRows(res.data.data.map(petitionToUnified));
          setTotalCount(res.data.total);
          setTableState(
            res.data.total === 0
              ? coLoc || typeFilter
                ? 'empty-filtered'
                : 'empty'
              : 'ready',
          );
          return;
        }
        // "Tất cả" — fan-out + merge + client paginate. Preview-only mode:
        // - Fetch top MERGE_PREVIEW_PER_ENTITY mới nhất từ mỗi entity (server-sorted by createdAt desc by default)
        // - Pagination capped tại merged.length (review fix C1) thay vì sum server totals
        //   → user không bao giờ thấy "Trang 4/150 (empty)" do over-report
        // - Counts derived từ list .total (review fix C2) — KHÔNG fire stats endpoints riêng
        //   trong fan-out mode → tiết kiệm 3 request/keystroke
        const [cRes, iRes, pRes] = await Promise.all([
          api.get<{ data: Parameters<typeof caseToUnified>[0][]; total: number }>('/cases', {
            params: { ...thamSo('CASE'), limit: MERGE_PREVIEW_PER_ENTITY },
            signal: ctrl.signal,
          }),
          api.get<{ data: Parameters<typeof incidentToUnified>[0][]; total: number }>(
            '/incidents',
            { params: { ...thamSo('INCIDENT'), limit: MERGE_PREVIEW_PER_ENTITY }, signal: ctrl.signal },
          ),
          api.get<{ data: Parameters<typeof petitionToUnified>[0][]; total: number }>(
            '/petitions',
            { params: { ...thamSo('PETITION'), limit: MERGE_PREVIEW_PER_ENTITY }, signal: ctrl.signal },
          ),
        ]);
        if (ctrl.signal.aborted) return;
        const merged: UnifiedRow[] = [
          ...cRes.data.data.map(caseToUnified),
          ...iRes.data.data.map(incidentToUnified),
          ...pRes.data.data.map(petitionToUnified),
        ].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        // Derive counts directly từ list response totals — saves 3 stats requests.
        setCounts({
          cases: cRes.data.total,
          incidents: iRes.data.total,
          petitions: pRes.data.total,
        });
        const startIdx = (page - 1) * PAGE_SIZE;
        setRows(merged.slice(startIdx, startIdx + PAGE_SIZE));
        // Cap totalCount tại merged.length — pagination không vượt qua preview buffer.
        setTotalCount(merged.length);
        setTableState(
          merged.length === 0 ? (coLoc ? 'empty-filtered' : 'empty') : 'ready',
        );
      } catch (e: unknown) {
        if (ctrl.signal.aborted || axios.isCancel(e)) return;
        setError(getVietnameseErrorMessage(e));
        setTableState('error');
      }
    };

    void fetchAll();
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, page, debouncedSearch, theBat, tkKey, coThe, refetchCounter, appliedFilters]);

  // Stats fan-out CHỈ khi typeFilter được chọn — single-type mode cần stats endpoint
  // cho future per-status drill-down. Khi typeFilter == null (Tất cả), counts
  // đã derived từ list response totals trong fetchAll → không cần thêm 3 requests.
  // Review fix C2: tiết kiệm 3 requests/keystroke trong "Tất cả" mode.
  useEffect(() => {
    if (typeFilter == null) return; // Tất cả mode — counts come from list responses
    const ctrl = new AbortController();
    // CÙNG phần tìm kiếm + ngày với danh sách — lệch là số trên chip không khớp dòng.
    const tk = JSON.parse(tkKey) as string[];

    const safeGet = async (path: string, loai: LoaiHoSo) => {
      // Thẻ có khoá không phải của loại này (vd Trạng thái Vụ án) → KHÔNG gọi: máy chủ trả 400, và
      // đếm bỏ thẻ ấy thì ra một con số không lọc. Chip để trống số thay vì nói sai.
      if (theBat && !theHopLeCho(loai, typeFilter, tk)) return null;
      try {
        const res = await api.get<{ total: number }>(path, {
          params: {
            ...thamSoTimKiem(debouncedSearch, theBat, tk),
            ...thamSoNgay(loai, fromDate, toDate),
          },
          signal: ctrl.signal,
        });
        return res.data.total;
      } catch {
        return null;
      }
    };
    Promise.all([
      safeGet('/cases/stats', 'CASE'),
      safeGet('/incidents/stats', 'INCIDENT'),
      safeGet('/petitions/stats', 'PETITION'),
    ]).then(([cases, incidents, petitions]) => {
      if (ctrl.signal.aborted) return;
      setCounts({ cases, incidents, petitions });
    });
    return () => ctrl.abort();
  }, [debouncedSearch, theBat, typeFilter, tkKey, fromDate, toDate]);

  const chipOptions = useMemo(
    () => [
      {
        value: RECORD_TYPE.CASE,
        shortLabel: 'Vụ án',
        label: 'Vụ án',
        count: counts.cases ?? undefined,
      },
      {
        value: RECORD_TYPE.INCIDENT,
        shortLabel: 'Vụ việc',
        label: 'Vụ việc',
        count: counts.incidents ?? undefined,
      },
      {
        value: RECORD_TYPE.PETITION,
        shortLabel: 'Đơn thư',
        label: 'Đơn thư',
        count: counts.petitions ?? undefined,
      },
    ],
    [counts],
  );

  // Thiếu MỘT số (thống kê bị bỏ qua vì thẻ không áp cho loại ấy, hoặc lỗi) thì tổng là số sai —
  // để trống thay vì cộng thiếu.
  const totalChipCount = useMemo(() => {
    if (counts.cases == null || counts.incidents == null || counts.petitions == null) {
      return undefined;
    }
    return counts.cases + counts.incidents + counts.petitions;
  }, [counts]);

  const columns: ColumnDef<UnifiedRow>[] = useMemo(
    () => [
      {
        key: 'actions',
        header: 'Thao tác',
        width: BE_RONG_COT_THAO_TAC,
        // Bề rộng KHÔNG cho người dùng đặt: cột này chứa nút icon cỡ cố định, số lượng do ta
        // quyết. Bề rộng lưu trước khi thêm một nút sẽ cắt mất nút mới và không tự sửa —
        // ca hỏng thật 21/09/2026, ô lưu 113px cắt mất nút "In chứng từ" và nút ⋮.
        khongDoiBeRong: true,
        render: (r) => (
          <RowActions
            registry={comprehensiveRowActions}
            row={{
              id: r.id,
              recordType: r.recordType,
              caseNumber: r.caseNumber,
              name: r.name,
            }}
            ctx={actionCtx}
          />
        ),
      },
      {
        key: 'typeLabel',
        header: 'Loại',
        width: '7rem',
        optional: 'show',
        render: (r) => (
          <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
            {r.typeLabel}
          </span>
        ),
      },
      {
        key: 'caseNumber',
        header: 'Mã hồ sơ',
        timKiem: ['stt', 'sttCu'],
        width: '8rem',
        optional: 'show',
        render: (r) => <span className="font-mono text-xs text-slate-700">{r.caseNumber}</span>,
      },
      {
        key: 'name',
        header: 'Tên / Người gửi',
        width: '22rem',
        optional: 'show',
        render: (r) => <span className="font-medium text-slate-800">{r.name}</span>,
      },
      {
        key: 'status',
        header: 'Trạng thái',
        // Chỉ gợi ý khi đã chọn một loại — mã trạng thái mỗi loại khác nhau (KHAI_CHUNG bỏ kiểu chọn).
        timKiem: 'trangThai',
        width: '12rem',
        optional: 'show',
        render: (r) => (
          <span className={`inline-block px-2 py-0.5 rounded text-xs ${r.statusBadge}`}>
            {r.statusLabel}
          </span>
        ),
      },
      {
        key: 'createdBy',
        header: 'Người phụ trách',
        // Điều tra viên — chỉ Vụ án / Vụ việc có; gợi ý khi chọn một trong hai loại ấy.
        timKiem: 'dieuTraVien',
        width: '12rem',
        optional: 'show',
        render: (r) => r.createdBy,
      },
      {
        // Đọc `donViGiaiQuyet` ở cả ba loại — CÙNG cột thẻ lọc. Bản cũ đọc `unit` (đơn vị tiếp nhận,
        // gần như rỗng ở Vụ án) nên cột trống mà thẻ vẫn lọc một cột khác.
        key: 'district',
        header: 'Đơn vị giải quyết',
        timKiem: 'donViGiaiQuyet',
        width: '14rem',
        optional: 'show',
        render: (r) => r.district ?? '—',
      },
      {
        // Ẩn sẵn: có mặt vì ô lọc "Người tạo" đã thành thẻ — không cột nào mang `nguoiNhap` thì cán
        // bộ không còn lối chọn thẻ ấy (cổng timKiemCotKhai).
        key: 'nguoiNhap',
        header: 'Người nhập',
        timKiem: 'nguoiNhap',
        width: '12rem',
        optional: 'hide',
        render: (r) => r.nguoiNhap,
      },
      {
        key: 'receivedDate',
        header: 'Ngày tiếp nhận',
        width: '9rem',
        optional: 'show',
        render: (r) => formatVNDate(r.receivedDate),
      },
    ],
    [actionCtx],
  );
  // Bố cục cột lưu trên máy chủ theo tài khoản. Trang này trước đây chạy bố cục TỰ ĐỘNG và
  // hầu như không khai bề rộng — bật `fixedLayout` mà thiếu width thì phần dư bị chia đều và
  // bảng đổi hình. Bề rộng vừa khai ở khối trên đo từ dữ liệu thật 28/08/2026.
  const {
    coGhiDeBeRong,
    visibleColumns,
    toggleableColumns,
    isVisible,
    batTat,
    datBeRong,
    xoaBeRong,
    doiCho,
    datLai,
  } = useBoCucCot('comprehensive', columns);
  // Gợi ý của ô thẻ = cột đang hiện ∩ khai đang dùng (theo chip loại).
  const truongTimKiem = useMemo(
    () => truongGoiY(visibleColumns, khaiHienTai),
    [visibleColumns, khaiHienTai],
  );


  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const handleTypeChange = useCallback(
    (value: string | null) => {
      url.setParams({ type: value, page: '1' });
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
    // Thứ tự có nghĩa — `clearAll` phải là lần ghi URL cuối. Xem cổng xoaLocGhiUrlCuoi.gate.test.ts.
    listFilters.reset();
    url.clearAll();
  }, [url, listFilters]);

  const appliedFilterCount = Object.values(appliedFilters).filter((v) => v && v !== '').length;
  const activeFilterCount =
    (typeFilter ? 1 : 0) +
    // Chỉ đếm thẻ thật sự áp — thẻ đỏ không gửi đi thì không lọc gì.
    (theBat ? timKiem.theHopLe.length : searchQuery ? 1 : 0) +
    appliedFilterCount;

  const handleRowClick = useCallback(
    (r: UnifiedRow) => {
      if (r.recordType === RECORD_TYPE.CASE) navigate(`/cases/${r.id}`);
      else if (r.recordType === RECORD_TYPE.INCIDENT) navigate(`/incidents/${r.id}`);
      else navigate(`/petitions/${r.id}`);
    },
    [navigate],
  );

  return (
    <ListPageShell>
      <ListPageShell.Header
        icon={Layers}
        title="Tra cứu tổng hợp"
        subtitle="Tổng hợp Vụ án, Vụ việc và Đơn thư trên một danh sách duy nhất"
        actions={
          <button
            type="button"
            onClick={() => navigate('/cases/new')}
            className={`${BTN_PRIMARY} ${A11Y_FOCUS_RING} flex items-center gap-2`}
          >
            <Plus className="w-4 h-4" />
            <span>Tạo mới</span>
            <ShortcutHint action="newRecord" className="ml-1" />
          </button>
        }
      />
      <ListPageShell.StatusChips
        options={chipOptions}
        activeValue={typeFilter}
        onChange={handleTypeChange}
        totalCount={totalChipCount}
        countsLoading={counts.cases == null && counts.incidents == null && counts.petitions == null}
      />
      <ListPageShell.Toolbar
        searchValue={searchQuery}
        onSearchChange={handleSearchChange}
        searchSlot={
          theBat ? (
            <OTimKiemThe
              the={timKiem.the}
              truong={truongTimKiem}
              khai={khaiHienTai}
              giaTriChon={giaTriChon}
              onThem={timKiem.them}
              onBoThe={timKiem.boThe}
              onBoGiaTri={timKiem.boGiaTri}
              lyDoKhongHopLe={lyDoTheDo}
              placeholder="Tìm trong mọi cột — gõ rồi chọn cột (phím /)"
            />
          ) : undefined
        }
        searchPlaceholder="Tìm kiếm theo mã, tên, người gửi..."
        activeFilterCount={activeFilterCount}
        onResetFilters={handleResetFilters}
        columnPicker={
          <ColumnPicker
            columns={toggleableColumns}
            isVisible={isVisible}
            onToggle={batTat}
            onReset={datLai}
            onDoiCho={doiCho}
          />
        }
      >
        <Filters<ComprehensiveFilterValue>
          registry={comprehensiveListFilters}
          value={listFilters.draft}
          onChange={listFilters.setField}
          onApply={listFilters.apply}
          onReset={listFilters.reset}
          hasUnappliedChanges={listFilters.hasUnappliedChanges}
        />
      </ListPageShell.Toolbar>
      <ListPageShell.Table<UnifiedRow>
        state={tableState}
        fixedLayout
        onKeoGian={datBeRong}
        datTongBeRong={coGhiDeBeRong}
        onVeMacDinhCot={xoaBeRong}
        columns={visibleColumns}
        data={rows}
        rowKey={(r) => `${r.recordType}-${r.id}`}
        title="Tra cứu tổng hợp"
        totalCount={totalCount}
        error={error}
        emptyState={{
          title: 'Chưa có hồ sơ nào',
          description: 'Tạo hồ sơ đầu tiên trong hệ thống.',
          actionLabel: 'Tạo vụ án mới',
          onAction: () => navigate('/cases/new'),
        }}
        emptyFilteredState={{
          onClearFilters: handleResetFilters,
          chiTiet:
            timKiem.the.length > 0 ? (
              <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 text-sm text-slate-600">
                <span>Không tìm thấy với:</span>
                <DanhSachThe
                  the={timKiem.the}
                  khai={khaiHienTai}
                  giaTriChon={giaTriChon}
                  onBoThe={timKiem.boThe}
                  lyDoKhongHopLe={lyDoTheDo}
                />
              </div>
            ) : undefined,
        }}
        onRowClick={handleRowClick}
      />
      <ListPageShell.Pagination
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        onPageChange={handlePageChange}
      />
    </ListPageShell>
  );
}

export default ComprehensiveListPageShell;
