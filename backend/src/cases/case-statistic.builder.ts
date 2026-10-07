import {
  CaseStatisticDto,
  CASE_STATISTIC_DATE_FIELDS,
} from './dto/case-statistic.dto';

// Các cột này là Boolean NOT NULL trong Prisma. Form cũ gửi null khi bỏ chọn;
// về mặt nghiệp vụ, bỏ chọn chính là false. Giữ null cho ba cờ xét xử nullable
// để vẫn phân biệt được dữ liệu legacy chưa xác minh.
const REQUIRED_BOOLEAN_FIELDS = new Set([
  'coGhiAmGhiHinh',
  'laVuAnGhiAmGhiHinh',
  'vksYeuCauGhiAm',
  'coVPHC',
  'coBangNhom',
  'vuAnDaDuocXetXu',
]);

// Chuyển CaseStatisticDto → data Prisma cho bảng case_statistics (convert field ngày string→Date).
export function buildCaseStatisticData(
  dto: CaseStatisticDto,
): Record<string, unknown> {
  const dateSet = new Set<string>(
    CASE_STATISTIC_DATE_FIELDS as readonly string[],
  );
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(dto)) {
    if (v === undefined) continue;
    out[k] = v === null && REQUIRED_BOOLEAN_FIELDS.has(k)
      ? false
      : dateSet.has(k)
      ? v === null || v === ''
        ? null
        : new Date(v as string)
      : v;
  }
  return out;
}
