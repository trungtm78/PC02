import { ConflictException } from '@nestjs/common';
import { assertReviewedCandidates } from './acknowledge';

describe('assertReviewedCandidates', () => {
  const candidates = [
    { id: 'old-1', confidence: 'HIGH' as const },
    { id: 'old-2', confidence: 'MEDIUM' as const },
  ];

  it('requires a newly found high-confidence candidate at save time', () => {
    expect(() => assertReviewedCandidates(candidates, [])).toThrow(
      ConflictException,
    );
    try {
      assertReviewedCandidates(candidates, []);
    } catch (error) {
      expect((error as ConflictException).getResponse()).toEqual(
        expect.objectContaining({
          code: 'DUPLICATE_REVIEW_REQUIRED',
          candidateIds: ['old-1'],
        }),
      );
    }
  });

  it('accepts the exact high-confidence candidate while keeping medium matches advisory', () => {
    expect(assertReviewedCandidates(candidates, ['old-1', 'forged'])).toEqual([
      'old-1',
    ]);
  });

  it('requires a new acknowledgement when another candidate appears', () => {
    expect(() =>
      assertReviewedCandidates(
        [...candidates, { id: 'old-3', confidence: 'HIGH' }],
        ['old-1'],
      ),
    ).toThrow(ConflictException);
  });
});
