/**
 * ListPageShell — compound component entry point.
 *
 * Assemble subcomponents thành ListPageShell.* API qua Object.assign,
 * tránh circular import (subcomponents import { useListPageShellContext }
 * trực tiếp từ ./ListPageShell, không qua index).
 */
import { ListPageShell as Root, useListPageShellContext } from './ListPageShell';
import { Header } from './Header';
import { StatusChips } from './StatusChips';
import { Toolbar } from './Toolbar';
import { BulkBar } from './BulkBar';
import { Table } from './Table';
import { Pagination } from './Pagination';
import { AlertBanners, TransientBanners } from './Banners';

type ListPageShellType = typeof Root & {
  Header: typeof Header;
  StatusChips: typeof StatusChips;
  Toolbar: typeof Toolbar;
  BulkBar: typeof BulkBar;
  Table: typeof Table;
  Pagination: typeof Pagination;
  AlertBanners: typeof AlertBanners;
  TransientBanners: typeof TransientBanners;
};

// /* @__PURE__ */ annotation báo Rollup/Vite Object.assign expression không có
// side-effects observable bên ngoài → safe to tree-shake nếu consumer không
// dùng. Without annotation, bundler conservatively pulls toàn bộ 8 subcomponents
// kể cả khi consumer chỉ import { useListPageUrlState } (perf review finding).
const ListPageShell = /* @__PURE__ */ Object.assign(Root, {
  Header,
  StatusChips,
  Toolbar,
  BulkBar,
  Table,
  Pagination,
  AlertBanners,
  TransientBanners,
}) as ListPageShellType;

export { ListPageShell, useListPageShellContext };
export type { ListPageShellContextValue } from './ListPageShell';
export type { HeaderProps } from './Header';
export type { StatusChipsProps, StatusChipOption } from './StatusChips';
export type { ToolbarProps } from './Toolbar';
export type { BulkBarProps, BulkAction } from './BulkBar';
export type { TableProps, ColumnDef, TableState } from './Table';
export type { PaginationProps } from './Pagination';
export type { BannersProps } from './Banners';
export { useListPageUrlState } from './useListPageUrlState';
export { useListSort } from './useListSort';
export type { ListSort } from './useListSort';
export { resolveNextSort } from './sortState';
export type { SortState, SortDirection } from './sortState';
export { DateCell } from './DateCell';
export { isImplausibleDate } from './implausibleDate';
export { SortableHeader } from './SortableHeader';
export type { ListPageUrlState } from './useListPageUrlState';
// F3 shared utilities (post-PR5 cleanup) — see listPageUtils.ts
export {
  getVietnameseErrorMessage,
  sanitizeStringParam,
  sanitizeEnumParam,
  sanitizeDateParam,
  LIST_PAGE_SIZE,
  SEARCH_DEBOUNCE_MS,
} from './listPageUtils';
