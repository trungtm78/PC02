/**
 * Pure filtering rules for the "phân loại khác" screen.
 *
 * In their own file for two reasons: `react-refresh/only-export-components`
 * (a component module should export components), and so the tests import the
 * code the page runs. An earlier test file reimplemented these rules locally,
 * which meant reverting the page would have left every test green.
 */
export interface OtherCase {
  id: string;
  stt: number;
  caseName: string;
  type: string;
  district: string;
  reportedBy: string;
  /** dd/MM/yyyy — chỉ để hiển thị. */
  reportedDate: string;
  /**
   * yyyy-MM-dd, dùng cho bộ lọc.
   *
   * Bộ lọc trước so `reportedDate` (dd/MM/yyyy) với giá trị của <input
   * type="date"> (yyyy-MM-dd) bằng phép so chuỗi, nên nó chưa bao giờ lọc
   * đúng — "10/08/2026" < "2026-08-01" là true vì '1' < '2'.
   */
  reportedDateISO: string;
  status: "pending" | "processing" | "resolved" | "archived";
  statusLabel: string;
  category: string;
}

export interface FilterData {
  quickSearch: string;
  fromDate: string;
  toDate: string;
  district: string;
  status: string;
  category: string;
}

/**
 * Exported so the tests exercise the code the page runs, not a copy of it.
 *
 * A previous version of the test file reimplemented these rules locally, which
 * meant reverting the page would have left every test green — the tests were
 * measuring themselves.
 */
export function applyFilters(
  rows: OtherCase[],
  filters: FilterData,
): OtherCase[] {
  return rows.filter((item) => {
    if (filters.quickSearch) {
      const searchLower = filters.quickSearch.toLowerCase();
      const matchesSearch =
        String(item.stt).toLowerCase().includes(searchLower) ||
        item.caseName.toLowerCase().includes(searchLower) ||
        item.type.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }

    // Compared on the ISO string, never on the dd/MM/yyyy display string.
    if (filters.fromDate && item.reportedDateISO < filters.fromDate) {
      return false;
    }
    if (filters.toDate && item.reportedDateISO > filters.toDate) return false;
    if (filters.district && item.district !== filters.district) return false;
    if (filters.status && item.status !== filters.status) return false;
    if (filters.category && item.category !== filters.category) return false;

    return true;
  });
}

/** Category options, derived from the rows actually loaded. */
export function deriveCategories(rows: { category: string }[]): string[] {
  return [...new Set(rows.map((r) => r.category).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "vi"),
  );
}

