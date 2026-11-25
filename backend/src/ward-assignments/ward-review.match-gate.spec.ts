import { ConflictException } from '@nestjs/common';
import { WardReviewService } from './ward-review.service';
import { WARD_ALERT_ERROR } from './ward-alerts.codes';
import type { WardMatchingService } from './ward-matching.service';

/**
 * The screening before an approval (owner, 26/11/2026; the petition's "Rà soát trùng" made for the review): a subject
 * with the same identity number as a person of another record, not concluded on, stops the approval before anything
 * is written. The matching itself is proven on PostgreSQL (`ward-alerts.database.spec.ts`).
 */
describe('approving a request with subjects screened', () => {
  const actor = { id: 'rev-1' };
  const input = { expectedUpdatedAt: '2026-11-26T00:00:00.000Z', assignedInvestigatorId: 'inv-1' };

  function service(open: unknown[]) {
    const transaction = jest.fn();
    const prisma = { $transaction: transaction } as never;
    const matching = {
      unreviewedCertain: jest.fn().mockResolvedValue(open),
      reviewedForApproval: jest.fn().mockResolvedValue({ samePerson: [], notSamePerson: 1, shown: 2 }),
    } as unknown as WardMatchingService;
    return { svc: new WardReviewService(prisma, { log: jest.fn() } as never, undefined, matching), transaction, matching };
  }

  it('an unconcluded match of the same identity number: 409 with the matches, nothing written', async () => {
    const { svc, transaction } = service([{ subjectPosition: 1, source: 'CASE', recordId: 'case-9', level: 'CERTAIN' }]);
    const refused = await svc.approve(actor, null, 'w1', input).catch((e: unknown) => e);
    expect(refused).toBeInstanceOf(ConflictException);
    expect((refused as ConflictException).getResponse()).toMatchObject({
      code: WARD_ALERT_ERROR.MATCH_REVIEW_REQUIRED,
      details: [{ subjectPosition: 1, source: 'CASE', recordId: 'case-9' }],
    });
    expect(transaction).not.toHaveBeenCalled();
  });

  it('nothing left to conclude: the approval goes on (to its transaction)', async () => {
    const { svc, transaction, matching } = service([]);
    transaction.mockResolvedValue({ id: 'w1', status: 'APPROVED' });
    await expect(svc.approve(actor, null, 'w1', input)).resolves.toMatchObject({ status: 'APPROVED' });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(matching.reviewedForApproval).toHaveBeenCalledWith(null, 'rev-1', 'w1');
  });
});
