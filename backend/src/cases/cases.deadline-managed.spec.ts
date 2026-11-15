import { ordinaryCaseAuthorityFixture, ordinaryCaseActorFixture } from './governance/case-ordinary-test.fixture';
import { ConflictException } from '@nestjs/common';
import { CasesService } from './cases.service';
import { DEADLINE_MANAGED_BY_FLOW } from '../processing-flow/records/deadline-managed.guard';

/**
 * A record whose flow keeps its deadline takes it from a step: the edit form must not write the column. Built by hand
 * with stubs (no database); the old behaviour is covered by the neighbouring specs, which build the service without a
 * writer.
 */
const STORED = new Date('2026-12-31T00:00:00.000Z');
const VU_AN = {
  id: 'c1',
  sensitivity: 'NORMAL',
  name: 'Case',
  status: 'TIEP_NHAN',
  assignedTeamId: 't1',
  investigatorId: 'u1',
  metadata: {},
  createdAt: new Date('2026-09-01'),
  ngayGiaiQuyet: null,
  deletedAt: null,
  deadline: STORED,
};

function build(managed: boolean | 'none') {
  const tx = {
    ...ordinaryCaseAuthorityFixture(),
    case: {
      findFirst: jest.fn().mockResolvedValue(VU_AN),
      findUnique: jest.fn().mockResolvedValue(VU_AN),
      update: jest.fn(() => Promise.resolve({ ...VU_AN, updatedAt: new Date() })),
    },
    subject: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
    evidence: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
    document: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    caseStatistic: { upsert: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    ...ordinaryCaseAuthorityFixture(),
    case: { findFirst: jest.fn().mockResolvedValue(VU_AN), findUnique: jest.fn().mockResolvedValue(VU_AN), findMany: jest.fn().mockResolvedValue([]) },
    petition: { findFirst: jest.fn().mockResolvedValue(null) },
    user: { findUnique: jest.fn().mockResolvedValue(ordinaryCaseActorFixture('u1')) },
    $transaction: jest.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  const audit = {
    log: jest.fn().mockResolvedValue(undefined),
    wrapUpdate: jest.fn(async (o: { fetchFn: () => Promise<unknown>; updateFn: () => Promise<unknown> }) => {
      await o.fetchFn();
      return o.updateFn();
    }),
  };
  const isManaged = jest.fn().mockResolvedValue(managed === true);
  const writer = managed === 'none' ? undefined : ({ isManaged } as never);
  const service = new CasesService(
    prisma as never,
    audit as never,
    { getNumericValue: jest.fn(), getKyThongKe: jest.fn() } as never,
    {} as never,
    { emit: jest.fn() } as never,
    undefined,
    undefined,
    undefined,
    writer,
  );
  return { service, tx, isManaged };
}

describe('CasesService.update: the deadline of a record whose flow keeps it', () => {
  it('a changed deadline of a managed record is refused with DEADLINE_MANAGED_BY_FLOW and nothing is written', async () => {
    const { service, tx, isManaged } = build(true);
    const attempt = service.update('c1', { deadline: '2027-02-01T00:00:00.000Z' } as never, 'u1');
    await expect(attempt).rejects.toBeInstanceOf(ConflictException);
    await expect(attempt).rejects.toMatchObject({ response: { code: DEADLINE_MANAGED_BY_FLOW } });
    expect(isManaged).toHaveBeenCalledWith(tx, 'CASE', 'c1');
    expect(tx.case.update).not.toHaveBeenCalled();
  });

  it('the same deadline sent back with another edit still saves for a managed record', async () => {
    const { service, tx } = build(true);
    await service.update('c1', { name: 'Renamed', deadline: STORED.toISOString() } as never, 'u1');
    expect(tx.case.update).toHaveBeenCalledTimes(1);
  });

  it('a record that is not managed keeps the old behaviour (the deadline is written)', async () => {
    const { service, tx } = build(false);
    await service.update('c1', { deadline: '2027-02-01T00:00:00.000Z' } as never, 'u1');
    expect((tx.case.update.mock.calls as unknown as Array<[{ data: { deadline: Date } }]>)[0][0].data.deadline).toEqual(new Date('2027-02-01T00:00:00.000Z'));
  });

  it('with no writer injected nothing is asked and the deadline is written', async () => {
    const { service, tx } = build('none');
    await service.update('c1', { deadline: '2027-02-01T00:00:00.000Z' } as never, 'u1');
    expect((tx.case.update.mock.calls as unknown as Array<[{ data: { deadline: Date } }]>)[0][0].data.deadline).toEqual(new Date('2027-02-01T00:00:00.000Z'));
  });
});
