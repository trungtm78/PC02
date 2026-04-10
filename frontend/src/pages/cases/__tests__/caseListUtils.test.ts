/**
 * TASK-2026-022601 — Unit Tests: CaseListPage Filter Logic & Overdue Badge
 * Coverage target: 85%+
 * Framework: Vitest
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

// ─── Pure helpers replicated from CaseListPage.tsx ───────────────────────────

function isOverdue(deadline: string): boolean {
  const deadlineDate = new Date(deadline);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return deadlineDate < today;
}

function getDaysOverdue(deadline: string): number {
  const deadlineDate = new Date(deadline);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffTime = today.getTime() - deadlineDate.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

interface Case {
  id: string;
  name: string;
  status: string;
  investigator: string;
  dateCreated: string; // "DD/MM/YYYY"
  charges: string;
  investigationDeadline: string; // "YYYY-MM-DD"
  unit: string;
  suspectCount: number;
}

interface Filters {
  fromDate: string;
  toDate: string;
  unit: string;
  investigator: string;
  charges: string;
}

function filterCases(
  cases: Case[],
  searchQuery: string,
  selectedStatus: string,
  filters: Filters
): Case[] {
  return cases.filter((c) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      c.id.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      c.investigator.toLowerCase().includes(q);
    const matchesStatus = selectedStatus === "all" || c.status === selectedStatus;

    // dateCreated is "DD/MM/YYYY" → convert to "YYYY-MM-DD"
    const parsedDate = new Date(c.dateCreated.split("/").reverse().join("-"));
    const matchesFromDate = !filters.fromDate || parsedDate >= new Date(filters.fromDate);
    const matchesToDate = !filters.toDate || parsedDate <= new Date(filters.toDate);
    const matchesUnit = !filters.unit || c.unit === filters.unit;
    const matchesInvestigator = !filters.investigator || c.investigator === filters.investigator;
    const matchesCharges = !filters.charges || c.charges === filters.charges;

    return matchesSearch && matchesStatus && matchesFromDate && matchesToDate && matchesUnit && matchesInvestigator && matchesCharges;
  });
}

// ─── Mock data ───────────────────────────────────────────────────────────────

const MOCK_CASES: Case[] = [
  {
    id: "VA-2026-001",
    name: "Vụ án trộm cắp tài sản tại quận 1",
    status: "Đang điều tra",
    investigator: "Nguyễn Văn Thành",
    dateCreated: "01/02/2026",
    charges: "Trộm cắp tài sản (Điều 173)",
    investigationDeadline: "2026-02-20",
    unit: "Công an Quận 1",
    suspectCount: 2,
  },
  {
    id: "VA-2026-002",
    name: "Vụ án lừa đảo chiếm đoạt tài sản",
    status: "Chờ xét xử",
    investigator: "Trần Thị Mai",
    dateCreated: "03/02/2026",
    charges: "Lừa đảo chiếm đoạt tài sản (Điều 174)",
    investigationDeadline: "2026-02-15",
    unit: "Công an Quận 3",
    suspectCount: 1,
  },
  {
    id: "VA-2026-003",
    name: "Vụ án vi phạm quy định về PCCC",
    status: "Đang điều tra",
    investigator: "Lê Văn Hùng",
    dateCreated: "05/02/2026",
    charges: "Vi phạm quy định PCCC (Điều 313)",
    investigationDeadline: "2026-03-05",
    unit: "Công an Quận 5",
    suspectCount: 1,
  },
  {
    id: "VA-2026-004",
    name: "Vụ án gây rối trật tự công cộng",
    status: "Đã kết thúc",
    investigator: "Phạm Thị Lan",
    dateCreated: "02/02/2026",
    charges: "Gây rối trật tự công cộng (Điều 318)",
    investigationDeadline: "2026-02-10",
    unit: "Công an Quận 10",
    suspectCount: 3,
  },
  {
    id: "VA-2026-005",
    name: "Vụ án buôn lậu qua biên giới",
    status: "Đang điều tra",
    investigator: "Hoàng Văn Nam",
    dateCreated: "04/02/2026",
    charges: "Buôn lậu (Điều 188)",
    investigationDeadline: "2026-02-18",
    unit: "Công an TP.HCM",
    suspectCount: 5,
  },
];

const EMPTY_FILTERS: Filters = {
  fromDate: "",
  toDate: "",
  unit: "",
  investigator: "",
  charges: "",
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("isOverdue()", () => {
  beforeAll(() => {
    // Fix "today" to 2026-02-26 for deterministic tests
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-26T12:00:00.000Z"));
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("returns true when deadline is before today", () => {
    expect(isOverdue("2026-02-20")).toBe(true);
  });

  it("returns true when deadline is yesterday", () => {
    expect(isOverdue("2026-02-25")).toBe(true);
  });

  it("returns false when deadline is today", () => {
    expect(isOverdue("2026-02-26")).toBe(false);
  });

  it("returns false when deadline is tomorrow", () => {
    expect(isOverdue("2026-02-27")).toBe(false);
  });

  it("returns false when deadline is far in the future", () => {
    expect(isOverdue("2027-12-31")).toBe(false);
  });

  it("returns true for a deadline in the distant past", () => {
    expect(isOverdue("2020-01-01")).toBe(true);
  });
});

describe("getDaysOverdue()", () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-26T12:00:00.000Z"));
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("returns positive number of days when overdue", () => {
    // 2026-02-20 → 6 days before 2026-02-26
    expect(getDaysOverdue("2026-02-20")).toBe(6);
  });

  it("returns 1 when deadline was yesterday", () => {
    expect(getDaysOverdue("2026-02-25")).toBe(1);
  });

  it("returns 0 or negative when deadline is today (not overdue)", () => {
    // Due to UTC/local timezone differences, today's deadline may return -0 or 0
    expect(Math.abs(getDaysOverdue("2026-02-26"))).toBe(0);
  });

  it("returns negative value for future deadline (not overdue)", () => {
    expect(getDaysOverdue("2026-02-27")).toBeLessThan(0);
  });
});

describe("filterCases() — search query", () => {
  it("returns all cases when search is empty", () => {
    const result = filterCases(MOCK_CASES, "", "all", EMPTY_FILTERS);
    expect(result).toHaveLength(MOCK_CASES.length);
  });

  it("filters by case ID (case-insensitive)", () => {
    const result = filterCases(MOCK_CASES, "va-2026-001", "all", EMPTY_FILTERS);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("VA-2026-001");
  });

  it("filters by case name partial match", () => {
    const result = filterCases(MOCK_CASES, "trộm cắp", "all", EMPTY_FILTERS);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("VA-2026-001");
  });

  it("filters by investigator name", () => {
    const result = filterCases(MOCK_CASES, "Trần Thị Mai", "all", EMPTY_FILTERS);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("VA-2026-002");
  });

  it("returns empty array when no cases match search", () => {
    const result = filterCases(MOCK_CASES, "XYZ_KHÔNG_TỒN_TẠI", "all", EMPTY_FILTERS);
    expect(result).toHaveLength(0);
  });
});

describe("filterCases() — status filter", () => {
  it("returns all cases for status = 'all'", () => {
    const result = filterCases(MOCK_CASES, "", "all", EMPTY_FILTERS);
    expect(result).toHaveLength(MOCK_CASES.length);
  });

  it("filters to only 'Đang điều tra' cases", () => {
    const result = filterCases(MOCK_CASES, "", "Đang điều tra", EMPTY_FILTERS);
    expect(result.every((c) => c.status === "Đang điều tra")).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("filters to only 'Đã kết thúc' cases", () => {
    const result = filterCases(MOCK_CASES, "", "Đã kết thúc", EMPTY_FILTERS);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("VA-2026-004");
  });

  it("returns empty for a non-existent status", () => {
    const result = filterCases(MOCK_CASES, "", "Trạng thái lạ", EMPTY_FILTERS);
    expect(result).toHaveLength(0);
  });
});

describe("filterCases() — advanced filters: unit", () => {
  it("filters by Công an Quận 1", () => {
    const result = filterCases(MOCK_CASES, "", "all", { ...EMPTY_FILTERS, unit: "Công an Quận 1" });
    expect(result.every((c) => c.unit === "Công an Quận 1")).toBe(true);
    expect(result.length).toBe(1);
  });

  it("filters by Công an Quận 3", () => {
    const result = filterCases(MOCK_CASES, "", "all", { ...EMPTY_FILTERS, unit: "Công an Quận 3" });
    expect(result.length).toBe(1);
    expect(result[0].id).toBe("VA-2026-002");
  });

  it("returns empty when unit has no matching cases", () => {
    const result = filterCases(MOCK_CASES, "", "all", { ...EMPTY_FILTERS, unit: "Đơn vị không tồn tại" });
    expect(result).toHaveLength(0);
  });
});

describe("filterCases() — advanced filters: investigator", () => {
  it("filters by investigator name exactly", () => {
    const result = filterCases(MOCK_CASES, "", "all", { ...EMPTY_FILTERS, investigator: "Lê Văn Hùng" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("VA-2026-003");
  });

  it("returns empty for non-existent investigator", () => {
    const result = filterCases(MOCK_CASES, "", "all", { ...EMPTY_FILTERS, investigator: "Không Tồn Tại" });
    expect(result).toHaveLength(0);
  });
});

describe("filterCases() — advanced filters: charges", () => {
  it("filters by charges string", () => {
    const result = filterCases(MOCK_CASES, "", "all", { ...EMPTY_FILTERS, charges: "Buôn lậu (Điều 188)" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("VA-2026-005");
  });
});

describe("filterCases() — advanced filters: date range", () => {
  it("filters by fromDate — only cases created on or after 2026-02-03", () => {
    const result = filterCases(MOCK_CASES, "", "all", { ...EMPTY_FILTERS, fromDate: "2026-02-03" });
    // VA-2026-001 created 01/02/2026 → excluded
    expect(result.every((c) => {
      const d = new Date(c.dateCreated.split("/").reverse().join("-"));
      return d >= new Date("2026-02-03");
    })).toBe(true);
    expect(result.find((c) => c.id === "VA-2026-001")).toBeUndefined();
  });

  it("filters by toDate — only cases created on or before 2026-02-03", () => {
    const result = filterCases(MOCK_CASES, "", "all", { ...EMPTY_FILTERS, toDate: "2026-02-03" });
    expect(result.every((c) => {
      const d = new Date(c.dateCreated.split("/").reverse().join("-"));
      return d <= new Date("2026-02-03");
    })).toBe(true);
  });

  it("returns empty when fromDate > toDate", () => {
    const result = filterCases(MOCK_CASES, "", "all", { ...EMPTY_FILTERS, fromDate: "2026-12-01", toDate: "2026-01-01" });
    expect(result).toHaveLength(0);
  });

  it("applies exact date range correctly", () => {
    // Only VA-2026-003 (05/02/2026) and VA-2026-005 (04/02/2026) in range 04–05 Feb
    const result = filterCases(MOCK_CASES, "", "all", { ...EMPTY_FILTERS, fromDate: "2026-02-04", toDate: "2026-02-05" });
    const ids = result.map((c) => c.id).sort();
    expect(ids).toContain("VA-2026-003");
    expect(ids).toContain("VA-2026-005");
    expect(result.find((c) => c.id === "VA-2026-001")).toBeUndefined();
  });
});

describe("filterCases() — combined filters (AC-01)", () => {
  it("combines search + unit + status", () => {
    // Search for "trộm", unit "Công an Quận 1", status "Đang điều tra"
    const result = filterCases(
      MOCK_CASES,
      "trộm",
      "Đang điều tra",
      { ...EMPTY_FILTERS, unit: "Công an Quận 1" }
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("VA-2026-001");
  });

  it("EC-01: returns empty array when no matches — triggers empty state", () => {
    const result = filterCases(
      MOCK_CASES,
      "ZZZZ không tồn tại",
      "Đang điều tra",
      { ...EMPTY_FILTERS, unit: "Công an Quận 1" }
    );
    expect(result).toHaveLength(0);
  });
});

describe("overdue badge logic — AC-02", () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-26T12:00:00.000Z"));
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("counts correct number of overdue cases from mock data", () => {
    const overdueCases = MOCK_CASES.filter((c) => isOverdue(c.investigationDeadline));
    // VA-2026-001 deadline 2026-02-20 ✓
    // VA-2026-002 deadline 2026-02-15 ✓
    // VA-2026-004 deadline 2026-02-10 ✓
    // VA-2026-005 deadline 2026-02-18 ✓
    // VA-2026-003 deadline 2026-03-05 ✗
    expect(overdueCases.length).toBe(4);
  });

  it("identifies correct cases as overdue", () => {
    const overdueIds = MOCK_CASES.filter((c) => isOverdue(c.investigationDeadline)).map((c) => c.id);
    expect(overdueIds).toContain("VA-2026-001");
    expect(overdueIds).toContain("VA-2026-002");
    expect(overdueIds).toContain("VA-2026-004");
    expect(overdueIds).toContain("VA-2026-005");
    expect(overdueIds).not.toContain("VA-2026-003");
  });

  it("non-overdue case has no badge", () => {
    // VA-2026-003 deadline 2026-03-05 → future → not overdue
    expect(isOverdue("2026-03-05")).toBe(false);
  });

  it("hasActiveFilters is true when any filter is set", () => {
    const hasActive = (filters: Filters) => Object.values(filters).some((v) => v !== "");
    expect(hasActive(EMPTY_FILTERS)).toBe(false);
    expect(hasActive({ ...EMPTY_FILTERS, unit: "Công an Quận 1" })).toBe(true);
    expect(hasActive({ ...EMPTY_FILTERS, fromDate: "2026-02-01" })).toBe(true);
  });
});
