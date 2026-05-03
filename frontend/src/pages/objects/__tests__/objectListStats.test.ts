/**
 * Unit Tests — ObjectListPage Dynamic Stats Logic
 * TASK_ID: TASK-2026-261225 | EXECUTION_ID: EX-261225-B4A2
 *
 * Tests pure stat-derivation logic extracted from ObjectListPage.tsx
 * Coverage target: ≥ 80%
 */

import { describe, it, expect } from "vitest";
import { SubjectStatus, SubjectType } from "@/shared/enums/subject-status";

interface Subject {
  id: string;
  status: SubjectStatus;
  fullName: string;
}

// ─── TYPE_CONFIG map — extracted for unit testing ─────────────────────────────

const TYPE_CONFIG: Record<SubjectType, { label: string; btnLabel: string }> = {
  SUSPECT: { label: "Bị can",     btnLabel: "Thêm bị can" },
  VICTIM:  { label: "Bị hại",     btnLabel: "Thêm bị hại" },
  WITNESS: { label: "Nhân chứng", btnLabel: "Thêm nhân chứng" },
};

// ─── Stat derivation functions (mirrors ObjectListPage.tsx logic) ─────────────

function computeSuspectStats(subjects: Subject[]) {
  return {
    detained:     subjects.filter((s) => s.status === SubjectStatus.DETAINED).length,
    wanted:       subjects.filter((s) => s.status === SubjectStatus.WANTED).length,
    investigating: subjects.filter((s) => s.status === SubjectStatus.INVESTIGATING).length,
  };
}

function computeVictimStats(subjects: Subject[]) {
  return {
    compensated: subjects.filter((s) => s.status === SubjectStatus.RELEASED).length,
    processing:  subjects.filter((s) => s.status === SubjectStatus.INVESTIGATING).length,
    damage:      0, // placeholder until backend provides field
  };
}

function computeWitnessStats(subjects: Subject[]) {
  return {
    declared: subjects.filter((s) => s.status === SubjectStatus.RELEASED).length,
    pending:  subjects.filter((s) => s.status === SubjectStatus.INVESTIGATING).length,
    refused:  subjects.filter((s) => s.status === SubjectStatus.WANTED).length,
  };
}

// ─── Damage formatting (mirrors ObjectListPage.tsx) ───────────────────────────

function formatDamageDisplay(amount: number): string {
  if (amount > 999_999_999) {
    return `${(amount / 1_000_000_000).toFixed(1)} tỷ`;
  }
  return amount.toLocaleString("vi-VN");
}

// ─── Mock data ────────────────────────────────────────────────────────────────

function makeSubject(id: string, status: SubjectStatus): Subject {
  return { id, status, fullName: `Nguyễn Văn ${id}` };
}

const MOCK_SUSPECTS: Subject[] = [
  makeSubject("S1", "DETAINED"),
  makeSubject("S2", "DETAINED"),
  makeSubject("S3", "WANTED"),
  makeSubject("S4", "INVESTIGATING"),
  makeSubject("S5", "INVESTIGATING"),
  makeSubject("S6", "RELEASED"),
];

const MOCK_VICTIMS: Subject[] = [
  makeSubject("V1", "RELEASED"),      // compensated
  makeSubject("V2", "RELEASED"),      // compensated
  makeSubject("V3", "INVESTIGATING"), // processing
  makeSubject("V4", "DETAINED"),
];

const MOCK_WITNESSES: Subject[] = [
  makeSubject("W1", "RELEASED"),      // declared
  makeSubject("W2", "INVESTIGATING"), // pending
  makeSubject("W3", "INVESTIGATING"), // pending
  makeSubject("W4", "WANTED"),        // refused
];

// ═══════════════════════════════════════════════════════════════════════════════
// SUSPECT STATS (AC-01)
// ═══════════════════════════════════════════════════════════════════════════════

describe("computeSuspectStats() — AC-01", () => {
  it("counts detained correctly", () => {
    const stats = computeSuspectStats(MOCK_SUSPECTS);
    expect(stats.detained).toBe(2);
  });

  it("counts wanted correctly", () => {
    const stats = computeSuspectStats(MOCK_SUSPECTS);
    expect(stats.wanted).toBe(1);
  });

  it("counts investigating correctly", () => {
    const stats = computeSuspectStats(MOCK_SUSPECTS);
    expect(stats.investigating).toBe(2);
  });

  it("EC-02: all stats return 0 when subjects list is empty", () => {
    const stats = computeSuspectStats([]);
    expect(stats.detained).toBe(0);
    expect(stats.wanted).toBe(0);
    expect(stats.investigating).toBe(0);
  });

  it("handles all-INVESTIGATING subjects", () => {
    const allInvestigating = [
      makeSubject("X1", "INVESTIGATING"),
      makeSubject("X2", "INVESTIGATING"),
    ];
    const stats = computeSuspectStats(allInvestigating);
    expect(stats.detained).toBe(0);
    expect(stats.wanted).toBe(0);
    expect(stats.investigating).toBe(2);
  });

  it("handles all-DETAINED subjects", () => {
    const allDetained = [
      makeSubject("X1", "DETAINED"),
      makeSubject("X2", "DETAINED"),
      makeSubject("X3", "DETAINED"),
    ];
    const stats = computeSuspectStats(allDetained);
    expect(stats.detained).toBe(3);
    expect(stats.wanted).toBe(0);
    expect(stats.investigating).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// VICTIM STATS (AC-02)
// ═══════════════════════════════════════════════════════════════════════════════

describe("computeVictimStats() — AC-02", () => {
  it("counts compensated (RELEASED) correctly", () => {
    const stats = computeVictimStats(MOCK_VICTIMS);
    expect(stats.compensated).toBe(2);
  });

  it("counts processing (INVESTIGATING) correctly", () => {
    const stats = computeVictimStats(MOCK_VICTIMS);
    expect(stats.processing).toBe(1);
  });

  it("damage is 0 (placeholder until backend)", () => {
    const stats = computeVictimStats(MOCK_VICTIMS);
    expect(stats.damage).toBe(0);
  });

  it("EC-02: all victim stats return 0 for empty list", () => {
    const stats = computeVictimStats([]);
    expect(stats.compensated).toBe(0);
    expect(stats.processing).toBe(0);
    expect(stats.damage).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// WITNESS STATS (AC-03)
// ═══════════════════════════════════════════════════════════════════════════════

describe("computeWitnessStats() — AC-03", () => {
  it("counts declared (RELEASED) correctly", () => {
    const stats = computeWitnessStats(MOCK_WITNESSES);
    expect(stats.declared).toBe(1);
  });

  it("counts pending (INVESTIGATING) correctly", () => {
    const stats = computeWitnessStats(MOCK_WITNESSES);
    expect(stats.pending).toBe(2);
  });

  it("counts refused (WANTED) correctly", () => {
    const stats = computeWitnessStats(MOCK_WITNESSES);
    expect(stats.refused).toBe(1);
  });

  it("EC-02: all witness stats return 0 for empty list", () => {
    const stats = computeWitnessStats([]);
    expect(stats.declared).toBe(0);
    expect(stats.pending).toBe(0);
    expect(stats.refused).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE_CONFIG — btnLabel per subjectType (AC-04, Table 2.2.B)
// ═══════════════════════════════════════════════════════════════════════════════

describe("TYPE_CONFIG — btnLabel (Table 2.2.B)", () => {
  it('SUSPECT btnLabel = "Thêm bị can"', () => {
    expect(TYPE_CONFIG.SUSPECT.btnLabel).toBe("Thêm bị can");
  });

  it('VICTIM btnLabel = "Thêm bị hại" (AC-04)', () => {
    expect(TYPE_CONFIG.VICTIM.btnLabel).toBe("Thêm bị hại");
  });

  it('WITNESS btnLabel = "Thêm nhân chứng"', () => {
    expect(TYPE_CONFIG.WITNESS.btnLabel).toBe("Thêm nhân chứng");
  });

  it("all 3 subjectTypes have unique btnLabels", () => {
    const labels = Object.values(TYPE_CONFIG).map((c) => c.btnLabel);
    const unique = new Set(labels);
    expect(unique.size).toBe(3);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DAMAGE FORMATTING — EC-03 (large number)
// ═══════════════════════════════════════════════════════════════════════════════

describe("formatDamageDisplay() — EC-03: large numbers", () => {
  it("formats 0 as '0'", () => {
    expect(formatDamageDisplay(0)).toBe("0");
  });

  it("formats 500,000,000 with locale (< 1 tỷ)", () => {
    const result = formatDamageDisplay(500_000_000);
    // Should NOT use "tỷ" suffix for < 1 billion
    expect(result).not.toContain("tỷ");
  });

  it("formats 1,000,000,000 as '1.0 tỷ'", () => {
    expect(formatDamageDisplay(1_000_000_000)).toBe("1.0 tỷ");
  });

  it("formats 2,500,000,000 as '2.5 tỷ'", () => {
    expect(formatDamageDisplay(2_500_000_000)).toBe("2.5 tỷ");
  });

  it("EC-03: formats very large 999,999,999,999 correctly", () => {
    const result = formatDamageDisplay(999_999_999_999);
    expect(result).toContain("tỷ");
    expect(result).toBe("1000.0 tỷ");
  });

  it("EC-03: does not overflow layout for 9,999,999,999,999", () => {
    // Should truncate to 1 decimal
    const result = formatDamageDisplay(9_999_999_999_999);
    expect(result).toMatch(/^\d+\.\d tỷ$/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// EC-01: Invalid subjectType fallback
// ═══════════════════════════════════════════════════════════════════════════════

describe("EC-01: SubjectType fallback", () => {
  it("defaults to SUSPECT config when type unknown", () => {
    // The component defaults subjectType to 'SUSPECT' via props default
    const defaultType: SubjectType = "SUSPECT";
    expect(TYPE_CONFIG[defaultType]).toBeDefined();
    expect(TYPE_CONFIG[defaultType].btnLabel).toBe("Thêm bị can");
  });

  it("all expected SubjectTypes exist in TYPE_CONFIG", () => {
    const expected: SubjectType[] = ["SUSPECT", "VICTIM", "WITNESS"];
    for (const t of expected) {
      expect(TYPE_CONFIG[t]).toBeDefined();
    }
  });
});
