import { ConflictException } from '@nestjs/common';
import { seedLegacySample } from './seed-ho-so-di-tru-mau';
import { verifyLegacyParity } from './verify-backfill-parity';
import { assertCasePreservation } from '../../cases/evidence-governance/case-preservation';
import { execFileSync } from 'node:child_process';
jest.mock('child_process', () => ({ execFileSync: jest.fn() }));
function fixture() {
  const trace: string[] = [];
  const client = {
    user: { findUnique: jest.fn().mockResolvedValue({ id: 'synthetic-user' }) },
    case: {
      findMany: jest
        .fn()
        .mockResolvedValue([{ id: 'synthetic-one' }, { id: 'synthetic-two' }]),
      deleteMany: jest.fn(() => {
        trace.push('deleteCases');
        return Promise.resolve({ count: 2 });
      }),
      delete: jest.fn(() => {
        trace.push('deleteCase');
        return Promise.resolve({});
      }),
      create: jest.fn(() => {
        trace.push('create');
        return Promise.resolve({
          id: 'synthetic-created',
          caseCode: 'synthetic',
        });
      }),
      findUniqueOrThrow: jest
        .fn()
        .mockResolvedValue({ id: 'synthetic-created', statistic: null }),
    },
    caseStatistic: {
      deleteMany: jest.fn(() => {
        trace.push('deleteStatistics');
        return Promise.resolve({ count: 0 });
      }),
    },
    $transaction: jest.fn(),
    $disconnect: jest.fn().mockResolvedValue(undefined),
  };
  client.$transaction.mockImplementation(
    (handler: (tx: typeof client) => Promise<unknown>) => handler(client),
  );
  const preserve = jest
    .fn<
      ReturnType<typeof assertCasePreservation>,
      Parameters<typeof assertCasePreservation>
    >()
    .mockImplementation((_tx, id) => {
      trace.push('preserve:' + id);
      return Promise.resolve();
    });
  return { client, preserve, trace };
}
describe('isolated legacy maintenance preserves governed records; default CLI never runs', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());
  it.each(['seed', 'parity'])(
    '%s refuses preservation before any mocked delete/create/backfill',
    async (kind) => {
      const { client, preserve } = fixture();
      preserve.mockRejectedValue(new ConflictException('Held original'));
      const runBackfill = jest.fn();
      const run =
        kind === 'seed'
          ? seedLegacySample({ prisma: client as never, preserve })
          : verifyLegacyParity({
              prisma: client as never,
              preserve,
              runBackfill,
              exit: jest.fn(),
            });
      await expect(run).rejects.toMatchObject({ status: 409 });
      expect(client.caseStatistic.deleteMany).not.toHaveBeenCalled();
      expect(client.case.deleteMany).not.toHaveBeenCalled();
      expect(client.case.create).not.toHaveBeenCalled();
      expect(runBackfill).not.toHaveBeenCalled();
      expect(client.$disconnect).toHaveBeenCalledTimes(1);
    },
  );
  it('seed checks every existing Case before replacing any row, even an ignored force argument', async () => {
    const { client, preserve, trace } = fixture(),
      argv = process.argv;
    process.argv = [...argv, '--force'];
    try {
      await seedLegacySample({ prisma: client as never, preserve });
    } finally {
      process.argv = argv;
    }
    expect(trace).toEqual([
      'preserve:synthetic-one',
      'preserve:synthetic-two',
      'deleteStatistics',
      'deleteCases',
      'create',
    ]);
    expect(client.$disconnect).toHaveBeenCalledTimes(1);
  });
  it('a newly held cleanup blocks deletes, propagates rejection and still disconnects', async () => {
    const { client, preserve } = fixture();
    preserve.mockImplementation((_tx, id) =>
      id === 'synthetic-created'
        ? Promise.reject(new ConflictException('New cleanup hold'))
        : Promise.resolve(),
    );
    await expect(
      verifyLegacyParity({
        prisma: client as never,
        preserve,
        runBackfill: () => {
          throw new Error('Synthetic backfill failure');
        },
        exit: jest.fn(),
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(client.caseStatistic.deleteMany).toHaveBeenCalledTimes(1);
    expect(client.case.delete).not.toHaveBeenCalled();
    expect(client.$disconnect).toHaveBeenCalledTimes(1);
  });
  it('parity failure reports nonzero result only after protected cleanup, without an external process', async () => {
    const { client, preserve, trace } = fixture(),
      runBackfill = jest.fn(),
      exit = jest.fn();
    await verifyLegacyParity({
      prisma: client as never,
      preserve,
      runBackfill,
      exit,
    });
    expect(runBackfill).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(1);
    expect(trace).toEqual([
      'preserve:synthetic-one',
      'preserve:synthetic-two',
      'deleteStatistics',
      'deleteCases',
      'create',
      'preserve:synthetic-created',
      'deleteStatistics',
      'deleteCase',
    ]);
    expect(client.$disconnect).toHaveBeenCalledTimes(1);
  });
  it('default backfill adapter is mocked; statistic mismatches still clean up before failure', async () => {
    const { client, preserve } = fixture(),
      exit = jest.fn();
    client.case.findUniqueOrThrow.mockResolvedValue({
      id: 'synthetic-created',
      statistic: { soLuongBiHai: 0 },
    });
    await verifyLegacyParity({ prisma: client as never, preserve, exit });
    expect(execFileSync).toHaveBeenCalledWith(
      process.execPath,
      expect.arrayContaining(['--entity', 'case']),
      expect.objectContaining({ stdio: 'inherit' }),
    );
    expect(exit).toHaveBeenCalledWith(1);
    expect(client.case.delete).toHaveBeenCalledTimes(1);
    expect(client.$disconnect).toHaveBeenCalledTimes(1);
  });
});
