/**
 * Shared CSS class constants used across the application.
 * Centralizes Tailwind class strings to reduce duplication and ensure consistency.
 * Adapted from Refs/constants/styles.ts
 */

// ─── Input & Form Field Styles ──────────────────────────────────────────────

export const INPUT_BASE =
  "w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500";

export const INPUT_WITH_ICON =
  "w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500";

export const INPUT_ERROR =
  "border-red-300 focus:ring-red-500";

export const INPUT_NORMAL =
  "border-slate-300 focus:ring-blue-500";

export const SELECT_BASE =
  "w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";

export const SELECT_WITH_ICON =
  "w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";

export const TEXTAREA_BASE =
  "w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500";

export const LABEL_BASE = "block text-sm font-medium text-slate-700 mb-2";

export const LABEL_REQUIRED_MARKER = "text-red-500";

export const FIELD_ERROR_TEXT = "text-xs text-red-600 mt-1";

// ─── Input with validation state ────────────────────────────────────────────

export function getInputClass(hasError: boolean, withIcon = false): string {
  const base = withIcon
    ? "w-full pl-9 pr-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2"
    : "w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2";
  return `${base} ${hasError ? INPUT_ERROR : INPUT_NORMAL}`;
}

export function getSelectClass(hasError: boolean, withIcon = false): string {
  const base = withIcon
    ? "w-full pl-9 pr-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 bg-white"
    : "w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 bg-white";
  return `${base} ${hasError ? INPUT_ERROR : INPUT_NORMAL}`;
}

// ─── Button Styles ──────────────────────────────────────────────────────────

export const BTN_PRIMARY =
  "px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium";

export const BTN_SECONDARY =
  "px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors";

export const BTN_OUTLINE_BLUE =
  "px-4 py-2.5 border border-blue-300 text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors";

export const BTN_OUTLINE_SLATE =
  "px-4 py-2.5 border border-slate-300 text-slate-700 bg-white rounded-lg hover:bg-slate-50 transition-colors";

export const BTN_DANGER =
  "px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors";

export const BTN_ICON_BLUE =
  "p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors";

export const BTN_ICON_RED =
  "p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors";

export const BTN_ICON_SLATE =
  "p-2 text-slate-600 hover:bg-slate-100 rounded transition-colors";

// ─── Card & Panel Styles ────────────────────────────────────────────────────

export const CARD_BASE =
  "bg-white rounded-lg border border-slate-200 shadow-sm p-6 space-y-6";

export const CARD_HEADER =
  "font-bold text-slate-800 border-b border-slate-200 pb-3";

export const CARD_HEADER_WITH_ACTIONS =
  "flex items-center justify-between border-b border-slate-200 pb-3";

export const SECTION_TITLE = "font-medium text-slate-700 mb-4";

// ─── Table Styles ───────────────────────────────────────────────────────────

// Mobile-responsive: scroll horizontally, extend to viewport edges on xs.
// Tables on list pages should wrap in this to handle narrow viewports.
export const TABLE_WRAPPER = "overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0";

export const TABLE_BASE = "w-full";

export const TABLE_HEADER = "bg-[#003973]/5 border-b border-slate-200";

// Note: dropped `uppercase` in PR1 — Vietnamese diacritics on uppercase letters
// (e.g. "Đ", "Â" với dấu mũ) become visually cramped. text-xs + font-semibold
// + tracking-wide đủ để tạo hierarchy mà không cần uppercase.
export const TABLE_HEADER_CELL =
  "px-4 py-3 text-left text-xs font-semibold tracking-wide text-[#003973]";

export const TABLE_BODY = "divide-y divide-slate-200";

export const TABLE_ROW = "hover:bg-blue-50";

export const TABLE_CELL = "px-4 py-3 text-sm text-slate-700";

export const TABLE_CELL_BOLD = "px-4 py-3 text-sm text-slate-800 font-medium";

export const TABLE_CELL_TRUNCATE =
  "px-4 py-3 text-sm text-slate-700 max-w-xs truncate";

// ─── Modal Styles ───────────────────────────────────────────────────────────
//
// Mobile-responsive defaults (autoplan v0.46 auto-decisions #14, #16):
// - z-40 keeps modals below the mobile drawer sidebar (z-50)
// - Full-screen on xs (<640px), centered card on sm+
// - dvh + @supports fallback covers older Android browsers (Samsung Internet, UC Browser)

export const MODAL_OVERLAY =
  "fixed inset-0 bg-black/50 flex items-center justify-center z-40 sm:p-4";

// Modal container (does NOT include max-w-*; pass maxWidth prop for that):
// - Mobile (<sm): full-width, full-height (no rounding, no margin)
// - Desktop (>=sm): centered card with rounded corners
// - max-h uses dvh on supporting browsers, falls back to vh elsewhere
export const MODAL_CONTAINER =
  "bg-white sm:rounded-lg shadow-xl w-full h-screen sm:h-auto sm:max-h-[90vh] sm:max-h-[90dvh] overflow-hidden flex flex-col";

export const MODAL_HEADER =
  "border-b border-slate-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between sticky top-0 bg-white z-10";

export const MODAL_BODY =
  "p-4 sm:p-6 space-y-4 overflow-y-auto flex-1";

export const MODAL_FOOTER =
  "border-t border-slate-200 px-4 sm:px-6 py-3 sm:py-4 flex justify-end gap-3 sticky bottom-0 bg-white";

// ─── Status Badge Styles ────────────────────────────────────────────────────

export const STATUS_BADGE_BASE = "px-2 py-1 rounded text-xs font-medium";

export const STATUS_COLORS: Record<string, string> = {
  green: "bg-green-100 text-green-700",
  blue: "bg-blue-100 text-blue-700",
  red: "bg-red-100 text-red-700",
  yellow: "bg-yellow-100 text-yellow-700",
  orange: "bg-orange-100 text-orange-700",
  purple: "bg-purple-100 text-purple-700",
  slate: "bg-slate-100 text-slate-700",
  amber: "bg-amber-100 text-amber-700",
};

// ─── Semantic Tokens (gray-* migration, PR1) ────────────────────────────────
//
// Defined before consumers (CASE_STATUS_COLORS, etc.) để các Record bên dưới
// có thể reference trực tiếp, tránh duplicate string value drift.

// Private primitive — muted slate register (review finding: drift trap nếu
// STATUS_ARCHIVED và STATUS_PENDING_RESPONSE duplicate literal string).
// Cả 2 semantic alias dưới reference token này → đổi 1 chỗ áp dụng toàn hệ.
const MUTED_SLATE = "text-slate-600 bg-slate-100";

// "Lưu trữ" — archived state (cases, incidents post-disposition).
export const STATUS_ARCHIVED = MUTED_SLATE;

// "Chưa phản hồi" — UTDT response not yet received. Muted, low-attention.
// Cùng visual register với STATUS_ARCHIVED qua MUTED_SLATE primitive — đổi
// MUTED_SLATE → cả 2 update; nếu cần fork sau này (dashboard composite view
// hiển thị cả 2 status cạnh nhau), thay bằng literal value.
export const STATUS_PENDING_RESPONSE = MUTED_SLATE;

// "Không khởi tố" — Incident decided NOT to prosecute. Solid neutral.
export const STATUS_NOT_PROSECUTED = "text-white bg-slate-600";

// ─── Case Status Colors ────────────────────────────────────────────────

export const CASE_STATUS_COLORS: Record<string, string> = {
  TIEP_NHAN: "text-blue-700 bg-blue-50",
  DANG_XAC_MINH: "text-cyan-700 bg-cyan-50",
  DA_XAC_MINH: "text-teal-700 bg-teal-50",
  DANG_DIEU_TRA: "text-amber-700 bg-amber-50",
  TAM_DINH_CHI: "text-orange-700 bg-orange-50",
  DINH_CHI: "text-red-700 bg-red-50",
  DA_KET_LUAN: "text-indigo-700 bg-indigo-50",
  DANG_TRUY_TO: "text-purple-700 bg-purple-50",
  DANG_XET_XU: "text-fuchsia-700 bg-fuchsia-50",
  DA_LUU_TRU: STATUS_ARCHIVED,
};

export const INCIDENT_STATUS_COLORS: Record<string, string> = {
  TIEP_NHAN: "bg-slate-800 text-white",
  DANG_XAC_MINH: "bg-amber-500 text-white",
  DA_GIAI_QUYET: "bg-green-600 text-white",
  TAM_DINH_CHI: "bg-orange-500 text-white",
  QUA_HAN: "bg-red-600 text-white",
  DA_CHUYEN_VU_AN: "bg-purple-600 text-white",
};

export const PETITION_STATUS_COLORS: Record<string, string> = {
  MOI_TIEP_NHAN: "text-blue-700 bg-blue-50",
  DANG_XU_LY: "text-amber-700 bg-amber-50",
  CHO_PHE_DUYET: "text-purple-700 bg-purple-50",
  DA_LUU_DON: "text-slate-600 bg-slate-50",
  DA_GIAI_QUYET: "text-green-700 bg-green-50",
  DA_CHUYEN_VU_VIEC: "text-cyan-700 bg-cyan-50",
  DA_CHUYEN_VU_AN: "text-indigo-700 bg-indigo-50",
};

// ─── Empty State ────────────────────────────────────────────────────────────

export const EMPTY_STATE_WRAPPER = "text-center py-12";

export const EMPTY_STATE_ICON = "w-12 h-12 text-slate-300 mx-auto mb-3";

export const EMPTY_STATE_TEXT = "text-slate-500";

export const EMPTY_STATE_SUBTEXT = "text-sm text-slate-400 mt-1";

// ─── Page Header ────────────────────────────────────────────────────────────

export const PAGE_HEADER =
  "bg-white border-b border-slate-200 px-6 py-4";

export const PAGE_TITLE = "text-2xl font-bold text-[#003973]";

export const PAGE_SUBTITLE = "text-sm text-slate-600 mt-1";

// ─── Tab Styles ─────────────────────────────────────────────────────────────

export const TAB_CONTAINER = "bg-white border-b border-slate-200 px-6";

export const TAB_LIST = "flex gap-1 overflow-x-auto";

export const TAB_ACTIVE =
  "flex items-center gap-2 px-4 py-3 border-b-2 border-blue-600 text-blue-600 font-medium transition-colors whitespace-nowrap";

export const TAB_INACTIVE =
  "flex items-center gap-2 px-4 py-3 border-b-2 border-transparent text-slate-600 hover:text-slate-800 hover:border-slate-300 transition-colors whitespace-nowrap";

export function getTabClass(isActive: boolean): string {
  return isActive ? TAB_ACTIVE : TAB_INACTIVE;
}

// ─── Filter Panel ───────────────────────────────────────────────────────────

export const FILTER_PANEL =
  "bg-slate-50 border border-slate-200 rounded-lg p-4";

export const FILTER_GRID = "grid grid-cols-1 md:grid-cols-3 gap-4";

// ─── Mobile-Responsive Sticky Table Columns ─────────────────────────────────

// Sticky first-column class for action columns. Apply to first <th> and first <td>
// so users can scroll horizontally while keeping the action column visible.
export const TABLE_STICKY_LEFT_TH =
  "sticky left-0 z-10 border-r border-slate-200 bg-[#003973]/5";
export const TABLE_STICKY_LEFT_TD =
  "sticky left-0 z-10 border-r border-slate-200 bg-white";

// ─── Icon Wrapper ───────────────────────────────────────────────────────────

export const ICON_INPUT_WRAPPER = "relative";

export const ICON_INPUT_POSITION =
  "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400";

// ─── List Page Card & Stats Tokens ─────────────────────────────────────────

// Card wrapper cho toolbar/table sections trên list pages.
export const STATS_CARD = "bg-white rounded-lg border border-slate-200 shadow-sm p-4";
// overflow-clip clips visual overflow cho rounded corners nhưng KHÔNG tạo
// scroll container mới — sticky positioning của BulkSelectionHeaderCell vẫn
// hoạt động đúng. overflow-hidden sẽ break sticky trong Safari/older Chrome.
export const TABLE_SECTION_CARD = "bg-white rounded-lg border border-slate-200 shadow-sm overflow-clip";
export const TABLE_SECTION_HEADER = "border-b border-slate-200 px-6 py-4";
export const TABLE_SECTION_HEADER_TITLE = "font-bold text-[#003973]";
export const TABLE_SECTION_HEADER_COUNT = "text-sm text-slate-600 mt-1";
export const TOOLBAR_CARD = "bg-white rounded-lg border border-slate-200 shadow-sm px-4 py-4";
export const TOOLBAR_STRIP = "bg-white border-b border-slate-200 px-4 py-3";

// ─── ListPageShell Tokens (PR1 foundation) ──────────────────────────────────
//
// Tokens powering the compound `<ListPageShell.*>` subcomponents.
// Added BEFORE shell build per autoplan design auto-decision #1.
//
// GUIDANCE (review finding): ListPageShell tokens live ở đây cho PR1 để tránh
// premature split. Khi token count >= 25 HOẶC styles.ts vượt 500 LOC, di chuyển
// sang `frontend/src/features/_shared/list-page-shell/tokens.ts`. Khoá ngưỡng
// để reviewers ở T10/T15 không bikeshed lại.

// ── Status chips bar ──────────────────────────────────────────────────────
// Container holds horizontally-scrolling chips (overflow-x-auto trên mobile).
// Fade mask edge phải báo hiệu còn chips offscreen — zero JS, Tailwind native.
// Khi scroll đến cuối, mask vẫn rendered nhưng visually consistent.
export const STATUS_CHIPS_BAR =
  "flex items-center gap-2 overflow-x-auto px-4 py-3 bg-white border-b border-slate-200 snap-x [mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)]";

// Single chip — base structure shared by active/inactive variants.
// max-w-[12rem] + truncate enforce shortLabel obligation (T4 scope) ở token
// level — nếu consumer thiếu shortLabel, chip vẫn truncate thay vì phá layout.
// py-2 text-sm cho ~40px touch target (WCAG 2.5.8 comfortable thumb).
//
// /investigate v0.61 fix: `shrink-0` ngăn parent flex bóp chip xuống dưới
// natural content width. Trước đây offsetWidth=70 < scrollWidth=91 do `flex`
// parent (STATUS_CHIPS_BAR) shrink children, kết hợp `truncate` (overflow:hidden)
// → clip count badge "0" sau text. Production bug: anh báo "Tất cả 0" thấy
// nhưng các chip còn lại không có count.
export const STATUS_CHIP_BASE =
  "inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap snap-start transition-colors motion-reduce:transition-none max-w-[12rem] shrink-0 truncate";

// Active chip — high-contrast filled.
export const STATUS_CHIP_ACTIVE =
  "bg-slate-900 text-white hover:bg-slate-800";

// Inactive chip — subtle background.
export const STATUS_CHIP_INACTIVE =
  "bg-slate-100 text-slate-700 hover:bg-slate-200";

// Count pill nested inside ACTIVE chip — bg-white/20 trên slate-900 → dim pill.
export const STATUS_CHIP_COUNT_ACTIVE =
  "ml-1 px-1.5 py-0.5 rounded-full text-xs font-semibold bg-white/20 tabular-nums";

// Count pill nested inside INACTIVE chip — bg-slate-200 trên slate-100 → visible pill.
// Tách riêng vì bg-white/20 trên slate-100 gần như invisible (review CRITICAL finding).
export const STATUS_CHIP_COUNT_INACTIVE =
  "ml-1 px-1.5 py-0.5 rounded-full text-xs font-semibold bg-slate-200 text-slate-700 tabular-nums";

// ── Bulk action bar ───────────────────────────────────────────────────────
// Sticky top desktop variant (default).
export const BULK_BAR_STICKY =
  "sticky top-0 z-20 flex items-center justify-between gap-3 px-4 py-3 bg-blue-50 border-b border-blue-200 shadow-sm";

// Sticky bottom mobile variant — thumb-reachable.
// pb-[calc(...)] respect iOS PWA safe-area-inset-bottom (home indicator).
// PC02 added PWA install support trong v0.46 — iOS users gặp home indicator.
// Consumer cũng cần `pb-[calc(env(safe-area-inset-bottom)+4rem)]` trên list
// content khi bar visible, tránh row cuối bị che.
export const BULK_BAR_MOBILE_BOTTOM =
  "fixed bottom-0 inset-x-0 z-30 flex items-center justify-between gap-3 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-blue-600 text-white shadow-lg sm:hidden";

// ── Filter accordion (renamed từ FILTER_PANEL_* — tránh collision với FILTER_PANEL bordered box) ──
// CSS grid accordion: grid-rows-[0fr] → [1fr] cho animation mượt mà không cần JS.
// motion-reduce: respect prefers-reduced-motion (WCAG 2.3.3).
// REQUIRED pattern:
//   <div className={isOpen ? FILTER_ACCORDION_EXPANDED : FILTER_ACCORDION_COLLAPSED}>
//     <div className={FILTER_ACCORDION_CONTENT}>...filter content...</div>
//   </div>
// FILTER_ACCORDION_CONTENT (overflow-hidden min-h-0) là BẮT BUỘC cho inner wrapper —
// thiếu thì children với default min-height vẫn hiện ra dù outer collapse.
export const FILTER_ACCORDION_COLLAPSED =
  "grid grid-rows-[0fr] transition-all duration-200 ease-out motion-reduce:transition-none motion-reduce:duration-0";

export const FILTER_ACCORDION_EXPANDED =
  "grid grid-rows-[1fr] transition-all duration-200 ease-out motion-reduce:transition-none motion-reduce:duration-0";

export const FILTER_ACCORDION_CONTENT = "overflow-hidden min-h-0";

// ── Accessibility focus ring ──────────────────────────────────────────────
// focus-visible (NOT focus:) tránh ring khi click bằng chuột.
export const A11Y_FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2";

// ── Overdue row highlight ─────────────────────────────────────────────────
// Apply qua getRowClassName trong ListPageShell.Table cho rows quá hạn.
// IMPORTANT (a11y): color alone không đủ — color-blind users + screen readers
// mất signal. Consumer pages BẮT BUỘC render thêm "Quá hạn" badge text trong
// deadline cell + dùng OVERDUE_DEADLINE_CELL cho cell typography.
// TODO(T11/ListPageShell.Table): emit dev warning khi OVERDUE_ROW_HIGHLIGHT
// applied mà row không có Quá hạn badge trong deadline cell.
export const OVERDUE_ROW_HIGHLIGHT =
  "bg-red-50 hover:bg-red-100";

// Deadline cell typography for overdue rows — pair với OVERDUE_ROW_HIGHLIGHT
// để có 3 signals đồng thời (row bg + cell text + badge text) cho a11y.
export const OVERDUE_DEADLINE_CELL = "text-red-900 font-semibold";

// ── Pagination ────────────────────────────────────────────────────────────
export const PAGINATION_BAR =
  "flex items-center justify-between gap-3 px-4 py-3 bg-white border-t border-slate-200 text-sm text-slate-600";

// py-2 cho ~40px touch target — pagination button mis-tap = lost scroll position.
export const PAGINATION_BUTTON =
  "inline-flex items-center gap-1 px-3 py-2 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed";
