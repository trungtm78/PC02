import { ConflictException } from '@nestjs/common';

export type ReviewCandidate = { id: string; confidence: 'HIGH' | 'MEDIUM' };

export function assertReviewedCandidates(
  candidates: readonly ReviewCandidate[],
  acknowledgedIds: readonly string[] = [],
): string[] {
  const acknowledged = new Set(acknowledgedIds);
  const highConfidenceIds = candidates
    .filter((candidate) => candidate.confidence === 'HIGH')
    .map((candidate) => candidate.id);
  const missing = highConfidenceIds.filter((id) => !acknowledged.has(id));
  if (missing.length > 0) {
    throw new ConflictException({
      code: 'DUPLICATE_REVIEW_REQUIRED',
      message: 'Cần rà soát hồ sơ có khả năng trùng trước khi lưu',
      candidateIds: missing,
    });
  }
  return highConfidenceIds;
}
