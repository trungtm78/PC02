/**
 * v0.37.1 — CASE_PROVENANCE_OPTIONS test
 * v0.37.2 — Expanded to 7 options (+ SELF_SURRENDER, PROSECUTOR_PROPOSAL per BLTTHS Đ.143 điểm d, đ)
 *
 * Plan v2.4 Decision 1A: Card riêng "Nguồn vụ án (BLTTHS Đ.143)" có dropdown
 * options. Mỗi option có label Vietnamese + helper text giải thích pháp lý.
 *
 * This test enforces:
 *   1. All 7 CaseProvenance enum values are present in options
 *   2. Each option has non-empty Vietnamese label
 *   3. Each option has helperText referencing legal basis
 *   4. Order: FROM_PETITION first (most common per BLTTHS Đ.143 nghiệp vụ)
 */

import { describe, it, expect } from 'vitest';
import { CASE_PROVENANCE_OPTIONS } from '../CaseFormPage/constants';
import { CaseProvenance } from '@/shared/enums/generated';

describe('CASE_PROVENANCE_OPTIONS (v0.37.1 Nguồn vụ án dropdown)', () => {
  it('contains all 7 CaseProvenance enum values', () => {
    const values = CASE_PROVENANCE_OPTIONS.map((o) => o.value);
    expect(values).toContain(CaseProvenance.FROM_PETITION);
    expect(values).toContain(CaseProvenance.FROM_INCIDENT);
    expect(values).toContain(CaseProvenance.DIRECT_DISCOVERY);
    expect(values).toContain(CaseProvenance.TRANSFERRED);
    expect(values).toContain(CaseProvenance.SELF_SURRENDER);
    expect(values).toContain(CaseProvenance.PROSECUTOR_PROPOSAL);
    expect(values).toContain(CaseProvenance.OTHER_LEGAL_SOURCE);
  });

  it('has exactly 7 options (no extras, no duplicates)', () => {
    expect(CASE_PROVENANCE_OPTIONS).toHaveLength(7);
    const uniqueValues = new Set(CASE_PROVENANCE_OPTIONS.map((o) => o.value));
    expect(uniqueValues.size).toBe(7);
  });

  it('every option has non-empty Vietnamese label', () => {
    for (const opt of CASE_PROVENANCE_OPTIONS) {
      expect(opt.label, `Option ${opt.value} missing label`).toBeTruthy();
      expect(opt.label.length, `Option ${opt.value} label too short`).toBeGreaterThan(2);
    }
  });

  it('every option has helperText referencing legal basis', () => {
    for (const opt of CASE_PROVENANCE_OPTIONS) {
      expect(opt.helperText, `Option ${opt.value} missing helperText`).toBeTruthy();
      expect(opt.helperText.length, `Option ${opt.value} helperText too short`).toBeGreaterThan(5);
    }
  });

  it('FROM_PETITION is first option (most common entry per BLTTHS Đ.143)', () => {
    expect(CASE_PROVENANCE_OPTIONS[0].value).toBe(CaseProvenance.FROM_PETITION);
  });

  it('OTHER_LEGAL_SOURCE is last (catch-all)', () => {
    const last = CASE_PROVENANCE_OPTIONS[CASE_PROVENANCE_OPTIONS.length - 1];
    expect(last.value).toBe(CaseProvenance.OTHER_LEGAL_SOURCE);
  });
});
