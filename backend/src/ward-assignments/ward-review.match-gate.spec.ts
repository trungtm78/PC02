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
      screenForApproval: jest.fn().mockResolvedValue({ open, samePerson: [], notSamePerson: 1, shown: 2 }),
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

  it('a match that appears between the first screening and the lock stops the approval inside its transaction', async () => {
    const { svc, transaction, matching } = service([]);
    (matching.screenForApproval as jest.Mock)
      .mockResolvedValueOnce({ open: [], samePerson: [], notSamePerson: 0, shown: 0 })
      .mockResolvedValueOnce({ open: [{ subjectPosition: 1, source: 'WARD_ASSIGNMENT', recordId: 'w7', level: 'CERTAIN' }], samePerson: [], notSamePerson: 0, shown: 1 });
    // The transaction runs its body with a client that locks the row: here, the lock is the only thing the body reaches
    // before it screens again.
    transaction.mockImplementation(async (body: (tx: unknown) => Promise<unknown>) =>
      body({ $queryRaw: jest.fn().mockResolvedValue([]), wardAssignment: { findUnique: jest.fn().mockResolvedValue({ id: 'w1', assignedTeamId: 't', enteredById: 'u', code: 'c', updatedAt: new Date(input.expectedUpdatedAt), archivedAt: null }) }, userTeam: { findFirst: jest.fn().mockResolvedValue(null) } }),
    );
    const refused = await svc.approve(actor, null, 'w1', input).catch((e: unknown) => e);
    expect((refused as ConflictException).getResponse()).toMatchObject({ code: WARD_ALERT_ERROR.MATCH_REVIEW_REQUIRED });
    expect(matching.screenForApproval).toHaveBeenCalledTimes(2);
  });

  it('nothing left to conclude: the approval goes on (to its transaction)', async () => {
    const { svc, transaction, matching } = service([]);
    transaction.mockResolvedValue({ id: 'w1', status: 'APPROVED' });
    await expect(svc.approve(actor, null, 'w1', input)).resolves.toMatchObject({ status: 'APPROVED' });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(matching.screenForApproval).toHaveBeenCalledWith(null, 'rev-1', 'w1');
  });
});
