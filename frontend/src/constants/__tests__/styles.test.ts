/**
 * Tests cho design tokens trong constants/styles.ts.
 *
 * Coverage:
 * 1. TABLE_HEADER_CELL không dùng `uppercase` (hostile to Vietnamese diacritics)
 * 2. 8 new tokens defined (ListPageShell scaffolding)
 * 3. 3 semantic tokens defined (gray-* migration path)
 */

import { describe, it, expect } from 'vitest';
import * as styles from '../styles';

describe('TABLE_HEADER_CELL — Vietnamese typography', () => {
  it('không chứa class `uppercase` (uppercase Vietnamese with diacritics looks broken)', () => {
    expect(styles.TABLE_HEADER_CELL).not.toContain('uppercase');
  });

  it('vẫn giữ font-semibold/medium + text-xs cho hierarchy', () => {
    expect(styles.TABLE_HEADER_CELL).toMatch(/text-xs/);
    expect(styles.TABLE_HEADER_CELL).toMatch(/font-(semibold|medium)/);
  });
});

describe('ListPageShell tokens — 14 ListPageShell tokens (PR1 foundation)', () => {
  // Mỗi token PHẢI là Tailwind utility — kiểm tra qua regex shape:
  // - Có ít nhất 1 utility prefix hợp lệ (text-, bg-, border-, ring-, p[a-z]-, m[a-z]-, ...)
  // - Không có typo như "bg-slate-1000" (slate scale chỉ tới 950)
  // - Không có "tring-2" (em hay typo từ "ring-2")
  const VALID_UTILITY = /\b(text|bg|border|ring|divide|placeholder|outline|shadow|rounded|p[trblxy]?|m[trblxy]?|gap|space|w|h|min|max|flex|grid|inline|absolute|relative|fixed|sticky|top|bottom|left|right|inset|z|opacity|hover|focus|focus-visible|active|disabled|sm|md|lg|xl|whitespace|overflow|truncate|snap|tabular|font|leading|tracking|transition|duration|ease|translate|rotate|scale|cursor)-/;
  const INVALID_TYPOS = /\b(tring-|sring-|backgroud-|widht-|hieght-)/;
  const INVALID_SCALE = /\b(slate|gray|red|blue|green|amber|orange|purple|cyan|teal|indigo|fuchsia|yellow)-(1000|2000|0\d)\b/;

  it.each([
    ['STATUS_CHIPS_BAR', 'container cho status chips row'],
    ['STATUS_CHIP_BASE', 'base style cho 1 chip'],
    ['STATUS_CHIP_ACTIVE', 'active state — filled slate-900 text-white'],
    ['STATUS_CHIP_INACTIVE', 'inactive — bg-slate-100 text-slate-700'],
    ['STATUS_CHIP_COUNT', 'nested count pill'],
    ['BULK_BAR_STICKY', 'sticky top desktop'],
    ['BULK_BAR_MOBILE_BOTTOM', 'sticky bottom mobile with safe-area'],
    ['FILTER_PANEL_COLLAPSED', 'animation state collapsed'],
    ['FILTER_PANEL_EXPANDED', 'animation state expanded'],
    ['FILTER_PANEL_CONTENT', 'inner wrapper overflow-hidden min-h-0 (codex HIGH fix)'],
    ['A11Y_FOCUS_RING', 'focus-visible ring cho keyboard nav'],
    ['OVERDUE_ROW_HIGHLIGHT', 'red row tint cho overdue'],
    ['PAGINATION_BAR', 'pagination footer container'],
    ['PAGINATION_BUTTON', 'prev/next button style'],
  ])('%s exported và shape hợp lệ (%s)', (token) => {
    const value = (styles as Record<string, unknown>)[token];
    expect(value).toBeDefined();
    expect(typeof value).toBe('string');
    expect(value as string).not.toBe('');
    // Shape check: tránh typo + invalid scale
    expect(value as string).toMatch(VALID_UTILITY);
    expect(value as string).not.toMatch(INVALID_TYPOS);
    expect(value as string).not.toMatch(INVALID_SCALE);
  });

  it('BULK_BAR_MOBILE_BOTTOM include safe-area-inset-bottom (iOS PWA home indicator)', () => {
    expect(styles.BULK_BAR_MOBILE_BOTTOM).toContain('safe-area-inset-bottom');
  });

  it('FILTER_PANEL_CONTENT có overflow-hidden + min-h-0 (CSS grid accordion contract)', () => {
    expect(styles.FILTER_PANEL_CONTENT).toContain('overflow-hidden');
    expect(styles.FILTER_PANEL_CONTENT).toContain('min-h-0');
  });

  it('A11Y_FOCUS_RING dùng focus-visible (KHÔNG focus:, để tránh focus ring khi click)', () => {
    expect(styles.A11Y_FOCUS_RING).toMatch(/focus-visible:ring-/);
  });

  it('STATUS_CHIP_ACTIVE và STATUS_CHIP_INACTIVE phân biệt visually (background khác nhau)', () => {
    expect(styles.STATUS_CHIP_ACTIVE).not.toBe(styles.STATUS_CHIP_INACTIVE);
    expect(styles.STATUS_CHIP_ACTIVE).toMatch(/bg-/);
    expect(styles.STATUS_CHIP_INACTIVE).toMatch(/bg-/);
  });
});

describe('Semantic gray-* tokens (Phase 2 design auto-decision)', () => {
  it.each([
    ['STATUS_ARCHIVED', 'lưu trữ — text-slate-600 bg-slate-100'],
    ['STATUS_PENDING_RESPONSE', 'chưa phản hồi UTDT — neutral muted'],
    ['STATUS_NOT_PROSECUTED', 'không khởi tố — solid slate'],
  ])('%s exported (%s)', (token) => {
    expect((styles as Record<string, unknown>)[token]).toBeDefined();
    expect(typeof (styles as Record<string, unknown>)[token]).toBe('string');
    expect((styles as Record<string, unknown>)[token] as string).not.toBe('');
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
});

describe('CASE_STATUS_COLORS.DA_LUU_TRU migrated to slate-*', () => {
  it('DA_LUU_TRU không còn dùng gray-*', () => {
    expect(styles.CASE_STATUS_COLORS.DA_LUU_TRU).not.toMatch(/\bgray-\d+/);
  });

  it('DA_LUU_TRU dùng slate-* neutral palette', () => {
    expect(styles.CASE_STATUS_COLORS.DA_LUU_TRU).toMatch(/slate-/);
  });
});
