/**
 * Tests cho design tokens trong constants/styles.ts.
 *
 * Coverage:
 * 1. TABLE_HEADER_CELL không dùng `uppercase` (hostile to Vietnamese diacritics)
 * 2. 15 ListPageShell tokens defined + shape valid
 * 3. 3 semantic tokens defined + shape valid (gray-* migration path)
 * 4. OVERDUE_DEADLINE_CELL pair với OVERDUE_ROW_HIGHLIGHT (a11y triple signal)
 */

import { describe, it, expect } from 'vitest';
import * as styles from '../styles';

// Shared shape validators — extracted ra module scope để tránh duplicate
// giữa describe blocks (review finding: STATUS_PENDING_RESPONSE và
// STATUS_NOT_PROSECUTED chỉ test defined+non-empty, miss typo regression).
const VALID_UTILITY = /\b(text|bg|border|ring|divide|placeholder|outline|shadow|rounded|p[trblxy]?|m[trblxy]?|gap|space|w|h|min|max|flex|grid|inline|absolute|relative|fixed|sticky|top|bottom|left|right|inset|z|opacity|hover|focus|focus-visible|active|disabled|sm|md|lg|xl|whitespace|overflow|truncate|snap|tabular|font|leading|tracking|transition|duration|ease|translate|rotate|scale|cursor|motion-reduce)-/;

// Catch common typo patterns em tự bắt gặp.
const INVALID_TYPOS = /\b(tring-|sring-|backgroud-|widht-|hieght-)/;

// Allowlist Tailwind scale: catch nếu scale ngoài 50-950 (review finding:
// regex cũ chỉ catch 1000/2000/0\d — quá hẹp). Tailwind ships 50, 100, 200,
// 300, 400, 500, 600, 700, 800, 900, 950 cho default palette.
function hasInvalidScale(s: string): boolean {
  const matches = s.match(/\b(slate|gray|red|blue|green|amber|orange|purple|cyan|teal|indigo|fuchsia|yellow|violet)-(\d+)\b/g);
  if (!matches) return false;
  const ALLOWED = new Set([50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]);
  return matches.some((m) => {
    const n = parseInt(m.split('-').pop()!, 10);
    return !ALLOWED.has(n);
  });
}

function assertValidTailwindString(value: unknown): void {
  expect(value).toBeDefined();
  expect(typeof value).toBe('string');
  expect(value as string).not.toBe('');
  expect(value as string).toMatch(VALID_UTILITY);
  expect(value as string).not.toMatch(INVALID_TYPOS);
  expect(hasInvalidScale(value as string)).toBe(false);
}

describe('TABLE_HEADER_CELL — Vietnamese typography', () => {
  // Token boundary match — tránh false-positive nếu future class chứa substring
  // 'uppercase' (vd arbitrary value [text-transform:uppercase]) hoặc responsive
  // variant 'md:uppercase'.
  const UPPERCASE_TOKEN = /(?:^|\s|:)uppercase(?:\s|$)/;

  it('không chứa standalone `uppercase` class (Vietnamese diacritics looks broken)', () => {
    expect(styles.TABLE_HEADER_CELL).not.toMatch(UPPERCASE_TOKEN);
  });

  it('giữ text-xs hierarchy', () => {
    expect(styles.TABLE_HEADER_CELL).toMatch(/\btext-xs\b/);
  });

  it('có font-semibold hoặc font-medium cho weight hierarchy', () => {
    expect(styles.TABLE_HEADER_CELL).toMatch(/\bfont-(semibold|medium)\b/);
  });

  it('giữ tracking-wide/wider để thay vai trò spacing của uppercase', () => {
    expect(styles.TABLE_HEADER_CELL).toMatch(/\btracking-(wide|wider)\b/);
  });

  it('dùng navy brand color #003973 hoặc text-slate-* cho header cell (không drift sang gray-*)', () => {
    // Post list-ux-parity: TABLE_HEADER_CELL dùng text-[#003973] thay slate — intentional brand upgrade.
    const hasNavy = styles.TABLE_HEADER_CELL.includes('text-[#003973]');
    const hasSlate = /\btext-slate-\d{3}\b/.test(styles.TABLE_HEADER_CELL);
    expect(hasNavy || hasSlate).toBe(true);
    expect(styles.TABLE_HEADER_CELL).not.toMatch(/\btext-gray-/);
  });
});

describe('ListPageShell tokens — 15 ListPageShell tokens (PR1 foundation)', () => {
  it.each([
    ['STATUS_CHIPS_BAR', 'container cho status chips row'],
    ['STATUS_CHIP_BASE', 'base style cho 1 chip với max-w-[12rem] truncate'],
    ['STATUS_CHIP_ACTIVE', 'active state — filled slate-900 text-white'],
    ['STATUS_CHIP_INACTIVE', 'inactive — bg-slate-100 text-slate-700'],
    ['STATUS_CHIP_COUNT_ACTIVE', 'count pill cho active chip context'],
    ['STATUS_CHIP_COUNT_INACTIVE', 'count pill cho inactive chip context'],
    ['BULK_BAR_STICKY', 'sticky top desktop'],
    ['BULK_BAR_MOBILE_BOTTOM', 'sticky bottom mobile with safe-area'],
    ['FILTER_ACCORDION_COLLAPSED', 'accordion state collapsed'],
    ['FILTER_ACCORDION_EXPANDED', 'accordion state expanded'],
    ['FILTER_ACCORDION_CONTENT', 'inner wrapper overflow-hidden min-h-0'],
    ['A11Y_FOCUS_RING', 'focus-visible ring cho keyboard nav'],
    ['OVERDUE_ROW_HIGHLIGHT', 'red row tint cho overdue'],
    ['OVERDUE_DEADLINE_CELL', 'red-900 cho deadline cell typography pair'],
    ['PAGINATION_BAR', 'pagination footer container'],
    ['PAGINATION_BUTTON', 'prev/next button style'],
  ])('%s exported và shape hợp lệ (%s)', (token) => {
    assertValidTailwindString((styles as Record<string, unknown>)[token]);
  });

  it('STATUS_CHIP_BASE include max-w-[12rem] + truncate (enforce shortLabel obligation)', () => {
    expect(styles.STATUS_CHIP_BASE).toContain('max-w-[12rem]');
    expect(styles.STATUS_CHIP_BASE).toContain('truncate');
  });

  it('STATUS_CHIP_BASE include motion-reduce variant (WCAG 2.3.3)', () => {
    expect(styles.STATUS_CHIP_BASE).toContain('motion-reduce:transition-none');
  });

  it('STATUS_CHIP_BASE dùng py-2 + text-sm cho ~40px touch target (WCAG 2.5.8)', () => {
    expect(styles.STATUS_CHIP_BASE).toMatch(/\bpy-2\b/);
    expect(styles.STATUS_CHIP_BASE).toMatch(/\btext-sm\b/);
  });

  it('PAGINATION_BUTTON dùng py-2 cho touch target (mis-tap = lost scroll)', () => {
    expect(styles.PAGINATION_BUTTON).toMatch(/\bpy-2\b/);
  });

  it('STATUS_CHIPS_BAR include fade mask edge phải (offscreen chips affordance)', () => {
    expect(styles.STATUS_CHIPS_BAR).toContain('mask-image');
    expect(styles.STATUS_CHIPS_BAR).toContain('linear-gradient');
  });

  it('STATUS_CHIP_COUNT_ACTIVE và _INACTIVE phân biệt visually (background khác)', () => {
    expect(styles.STATUS_CHIP_COUNT_ACTIVE).not.toBe(styles.STATUS_CHIP_COUNT_INACTIVE);
    expect(styles.STATUS_CHIP_COUNT_ACTIVE).toMatch(/bg-white\/20/);
    expect(styles.STATUS_CHIP_COUNT_INACTIVE).toMatch(/bg-slate-200/);
  });

  it('FILTER_ACCORDION variants include motion-reduce:transition-none (WCAG 2.3.3)', () => {
    expect(styles.FILTER_ACCORDION_COLLAPSED).toContain('motion-reduce:transition-none');
    expect(styles.FILTER_ACCORDION_EXPANDED).toContain('motion-reduce:transition-none');
  });

  it('BULK_BAR_MOBILE_BOTTOM include safe-area-inset-bottom (iOS PWA home indicator)', () => {
    expect(styles.BULK_BAR_MOBILE_BOTTOM).toContain('safe-area-inset-bottom');
  });

  it('FILTER_ACCORDION_CONTENT có overflow-hidden + min-h-0 (CSS grid accordion contract)', () => {
    expect(styles.FILTER_ACCORDION_CONTENT).toContain('overflow-hidden');
    expect(styles.FILTER_ACCORDION_CONTENT).toContain('min-h-0');
  });

  it('A11Y_FOCUS_RING dùng focus-visible (tránh ring khi click)', () => {
    expect(styles.A11Y_FOCUS_RING).toMatch(/focus-visible:ring-/);
    expect(styles.A11Y_FOCUS_RING).not.toMatch(/(?:^|\s)focus:ring-/);
  });

  it('STATUS_CHIP_ACTIVE và STATUS_CHIP_INACTIVE phân biệt visually', () => {
    expect(styles.STATUS_CHIP_ACTIVE).not.toBe(styles.STATUS_CHIP_INACTIVE);
    expect(styles.STATUS_CHIP_ACTIVE).toMatch(/bg-/);
    expect(styles.STATUS_CHIP_INACTIVE).toMatch(/bg-/);
  });
});

describe('Semantic gray-* tokens (Phase 2 design auto-decision)', () => {
  // Shape check áp dụng cho cả semantic tokens (review finding: trước đây chỉ
  // test defined + non-empty + no-gray, miss typo regression).
  it.each([
    ['STATUS_ARCHIVED', 'lưu trữ — text-slate-600 bg-slate-100'],
    ['STATUS_PENDING_RESPONSE', 'chưa phản hồi UTDT — neutral muted'],
    ['STATUS_NOT_PROSECUTED', 'không khởi tố — solid slate'],
  ])('%s exported và shape hợp lệ (%s)', (token) => {
    assertValidTailwindString((styles as Record<string, unknown>)[token]);
  });

  it('STATUS_ARCHIVED không dùng gray-*', () => {
    expect(styles.STATUS_ARCHIVED).not.toMatch(/\bgray-\d+/);
  });

  it('STATUS_PENDING_RESPONSE không dùng gray-*', () => {
    expect(styles.STATUS_PENDING_RESPONSE).not.toMatch(/\bgray-\d+/);
  });

  it('STATUS_NOT_PROSECUTED không dùng gray-*', () => {
    expect(styles.STATUS_NOT_PROSECUTED).not.toMatch(/\bgray-\d+/);
  });

  it('STATUS_ARCHIVED và STATUS_PENDING_RESPONSE reference cùng MUTED_SLATE primitive (drift-proof)', () => {
    // Cả 2 phải có cùng value vì share primitive — drift impossible.
    expect(styles.STATUS_ARCHIVED).toBe(styles.STATUS_PENDING_RESPONSE);
  });
});

describe('CASE_STATUS_COLORS.DA_LUU_TRU migrated to STATUS_ARCHIVED', () => {
  it('DA_LUU_TRU không còn dùng gray-*', () => {
    expect(styles.CASE_STATUS_COLORS.DA_LUU_TRU).not.toMatch(/\bgray-\d+/);
  });

  it('DA_LUU_TRU dùng slate-* neutral palette', () => {
    expect(styles.CASE_STATUS_COLORS.DA_LUU_TRU).toMatch(/slate-/);
  });

  it('DA_LUU_TRU reference STATUS_ARCHIVED token (single source of truth)', () => {
    expect(styles.CASE_STATUS_COLORS.DA_LUU_TRU).toBe(styles.STATUS_ARCHIVED);
  });
});

// ── TABLE_SECTION_CARD — overflow-clip không phải overflow-hidden ────────────
// overflow-clip clips visual content nhưng KHÔNG tạo scroll container mới
// → sticky positioning của BulkSelectionHeaderCell/RowCell vẫn hoạt động đúng.
// overflow-hidden tạo implicit scroll container → break sticky trong một số browser (Safari).
describe('TABLE_SECTION_CARD — overflow behavior', () => {
  it('dùng overflow-clip thay overflow-hidden để không break sticky positioning của bulk checkboxes', () => {
    expect(styles.TABLE_SECTION_CARD).toContain('overflow-clip');
    expect(styles.TABLE_SECTION_CARD).not.toContain('overflow-hidden');
  });
});
