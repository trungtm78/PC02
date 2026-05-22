/**
 * v0.37.1 — InitialCasesPage reader migration
 *
 * Background:
 * InitialCasesPage.tsx:81 currently reads `c.type ?? c.caseType ?? "CASE"` to
 * classify rows as "incident" vs "case". Plan v2.4 PR-FE Decision: migrate this
 * reader to use the new `caseProvenance` field (set by v0.37.1 PR-PROV-1).
 *
 * Strategy: extract mapping logic into pure function `mapCaseToInitialType`
 * so it's independently testable + reusable.
 *
 * Mapping rule:
 *   caseProvenance === 'FROM_INCIDENT' → 'incident'
 *   else                               → 'case'
 *
 * Legacy fallback (during Deploy-1 soak window — old rows with metadata.caseType
 * but no caseProvenance yet): keep the c.type/c.caseType fallback so InitialCasesPage
 * doesn't classify pre-migration records incorrectly.
 */

import { describe, it, expect } from 'vitest';
import { mapCaseToInitialType } from '../utils/case-provenance-mapper';

describe('mapCaseToInitialType (v0.37.1 InitialCasesPage reader)', () => {
  it('maps FROM_INCIDENT provenance → "incident"', () => {
    const result = mapCaseToInitialType({ caseProvenance: 'FROM_INCIDENT' });
    expect(result).toBe('incident');
  });

  it('maps FROM_PETITION provenance → "case"', () => {
    const result = mapCaseToInitialType({ caseProvenance: 'FROM_PETITION' });
    expect(result).toBe('case');
  });

  it('maps DIRECT_DISCOVERY provenance → "case"', () => {
    const result = mapCaseToInitialType({ caseProvenance: 'DIRECT_DISCOVERY' });
    expect(result).toBe('case');
  });

  it('maps TRANSFERRED provenance → "case"', () => {
    const result = mapCaseToInitialType({ caseProvenance: 'TRANSFERRED' });
    expect(result).toBe('case');
  });

  it('maps OTHER_LEGAL_SOURCE provenance → "case"', () => {
    const result = mapCaseToInitialType({ caseProvenance: 'OTHER_LEGAL_SOURCE' });
    expect(result).toBe('case');
  });

  it('legacy fallback: c.type === "incident" → "incident" (Deploy-1 soak window)', () => {
    // Pre-migration record without caseProvenance yet
    const result = mapCaseToInitialType({ type: 'incident' });
    expect(result).toBe('incident');
  });

  it('legacy fallback: c.caseType === "vu-viec" → "incident"', () => {
    // Pre-migration record with metadata.caseType (deprecated)
    const result = mapCaseToInitialType({ caseType: 'vu-viec' });
    expect(result).toBe('incident');
  });

  it('legacy fallback: c.caseType === "VU_VIEC" (uppercase) → "incident"', () => {
    const result = mapCaseToInitialType({ caseType: 'VU_VIEC' });
    expect(result).toBe('incident');
  });

  it('no signals at all → defaults to "case"', () => {
    const result = mapCaseToInitialType({});
    expect(result).toBe('case');
  });

  it('caseProvenance takes precedence over legacy fields', () => {
    // If both signals present, new field wins (post-migration source of truth)
    const result = mapCaseToInitialType({
      caseProvenance: 'FROM_INCIDENT',
      caseType: 'vu-an', // legacy says case, but provenance says incident
    });
    expect(result).toBe('incident');
  });
});
