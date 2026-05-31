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
}: {
  sectionTitle?: string;
  totalCount?: number;
  displayCount?: number;
}) {
  if (!sectionTitle) return null;
  return (
    <div className={TABLE_SECTION_HEADER}>
      <h2 className={TABLE_SECTION_HEADER_TITLE}>{sectionTitle}</h2>
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
  children,
}: {
  sectionTitle?: string;
  totalCount?: number;
  displayCount?: number;
  children: ReactNode;
}) {
  return (
    <div className={TABLE_SECTION_CARD} data-testid="list-page-shell-table-card">
      <SectionHeader sectionTitle={sectionTitle} totalCount={totalCount} displayCount={displayCount} />
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
}: TableProps<TRow, TId>) {
  const { tableId } = useListPageShellContext();
  const colSpan = columns.length + (bulkSelection ? 1 : 0);
  // Only show count when table is ready — during loading data holds stale rows
  // from the previous fetch (parents don't reset rows to [] before refetch).
  const cardProps = { sectionTitle, totalCount, displayCount: state === 'ready' ? data.length : undefined };

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
        <table id={tableId} className={TABLE_BASE}>
          {title && (
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
                <th
                  key={col.key}
                  scope="col"
                  style={col.width ? { width: col.width } : undefined}
                  className={col.headerClassName ?? TABLE_HEADER_CELL}
                >
                  {col.header}
                </th>
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
              // [D2] Compute hover inline — skip default blue hover when
              // customClass present (e.g. OVERDUE_ROW_HIGHLIGHT has its own hover)
              const rowHover = customClass ? '' : 'hover:bg-blue-50';
              return (
                <tr
                  key={key}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`${rowHover} ${onRowClick ? 'cursor-pointer' : ''} ${
                    isSelected ? 'bg-blue-50' : ''
                  } ${customClass}`.trim()}
                >
                  {bulkSelection && (
                    <BulkSelectionRowCell
                      id={String(key)}
                      selection={bulkSelection}
                      rowLabel={bulkRowLabel?.(row)}
                      ineligibleReason={bulkRowEligible?.(row) ?? null}
                    />
                  )}
                  {columns.map((col) => (
                    <td key={col.key} className={col.cellClassName ?? TABLE_CELL}>
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
