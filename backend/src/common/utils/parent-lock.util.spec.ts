import { PARENT_TABLE, withParentLock } from './parent-lock.util';

/**
 * ND-19. The child services loaded the parent, checked it was alive and in
 * scope, then inserted the child in a separate statement. Between the two the
 * parent can be soft-deleted, and the child lands on a deleted file — present
 * in the table, absent from every screen, and missed by every cascade.
 */
describe('withParentLock', () => {
  function makePrisma() {
    const tx = {
      // Typed with its real signature so the assertions can read the SQL and
      // the bound id back out; an argument-less mock infers an empty tuple.
      $queryRawUnsafe: jest.fn((sql: string, id: string) =>
        Promise.resolve([sql, id]),
      ),
      marker: 'tx',
    };
    const prisma = {
      $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)),
    };
    return { prisma, tx };
  }

  it('runs the body inside a transaction', async () => {
    const { prisma } = makePrisma();

    await withParentLock(prisma as never, 'case', 'c-1', () =>
      Promise.resolve('done'),
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('locks the parent row before the body runs', async () => {
    // The order is the whole point: taking the lock after the insert would
    // protect nothing.
    const { prisma, tx } = makePrisma();
    const seen: string[] = [];
    tx.$queryRawUnsafe.mockImplementation(() => {
      seen.push('lock');
      return Promise.resolve([]);
    });

    await withParentLock(prisma as never, 'case', 'c-1', () => {
      seen.push('body');
      return Promise.resolve(null);
    });

    expect(seen).toEqual(['lock', 'body']);
  });

  it('locks the table matching the parent kind', async () => {
    const { prisma, tx } = makePrisma();

    await withParentLock(prisma as never, 'incident', 'i-1', () =>
      Promise.resolve(null),
    );

    const [sql, id] = tx.$queryRawUnsafe.mock.calls[0];
    expect(sql).toContain('"incidents"');
    expect(sql).toContain('FOR UPDATE');
    expect(id).toBe('i-1');
  });

  it('binds the id rather than interpolating it', async () => {
    // The table name comes from a frozen map; the id comes from a request, so
    // it stays a bound parameter and never reaches the SQL string.
    const { prisma, tx } = makePrisma();

    await withParentLock(
      prisma as never,
      'petition',
      "p-1'; DROP TABLE cases;--",
      () => Promise.resolve(null),
    );

    const [sql, id] = tx.$queryRawUnsafe.mock.calls[0];
    expect(sql).not.toContain('DROP TABLE');
    expect(sql).toContain('$1');
    expect(id).toBe("p-1'; DROP TABLE cases;--");
  });

  it('passes the transaction client to the body, not the outer prisma', async () => {
    // A body that wrote through the outer client would be outside the lock and
    // outside the rollback — exactly the bug this helper exists to remove.
    const { prisma, tx } = makePrisma();

    const received = await withParentLock(prisma as never, 'case', 'c-1', (t) =>
      Promise.resolve(t),
    );

    expect(received).toBe(tx);
  });

  it('propagates a failure so the child insert rolls back', async () => {
    const { prisma } = makePrisma();

    await expect(
      withParentLock(prisma as never, 'case', 'c-1', () =>
        Promise.reject(new Error('scope refused')),
      ),
    ).rejects.toThrow('scope refused');
  });

  it('names only real tables', () => {
    expect(Object.values(PARENT_TABLE)).toEqual([
      'cases',
      'incidents',
      'petitions',
    ]);
  });
});
