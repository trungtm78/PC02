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

export const TABLE_WRAPPER = "overflow-x-auto";

export const TABLE_BASE = "w-full";

export const TABLE_HEADER = "bg-slate-50 border-b border-slate-200";

export const TABLE_HEADER_CELL =
  "px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase";

export const TABLE_BODY = "divide-y divide-slate-200";

export const TABLE_ROW = "hover:bg-slate-50";

export const TABLE_CELL = "px-4 py-3 text-sm text-slate-700";

export const TABLE_CELL_BOLD = "px-4 py-3 text-sm text-slate-800 font-medium";

export const TABLE_CELL_TRUNCATE =
  "px-4 py-3 text-sm text-slate-700 max-w-xs truncate";

// ─── Modal Styles ───────────────────────────────────────────────────────────

export const MODAL_OVERLAY =
  "fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4";

export const MODAL_CONTAINER =
  "bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden";

export const MODAL_HEADER =
  "border-b border-slate-200 px-6 py-4 flex items-center justify-between";

export const MODAL_BODY =
  "p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-140px)]";

export const MODAL_FOOTER =
  "border-t border-slate-200 px-6 py-4 flex justify-end gap-3";

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
  DA_LUU_TRU: "text-gray-600 bg-gray-50",
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

export const PAGE_TITLE = "text-2xl font-bold text-slate-800";

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

// ─── Icon Wrapper ───────────────────────────────────────────────────────────

export const ICON_INPUT_WRAPPER = "relative";

export const ICON_INPUT_POSITION =
  "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400";
