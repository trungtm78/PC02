/**
 * v0.37.1 — Case provenance → InitialCasesPage type mapper
 *
 * Single source of truth for classifying a Case as "incident" or "case" in
 * the "Hồ sơ tiếp nhận" inbox view. Replaces the inline mapping at
 * InitialCasesPage.tsx:81 that read deprecated `metadata.caseType`.
 *
 * Precedence (highest first):
 *   1. caseProvenance enum (post-v0.37.1 source of truth)
 *   2. Legacy c.type field (pre-migration / backfill window)
 *   3. Legacy c.caseType field (deprecated metadata.caseType reader)
 *   4. Default → "case"
 *
 * Plan v2.4 PR-FE Decision (eng-review post-CEO): keep legacy fallback during
 * Deploy-1 soak window so pre-migration records (caseProvenance not yet
 * backfilled by PR-DATA) still classify correctly.
 */

export type InitialCaseType = 'incident' | 'case';

interface CaseLike {
  caseProvenance?: string | null;
  type?: string | null;
  caseType?: string | null;
}

export function mapCaseToInitialType(c: CaseLike): InitialCaseType {
  // 1. New source of truth — caseProvenance enum
  if (c.caseProvenance) {
    return c.caseProvenance === 'FROM_INCIDENT' ? 'incident' : 'case';
  }

  // 2. Legacy fallback during soak window — tolerate both underscore (DB enum
  // style: VU_VIEC) and hyphen (UI constant style: vu-viec) variants.
  const legacy = (c.type ?? c.caseType ?? '').toUpperCase().replace(/-/g, '_');
  if (legacy.includes('INCIDENT') || legacy.includes('VU_VIEC')) {
    return 'incident';
  }

  // 3. Default
  return 'case';
}
