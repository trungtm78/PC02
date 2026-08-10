/**
 * Evidence status — DB WIRE FORMAT.
 *
 * Stored verbatim in `evidences.status`, which is a plain `String` column with
 * default `'THU_GIU'` (schema.prisma) — deliberately *not* a Prisma enum. That
 * means `npm run gen:enums` does not emit it, so the frontend mirror in
 * `frontend/src/shared/enums/evidence-status.ts` is maintained by hand and the
 * two must be changed together.
 *
 * Renaming a value silently orphans every row already carrying it. Append only.
 */
export const EVIDENCE_STATUS = {
  /** Đang thu giữ — held in the evidence store */
  THU_GIU: 'THU_GIU',
  /** Đã giám định — forensic examination complete */
  DA_GIAM_DINH: 'DA_GIAM_DINH',
  /** Đã trả lại — returned to its owner */
  TRA_LAI: 'TRA_LAI',
  /** Đã tiêu hủy — destroyed under a disposal decision */
  TIEU_HUY: 'TIEU_HUY',
} as const;

export type EvidenceStatus =
  (typeof EVIDENCE_STATUS)[keyof typeof EVIDENCE_STATUS];

export const EVIDENCE_STATUS_VALUES: readonly string[] =
  Object.values(EVIDENCE_STATUS);
