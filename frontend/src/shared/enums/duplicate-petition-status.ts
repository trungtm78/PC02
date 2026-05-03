/**
 * Local-only status used by the duplicate-petitions classification screen.
 * Values are display labels because the API for this view returns them as
 * free-form strings (no Prisma enum — see `DuplicatePetitionsPage` data
 * shape). Treat as a closed set.
 */
export const DUPLICATE_PETITION_STATUS = {
  PENDING: 'Chờ xử lý',
  REVIEWING: 'Đang xem xét',
  MERGED: 'Đã hợp nhất',
  SPLIT: 'Tách riêng',
} as const;

export type DuplicatePetitionStatus =
  (typeof DUPLICATE_PETITION_STATUS)[keyof typeof DUPLICATE_PETITION_STATUS];

export const DUPLICATE_PETITION_STATUS_LIST: readonly DuplicatePetitionStatus[] =
  Object.freeze(Object.values(DUPLICATE_PETITION_STATUS));
