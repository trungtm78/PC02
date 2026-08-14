/**
 * Evidence status — hand-maintained mirror of
 * `backend/src/common/constants/evidence-status.constants.ts`.
 *
 * `evidences.status` is a plain `String` column, not a Prisma enum, so
 * `npm run gen:enums` does not emit it into `generated.ts`. The two files must
 * be changed together; the enum-literal guard cannot catch a drift here because
 * it only knows about values declared in schema.prisma.
 */
export const EVIDENCE_STATUS = {
  THU_GIU: 'THU_GIU',
  DA_GIAM_DINH: 'DA_GIAM_DINH',
  TRA_LAI: 'TRA_LAI',
  TIEU_HUY: 'TIEU_HUY',
} as const;

export type EvidenceStatus =
  (typeof EVIDENCE_STATUS)[keyof typeof EVIDENCE_STATUS];

export const EVIDENCE_STATUS_VALUES = Object.values(
  EVIDENCE_STATUS,
) as EvidenceStatus[];

export const EVIDENCE_STATUS_LABELS: Record<EvidenceStatus, string> = {
  [EVIDENCE_STATUS.THU_GIU]: 'Đang thu giữ',
  [EVIDENCE_STATUS.DA_GIAM_DINH]: 'Đã giám định',
  [EVIDENCE_STATUS.TRA_LAI]: 'Đã trả lại',
  [EVIDENCE_STATUS.TIEU_HUY]: 'Đã tiêu hủy',
};

/** Static Tailwind classes — never build these by interpolation, the JIT
 *  compiler only emits class names it can read literally in the source. */
export const EVIDENCE_STATUS_BADGE: Record<EvidenceStatus, string> = {
  [EVIDENCE_STATUS.THU_GIU]: 'bg-blue-100 text-blue-800',
  [EVIDENCE_STATUS.DA_GIAM_DINH]: 'bg-emerald-100 text-emerald-800',
  [EVIDENCE_STATUS.TRA_LAI]: 'bg-amber-100 text-amber-800',
  [EVIDENCE_STATUS.TIEU_HUY]: 'bg-slate-200 text-slate-700',
};

export function evidenceStatusLabel(status: string): string {
  return EVIDENCE_STATUS_LABELS[status as EvidenceStatus] ?? status;
}

export function evidenceStatusBadge(status: string): string {
  return (
    EVIDENCE_STATUS_BADGE[status as EvidenceStatus] ??
    'bg-slate-100 text-slate-700'
  );
}
