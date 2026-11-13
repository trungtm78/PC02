import { ConflictException, NotFoundException } from '@nestjs/common';
import { TeamLifecycleService } from './team-lifecycle.service';

/** Unit spec of the real delete; the locking and the foreign-key catalogue are proven on PostgreSQL in the database spec. */
function build(opts: { found?: boolean; catalogue?: { table_name: string; column_name: string }[]; counts?: number[] } = {}) {
  const found = opts.found ?? true;
  const catalogue = opts.catalogue ?? [
    { table_name: 'user_teams', column_name: 'teamId' },
    { table_name: 'cases', column_name: 'assignedTeamId' },
  ];
  const counts = [...(opts.counts ?? [0, 0])];
  const tx = {
    // The lock query carries FOR UPDATE; the other raw query is the foreign-key catalogue.
    $queryRaw: jest.fn((strings: TemplateStringsArray) =>
      Promise.resolve(
        strings.join('').includes('FOR UPDATE') ? (found ? [{ id: 't1', name: 'Team 1', code: 'T1' }] : []) : catalogue,
      ),
    ),
    $queryRawUnsafe: jest.fn().mockImplementation(() => Promise.resolve([{ n: counts.shift() ?? 0 }])),
    team: { delete: jest.fn().mockResolvedValue({ id: 't1' }) },
  };
  const prisma = {
    $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
    $queryRaw: tx.$queryRaw,
    $queryRawUnsafe: tx.$queryRawUnsafe,
    team: { findUnique: jest.fn().mockResolvedValue(found ? { id: 't1' } : null) },
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  return { service: new TeamLifecycleService(prisma as never, audit as never), tx, prisma, audit };
}

describe('TeamLifecycleService.deleteIfEmpty', () => {
  it('deletes a team nothing refers to, in one transaction, and audits it without any figures', async () => {
    const { service, tx, audit } = build();

    await expect(service.deleteIfEmpty('t1', 'actor1')).resolves.toEqual({ success: true });

    expect(tx.team.delete).toHaveBeenCalledWith({ where: { id: 't1' } });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'actor1',
        action: 'TEAM_DELETED',
        subject: 'Team',
        subjectId: 't1',
        metadata: { name: 'Team 1', code: 'T1' },
      }),
    );
  });

  it('refuses a team that still has people or records, listing what blocks it, and deletes nothing', async () => {
    const { service, tx, audit } = build({ counts: [2, 5] });

    await expect(service.deleteIfEmpty('t1', 'actor1')).rejects.toMatchObject({
      response: {
        code: 'TEAM_HAS_DATA',
        details: [
          { table: 'user_teams', column: 'teamId', count: 2 },
          { table: 'cases', column: 'assignedTeamId', count: 5 },
        ],
      },
    });

    expect(tx.team.delete).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('is a 409 so the screen can offer Merge or Archive instead', async () => {
    const { service } = build({ counts: [1, 0] });
    await expect(service.deleteIfEmpty('t1', 'actor1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('an unknown team is a 404', async () => {
    const { service, tx } = build({ found: false });
    await expect(service.deleteIfEmpty('missing', 'actor1')).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.team.delete).not.toHaveBeenCalled();
  });

  it('quotes the table and column names it reads from the catalogue', async () => {
    const { service, tx } = build({ catalogue: [{ table_name: 'we"ird', column_name: 'col"x' }], counts: [0] });
    await service.deleteIfEmpty('t1', 'actor1');
    expect(tx.$queryRawUnsafe.mock.calls[0][0]).toBe('SELECT count(*)::int AS n FROM "we""ird" WHERE "col""x" = $1');
  });
});

describe('TeamLifecycleService.deletionCheck', () => {
  it('reports the same blockers without deleting or locking for update', async () => {
    const { service, tx } = build({ counts: [0, 3] });

    const result = await service.deletionCheck('t1');

    expect(result).toEqual({
      deletable: false,
      total: 3,
      blockers: [{ table: 'cases', column: 'assignedTeamId', count: 3 }],
    });
    expect(tx.team.delete).not.toHaveBeenCalled();
  });

  it('says a team with no references is deletable', async () => {
    const { service } = build();
    await expect(service.deletionCheck('t1')).resolves.toEqual({ deletable: true, total: 0, blockers: [] });
  });
});
