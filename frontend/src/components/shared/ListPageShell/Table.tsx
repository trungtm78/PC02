/**
 * <ListPageShell.Table> — data table với state machine.
 *
 * States: loading | error | empty | empty-filtered | offline | ready.
 *
 * A11y:
 * - table id từ Context tableId → matches StatusChips aria-controls
 * - caption sr-only chứa title + totalCount
 *
 * Mobile: defer to consumer (T16+) — current implementation desktop-first table.
 */
import { type ReactNode } from 'react';
import { AlertCircle, Inbox, WifiOff, FilterX } from 'lucide-react';
import {
  BulkSelectionHeaderCell,
  BulkSelectionRowCell,
} from '@/features/_shared/bulk/BulkSelectionColumn';
import type { UseBulkSelectionResult } from '@/features/_shared/bulk/useBulkSelection';
import {
  TABLE_WRAPPER,
  TABLE_BASE,
  TABLE_HEADER,
  TABLE_HEADER_CELL,
  TABLE_HEADER_STICKY_BG,
  TABLE_BODY,
  TABLE_CELL,
  TABLE_SECTION_CARD,
  TABLE_SECTION_HEADER,
  TABLE_SECTION_HEADER_TITLE,
  TABLE_SECTION_HEADER_COUNT,
  EMPTY_STATE_WRAPPER,
  EMPTY_STATE_ICON,
  EMPTY_STATE_TEXT,
  EMPTY_STATE_SUBTEXT,
  BTN_PRIMARY,
  BTN_OUTLINE_SLATE,
  A11Y_FOCUS_RING,
} from '@/constants/styles';
import { SortableHeader } from './SortableHeader';
import { useListPageShellContext } from './ListPageShell';

export type TableState = 'loading' | 'error' | 'empty' | 'empty-filtered' | 'offline' | 'ready';

export interface ColumnDef<TRow> {
  key: string;
  header: string;
  render(row: TRow): ReactNode;
  /** Column width hint (CSS value). */
  width?: string;
  /** Header className override. */
  headerClassName?: string;
  /** Cell className override. */
  cellClassName?: string;
  /**
   * Tên trường gửi lên máy chủ khi bấm tiêu đề cột này để sắp xếp.
   * Không khai thì tiêu đề là chữ trơn, không bấm được (vd cột "Thao tác").
   * Phải nằm trong danh sách trắng của module ở backend, nếu không máy chủ bỏ qua.
   */
  sortKey?: string;
  /**
   * Ghim cột này ở mép trái khi bảng cuộn ngang.
   *
   * Neo ở `left-10` vì ô tick đứng trước và rộng `w-10`. Chỉ dùng cho cột điều khiển (Thao
   * tác) — ghim thừa một cột dữ liệu là che mất chính dữ liệu đang cuộn.
   */
  sticky?: boolean;
}

export interface TableProps<TRow, TId extends string | number = string> {
  state: TableState;
  columns: ColumnDef<TRow>[];
  data: TRow[];
  rowKey(row: TRow): TId;
  /** Title for sr-only caption. */
  title?: string;
  /** Total count for sr-only caption and "Hiển thị X / Y" display. */
  totalCount?: number;
  /** Section header title inside card (e.g. "Danh sách vụ án"). */
  sectionTitle?: string;
  /** Error message (state=error). */
  error?: string;
  /** Trường đang sắp (tên gửi lên máy chủ). Bỏ trống = dùng mặc định của máy chủ. */
  sortBy?: string;
  /** Chiều đang sắp. Mặc định 'desc'. */
  sortOrder?: 'asc' | 'desc';
  /** Bấm tiêu đề cột. KHÔNG truyền thì mọi tiêu đề đều là chữ trơn (giữ nguyên như cũ). */
  onSort?: (key: string) => void;
  /** Empty state CTA (state=empty). */
  emptyState?: {
    title: string;
    description?: string;
    actionLabel?: string;
    onAction?(): void;
  };
  /** Filtered-empty state CTA (state=empty-filtered). */
  emptyFilteredState?: {
    onClearFilters(): void;
  };
  onRowClick?(row: TRow): void;
  getRowClassName?(row: TRow): string;
  /**
   * /investigate v0.61 fix — bulk selection integration. When passed, table
   * prepends sticky-left checkbox column (header + per-row). Pair with
   * BulkActionBar consumer-side for actions UI.
   */
  bulkSelection?: UseBulkSelectionResult;
  /** Pluralized label for header aria-label ("vụ án", "vụ việc"...). */
  bulkRowsLabel?: string;
  /** Per-row label for checkbox aria-label ("vụ án PC02-001"...). */
  bulkRowLabel?(row: TRow): string;
  /** Per-row eligibility hint — return null=eligible, string=disabled+tooltip. */
  bulkRowEligible?(row: TRow): string | null;
}

function LoadingSkeleton({ colCount }: { colCount: number }) {
  return (
    <div data-testid="list-page-shell-table-loading" className="py-12 px-4 space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-3 animate-pulse">
          {Array.from({ length: colCount }).map((__, j) => (
            <div key={j} className="h-4 bg-slate-200 rounded flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

function ErrorState({ error }: { error?: string }) {
  return (
    <div
      data-testid="list-page-shell-table-error"
      role="alert"
      className={EMPTY_STATE_WRAPPER}
    >
      <AlertCircle className={`${EMPTY_STATE_ICON} text-red-400`} aria-hidden="true" />
      <p className={`${EMPTY_STATE_TEXT} text-red-700`}>Có lỗi xảy ra khi tải dữ liệu</p>
      {error && <p className={EMPTY_STATE_SUBTEXT}>{error}</p>}
    </div>
  );
}

function EmptyState({ emptyState }: { emptyState?: TableProps<unknown>['emptyState'] }) {
  return (
    <div data-testid="list-page-shell-table-empty" className={EMPTY_STATE_WRAPPER}>
      <Inbox className={EMPTY_STATE_ICON} aria-hidden="true" />
      <p className={EMPTY_STATE_TEXT}>{emptyState?.title ?? 'Chưa có dữ liệu'}</p>
      {emptyState?.description && (
        <p className={EMPTY_STATE_SUBTEXT}>{emptyState.description}</p>
      )}
      {emptyState?.actionLabel && emptyState.onAction && (
        <button
          type="button"
          onClick={emptyState.onAction}
          className={`${BTN_PRIMARY} ${A11Y_FOCUS_RING} mt-4`}
        >
          {emptyState.actionLabel}
        </button>
      )}
    </div>
  );
}

function EmptyFilteredState({
  emptyFilteredState,
}: {
  emptyFilteredState?: TableProps<unknown>['emptyFilteredState'];
}) {
  return (
    <div
      data-testid="list-page-shell-table-empty-filtered"
      className={EMPTY_STATE_WRAPPER}
    >
      <FilterX className={EMPTY_STATE_ICON} aria-hidden="true" />
      <p className={EMPTY_STATE_TEXT}>Không có kết quả phù hợp bộ lọc</p>
      <p className={EMPTY_STATE_SUBTEXT}>Thử xoá bộ lọc hoặc đổi từ khoá tìm kiếm.</p>
      {emptyFilteredState?.onClearFilters && (
        <button
          type="button"
          onClick={emptyFilteredState.onClearFilters}
          className={`${BTN_OUTLINE_SLATE} ${A11Y_FOCUS_RING} mt-4`}
        >
          Xóa bộ lọc
        </button>
      )}
    </div>
  );
}

function OfflineState() {
  return (
    <div
      data-testid="list-page-shell-table-offline"
      role="status"
      className={EMPTY_STATE_WRAPPER}
    >
      <WifiOff className={`${EMPTY_STATE_ICON} text-amber-500`} aria-hidden="true" />
      <p className={EMPTY_STATE_TEXT}>Không có kết nối mạng (offline)</p>
      <p className={EMPTY_STATE_SUBTEXT}>Hiển thị dữ liệu cache. Kết nối lại để cập nhật.</p>
    </div>
  );
}

function SectionHeader({
  sectionTitle,
  totalCount,
  displayCount,
  headingId,
}: {
  sectionTitle?: string;
  totalCount?: number;
  displayCount?: number;
  headingId?: string;
}) {
  if (!sectionTitle) return null;
  return (
    <div className={TABLE_SECTION_HEADER}>
      <h2 id={headingId} className={TABLE_SECTION_HEADER_TITLE}>{sectionTitle}</h2>
      {totalCount != null && displayCount != null && (
        <p className={TABLE_SECTION_HEADER_COUNT}>
          Hiển thị {displayCount} / {totalCount} bản ghi
        </p>
      )}
    </div>
  );
}

function StateCard({
  sectionTitle,
  totalCount,
  displayCount,
  headingId,
  children,
}: {
  sectionTitle?: string;
  totalCount?: number;
  displayCount?: number;
  headingId?: string;
  children: ReactNode;
}) {
  return (
    <div className={TABLE_SECTION_CARD} data-testid="list-page-shell-table-card">
      <SectionHeader sectionTitle={sectionTitle} totalCount={totalCount} displayCount={displayCount} headingId={headingId} />
      {children}
    </div>
  );
}

export function Table<TRow, TId extends string | number = string>({
  state,
  columns,
  data,
  rowKey,
  title,
  totalCount,
  sectionTitle,
  error,
  emptyState,
  emptyFilteredState,
  onRowClick,
  getRowClassName,
  bulkSelection,
  bulkRowsLabel,
  bulkRowLabel,
  bulkRowEligible,
  sortBy,
  sortOrder,
  onSort,
}: TableProps<TRow, TId>) {
  const { tableId } = useListPageShellContext();
  // Ô ghim buộc phải có nền ĐỤC, nếu không nội dung cuộn bên dưới hiện xuyên qua. Nền phải
  // là nền THẬT của hàng chứ không phải màu cứng — xem chú thích ở `nenHang` bên dưới.
  const LOP_GHIM = 'sticky left-10 z-[1]';
  // Nền ô ghim: bám theo nền hàng thay vì khai màu riêng. Xem chú thích ở `nenHang`.
  const NEN_O_GHIM = 'bg-inherit';
  const colSpan = columns.length + (bulkSelection ? 1 : 0);
  // Only show count when table is ready — during loading data holds stale rows
  // from the previous fetch (parents don't reset rows to [] before refetch).
  // headingId: when sectionTitle is provided, the h2 serves as the accessible
  // label for the table via aria-labelledby, eliminating the duplicate sr-only caption.
  const headingId = sectionTitle ? `${tableId}-heading` : undefined;
  const cardProps = { sectionTitle, totalCount, displayCount: state === 'ready' ? data.length : undefined, headingId };

  if (state === 'loading') return (
    <StateCard {...cardProps}><LoadingSkeleton colCount={colSpan} /></StateCard>
  );
  if (state === 'error') return (
    <StateCard {...cardProps}><ErrorState error={error} /></StateCard>
  );
  if (state === 'empty') return (
    <StateCard {...cardProps}><EmptyState emptyState={emptyState} /></StateCard>
  );
  if (state === 'empty-filtered') return (
    <StateCard {...cardProps}><EmptyFilteredState emptyFilteredState={emptyFilteredState} /></StateCard>
  );
  if (state === 'offline') return (
    <StateCard {...cardProps}><OfflineState /></StateCard>
  );

  // state === 'ready'
  return (
    <StateCard {...cardProps}>
      <div className={TABLE_WRAPPER}>
        <table
          id={tableId}
          className={TABLE_BASE}
          aria-labelledby={headingId}
        >
          {/* sr-only caption only when no visible h2 (sectionTitle) exists to label the table.
              When headingId is set, aria-labelledby on the table references the h2 instead. */}
          {title && !headingId && (
            <caption className="sr-only">
              {title}
              {totalCount != null ? ` — ${totalCount} bản ghi` : ''}
            </caption>
          )}
          <thead className={TABLE_HEADER}>
            <tr>
              {bulkSelection && (
                <BulkSelectionHeaderCell
                  selection={bulkSelection}
                  totalRowsLabel={bulkRowsLabel}
                />
              )}
              {columns.map((col) => (
                <SortableHeader
                  key={col.key}
                  label={col.header}
                  // Chỉ cột nào khai sortKey VÀ trang có truyền onSort mới bấm được.
                  sortKey={onSort ? col.sortKey : undefined}
                  sort={{ sortBy, sortOrder: sortOrder ?? 'desc' }}
                  onSort={onSort ?? (() => {})}
                  width={col.width}
                  className={`${col.headerClassName ?? TABLE_HEADER_CELL} ${
                    col.sticky ? `${LOP_GHIM} ${TABLE_HEADER_STICKY_BG}` : ''
                  }`.trim()}
                />
              ))}
            </tr>
          </thead>
          <tbody className={TABLE_BODY}>
            {data.map((row) => {
              const key = rowKey(row);
              const customClass = getRowClassName?.(row) ?? '';
              const isSelected = bulkSelection
                ? bulkSelection.isSelected(String(key))
                : false;
              // [D2] Compute hover inline — skip default blue hover when customClass
              // is non-empty. Using .length > 0 instead of truthy to be explicit:
              // empty string = no custom class = apply default hover.
              // Contract: if getRowClassName returns a non-empty string containing
              // a background override, it should include its own hover:* variant.
              const rowHover = customClass.length > 0 ? '' : 'hover:bg-blue-50';
              // Hàng LUÔN phải có nền đục khai rõ, không được để trong suốt.
              //
              // Ô ghim dùng `bg-inherit` để bám theo nền hàng (xem NEN_O_GHIM). `inherit`
              // lấy giá trị TÍNH ĐƯỢC của hàng, nên nó tự đúng cả khi rê chuột — chép lớp
              // nền sang ô thì `hover:` chỉ ăn khi trỏ đúng ô ấy, rê ở ô khác là hàng đổi
              // màu mà ô ghim vẫn trắng. Nhưng `inherit` trên một hàng TRONG SUỐT thì cho
              // ra trong suốt, và nội dung cuộn ngang hiện xuyên qua ô ghim. Vì vậy nền mặc
              // định `bg-white` dưới đây là điều kiện CẦN, không phải trang trí.
              const nenHang = customClass.length > 0
                ? ''
                : isSelected
                  ? 'bg-blue-50'
                  : 'bg-white';
              return (
                <tr
                  key={key}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`${rowHover} ${onRowClick ? 'cursor-pointer' : ''} ${
                    nenHang
                  } ${customClass}`.trim()}
                >
                  {bulkSelection && (
                    <BulkSelectionRowCell
                      id={String(key)}
                      selection={bulkSelection}
                      rowLabel={bulkRowLabel?.(row)}
                      ineligibleReason={bulkRowEligible?.(row) ?? null}
                      bgClass={NEN_O_GHIM}
                    />
                  )}
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`${col.cellClassName ?? TABLE_CELL} ${
                        col.sticky ? `${LOP_GHIM} ${NEN_O_GHIM}` : ''
                      }`.trim()}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </StateCard>
  );
}
