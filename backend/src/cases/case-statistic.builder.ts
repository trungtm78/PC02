import { CaseStatisticDto, CASE_STATISTIC_DATE_FIELDS } from './dto/case-statistic.dto';

// Chuyển CaseStatisticDto → data Prisma cho bảng case_statistics (convert field ngày string→Date).
export function buildCaseStatisticData(dto: CaseStatisticDto): Record<string, unknown> {
  const dateSet = new Set<string>(CASE_STATISTIC_DATE_FIELDS as readonly string[]);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(dto)) {
    if (v === undefined) continue;
    out[k] = dateSet.has(k) ? (v ? new Date(v as string) : undefined) : v;
  }
  return out;
}
