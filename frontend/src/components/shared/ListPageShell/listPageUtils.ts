/**
 * Shared utilities for ListPageShell consumers.
 *
 * Extracted from 6+ shell pages (Cases/Incidents/Petitions/Comprehensive/UTDT/
 * Lawyers/Objects) where the same patterns were duplicated. F3 follow-up
 * (post-PR5) of the ListPageShell plan.
 */
import axios from 'axios';

/**
 * Map axios errors to Vietnamese messages. Customize fallback message via
 * `resourceLabel` (e.g. "vụ án", "luật sư", "đối tượng").
 */
export function getVietnameseErrorMessage(e: unknown, resourceLabel = 'dữ liệu'): string {
  if (axios.isAxiosError(e)) {
    const status = e.response?.status;
    if (status === 401) return 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại';
    if (status === 403) return 'Bạn không có quyền xem dữ liệu này';
    if (status && status >= 500) return 'Lỗi máy chủ, vui lòng thử lại sau';
    const serverMsg = (e.response?.data as { message?: string } | undefined)?.message;
    if (serverMsg) return serverMsg;
    if (e.code === 'ECONNABORTED') return 'Quá thời gian chờ, vui lòng thử lại';
    return `Không tải được danh sách ${resourceLabel}`;
  }
  return 'Lỗi không xác định';
}

/**
 * Strip ASCII control chars (0x00-0x1F + DEL 0x7F) from URL string params,
 * cap length. Trust boundary for free-text URL fields.
 */
export function sanitizeStringParam(v: string | null, maxLen = 200): string {
  if (v == null) return '';
  // eslint-disable-next-line no-control-regex
  return v.replace(/[\x00-\x1f\x7f]/g, '').slice(0, maxLen);
}

/**
 * Validate enum-shaped URL params against a Set of allowed values. Returns
 * empty string if invalid (degrade to "no filter" trust boundary pattern).
 */
export function sanitizeEnumParam(v: string | null, values: Set<string>): string {
  return v != null && values.has(v) ? v : '';
}

/**
 * Validate ISO YYYY-MM-DD date param + calendar-valid. Rejects 2026-02-30 etc.
 */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export function sanitizeDateParam(v: string | null): string {
  if (v == null || !ISO_DATE_RE.test(v)) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? '' : v;
}

/** Default list page pagination constant. */
export const LIST_PAGE_SIZE = 20;

/** Default search debounce (ms). */
export const SEARCH_DEBOUNCE_MS = 300;
