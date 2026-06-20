// Báo cáo dry-run di trú (thuần) — tổng hợp từ decompose để admin đối soát TRƯỚC khi commit.
import { decomposeLegacyRecord, MAPPED_LEGACY_KEYS, type LegacyRecord } from './legacy-mapper';

// Field-coverage matrix (PR-M4, Codex P2#1): đối soát độ phủ field theo TỪNG cột nguồn.
// provisional=true (Codex P1#5) — số liệu chỉ tin cậy sau khi chạy trên data/schema THẬT.
export interface FieldCoverageMatrix {
  totalRecords: number;
  distinctSourceKeys: number; // tổng số key khác nhau xuất hiện (non-empty) trong batch
  mappedKeys: number; // số key đã map sang cột typed (queryable)
  rawOnlyKeys: number; // số key chỉ nằm trong legacyRaw (chưa có cột typed)
  rawOnlyKeyNames: string[]; // tên các key raw-only — admin soi để cân nhắc thêm cột
  typedCoverageRatio: number; // mappedKeys / distinctSourceKeys (0..1)
  // rawCoverageRatio = key được preserve / distinct key. Record bị skip (phân loại lạ HOẶC thiếu id)
  // KHÔNG tạo entity nào → field của nó không vào legacyRaw → tính là MẤT (Codex P1 review M4).
  rawCoverageRatio: number;
  lostKeyNames: string[]; // key chỉ xuất hiện ở record bị skip (không preserve)
  skippedRecords: number; // số record không tạo entity nào (mất data nếu commit)
  provisional: true;
}

const isNonEmpty = (v: unknown): boolean => {
  if (v === null || v === undefined) return false;
  return String(v).trim() !== '';
};

export function buildFieldCoverage(records: LegacyRecord[]): FieldCoverageMatrix {
  const distinct = new Set<string>();
  const preserved = new Set<string>(); // key thuộc ít nhất 1 record THỰC SỰ tạo entity (có legacyRaw)
  let skippedRecords = 0;

  for (const rec of records) {
    const keys = Object.entries(rec)
      .filter(([, v]) => isNonEmpty(v))
      .map(([k]) => k);
    keys.forEach((k) => distinct.add(k));

    // Khớp điều kiện skip của commit: thiếu id HOẶC decompose không ra entity nào.
    const id = rec.id == null ? '' : String(rec.id).trim();
    const d = decomposeLegacyRecord(rec);
    const hasEntity = !!(
      d.petition ||
      d.incident ||
      d.case ||
      d.guidance ||
      d.exchange ||
      d.proposal ||
      d.lawyer
    );
    if (id && hasEntity) keys.forEach((k) => preserved.add(k));
    else skippedRecords++;
  }

  const rawOnly = [...distinct].filter((k) => !MAPPED_LEGACY_KEYS.has(k)).sort();
  const mappedKeys = distinct.size - rawOnly.length;
  const lostKeyNames = [...distinct].filter((k) => !preserved.has(k)).sort();
  return {
    totalRecords: records.length,
    distinctSourceKeys: distinct.size,
    mappedKeys,
    rawOnlyKeys: rawOnly.length,
    rawOnlyKeyNames: rawOnly,
    typedCoverageRatio: distinct.size === 0 ? 0 : mappedKeys / distinct.size,
    rawCoverageRatio: distinct.size === 0 ? 1 : preserved.size / distinct.size,
    lostKeyNames,
    skippedRecords,
    provisional: true,
  };
}

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
  fieldCoverage: FieldCoverageMatrix; // PR-M4 — ma trận độ phủ field (provisional)
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
    fieldCoverage: buildFieldCoverage(records),
  };
}
