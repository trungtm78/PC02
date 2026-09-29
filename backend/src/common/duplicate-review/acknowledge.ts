import { ConflictException } from '@nestjs/common';

export type ReviewCandidate = { id: string; confidence: 'HIGH' | 'MEDIUM' };

export function assertReviewedCandidates(
  candidates: readonly ReviewCandidate[],
  acknowledgedIds: readonly string[] = [],
): string[] {
  const acknowledged = new Set(acknowledgedIds);
  const confirmedIds = candidates
    .filter((candidate) => candidate.confidence === 'HIGH')
    .map((candidate) => candidate.id);
  const missing = confirmedIds.filter((id) => !acknowledged.has(id));
  if (missing.length > 0) {
    throw new ConflictException({
      code: 'DUPLICATE_REVIEW_REQUIRED',
      message: 'Cần rà soát hồ sơ có tên trùng trước khi lưu',
      candidateIds: missing,
    });
  }
  return confirmedIds;
}
