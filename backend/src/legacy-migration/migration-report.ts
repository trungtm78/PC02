// Báo cáo dry-run di trú (thuần) — tổng hợp từ decompose để admin đối soát TRƯỚC khi commit.
import { decomposeLegacyRecord, type LegacyRecord } from './legacy-mapper';

export interface MigrationReport {
  totalRecords: number;
  willCreatePetitions: number;
  willCreateIncidents: number;
  willCreateCases: number;
  // Tier ③ (PR-M3)
  willCreateGuidance: number;
  willCreateExchanges: number;
  willCreateProposals: number;
  willCreateLawyers: number;
  warningsCount: number;
  warnings: string[];
  duplicateLegacyIds: string[];
  missingIdCount: number;
}

export function buildMigrationReport(records: LegacyRecord[]): MigrationReport {
  let petitions = 0;
  let incidents = 0;
  let cases = 0;
  let guidance = 0;
  let exchanges = 0;
  let proposals = 0;
  let lawyers = 0;
  const warnings: string[] = [];
  let missingIdCount = 0;
  const seen = new Map<string, number>();

  for (const rec of records) {
    const id = rec.id == null ? '' : String(rec.id).trim();
    if (!id) missingIdCount++;
    else seen.set(id, (seen.get(id) ?? 0) + 1);

    const d = decomposeLegacyRecord(rec);
    if (d.petition) petitions++;
    if (d.incident) incidents++;
    if (d.case) cases++;
    if (d.guidance) guidance++;
    if (d.exchange) exchanges++;
    if (d.proposal) proposals++;
    if (d.lawyer) lawyers++;
    warnings.push(...d.warnings);
  }

  const duplicateLegacyIds = [...seen.entries()].filter(([, n]) => n > 1).map(([k]) => k);

  return {
    totalRecords: records.length,
    willCreatePetitions: petitions,
    willCreateIncidents: incidents,
    willCreateCases: cases,
    willCreateGuidance: guidance,
    willCreateExchanges: exchanges,
    willCreateProposals: proposals,
    willCreateLawyers: lawyers,
    warningsCount: warnings.length,
    warnings,
    duplicateLegacyIds,
    missingIdCount,
  };
}
