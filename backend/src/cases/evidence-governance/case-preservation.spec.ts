import { assertCasePreservation } from './case-preservation';

const delegates = [
  'caseAssetVersion',
  'caseCustodyEvent',
  'caseDisclosurePacket',
  'caseEvidenceHold',
  'caseRepresentationGrant',
  'caseRetentionPolicy',
  'caseDispositionRequest',
  'caseDecision',
  'caseRelation',
  'caseHandoff',
  'caseActionRequest',
  'caseGovernanceEvent',
  'caseGovernanceOperation',
  'caseGovernanceTask',
  'caseGovernanceOutbox',
  'caseGovernanceGrant',
] as const;
type MockCounters = Record<
  (typeof delegates)[number],
  { count: jest.Mock<Promise<number>, unknown[]> }
> & { $queryRaw: jest.Mock<Promise<unknown>, unknown[]> };
describe('CG13 preservation across hard-delete and force rollback', () => {
  const fixture = () =>
    ({
      ...Object.fromEntries(
        delegates.map((key) => [
          key,
          { count: jest.fn().mockResolvedValue(0) },
        ]),
      ),
      $queryRaw: jest.fn(),
    }) as unknown as MockCounters;
  it.each(delegates)(
    'refuses deletion when %s provenance exists',
    async (delegate) => {
      const tx = fixture();
      tx[delegate].count.mockResolvedValue(1);
      await expect(
        assertCasePreservation(tx as never, 'case-1', 'force rollback'),
      ).rejects.toMatchObject({ status: 409 });
    },
  );
  it('allows ordinary ungoverned import cleanup after every check', async () => {
    const tx = fixture();
    await expect(
      assertCasePreservation(tx as never, 'case-1', 'rollback'),
    ).resolves.toBeUndefined();
    delegates.forEach((key) => expect(tx[key].count).toHaveBeenCalledTimes(1));
  });
  it('fails closed if a schema or database check fails', async () => {
    const tx = fixture();
    tx.caseEvidenceHold.count.mockRejectedValue(
      new Error('database unavailable'),
    );
    await expect(
      assertCasePreservation(tx as never, 'case-1', 'rollback'),
    ).rejects.toThrow('database unavailable');
  });
});
