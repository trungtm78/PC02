import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ChildRestoreService } from './child-restore.service';
import { CHILD_RESTORE_TARGETS, findTarget } from './child-restore.registry';

/**
 * E3. Nine child models had `deletedAt` and no way back. Soft delete you cannot
 * undo is soft in name only: the record leaves every screen and the sole
 * recovery is `UPDATE ... SET deleted_at = NULL` in psql. On a criminal file,
 * "ask an administrator to edit the database" is not a procedure anyone wants
 * to write down.
 *
 * One config table instead of nine near-identical services. The "third entity"
 * threshold passed long ago — Case, Incident, Petition and Evidence each carry
 * their own copy, and those four have already drifted apart.
 */
function makeService(over: Record<string, unknown> = {}) {
  // Typed with the argument they really take so the assertions can read the
  // recorded call back; an argument-less mock infers a zero-length tuple.
  type Args = Record<string, unknown>;
  const delegate = {
    findMany: jest.fn((args: Args) => Promise.resolve([{ id: 's-1', args }])),
    count: jest.fn((args: Args) =>
      Promise.resolve(Object.keys(args).length ? 1 : 1),
    ),
    findFirst: jest.fn((args: Args) => Promise.resolve({ id: 's-1', args })),
    update: jest.fn((args: Args) =>
      Promise.resolve({ id: 's-1', deletedAt: null, args }),
    ),
  };
  const prisma: Record<string, unknown> = {
    subject: delegate,
    lawyer: delegate,
    guidanceRecord: delegate,
    proposal: delegate,
    ...over,
  };
  const audit = {
    log: jest.fn((entry: Record<string, unknown>) => Promise.resolve(entry)),
  };
  const svc = new ChildRestoreService(prisma as never, audit as never);
  return { svc, delegate, audit, prisma };
}

const scope = {
  teamIds: ['team-a'],
  writableTeamIds: ['team-a'],
  userIds: ['u-1'],
  writableUserIds: ['u-1'],
  canDispatch: false,
} as never;

describe('registry', () => {
  it('covers the nine entities the plan named', () => {
    expect(CHILD_RESTORE_TARGETS).toHaveLength(9);
    for (const t of CHILD_RESTORE_TARGETS) {
      expect(t.searchFields.length).toBeGreaterThan(0);
    }
  });

  it('uses the right column for the one model that names its parent differently', () => {
    // `Proposal` links through `relatedCaseId`. Assuming `caseId` everywhere
    // would silently drop scope filtering for that one type.
    expect(findTarget('proposals')?.parent).toEqual({
      kind: 'case',
      column: 'relatedCaseId',
    });
  });
});

describe('listDeleted', () => {
  it('lists only deleted rows, newest first', async () => {
    const { svc, delegate } = makeService();

    await svc.listDeleted('subjects', {}, scope);

    const args = delegate.findMany.mock.calls[0][0];
    expect((args.where as Record<string, unknown>).deletedAt).toEqual({
      not: null,
    });
    expect(args.orderBy).toEqual({ deletedAt: 'desc' });
  });

  it('filters through the parent case when there is one', async () => {
    const { svc, delegate } = makeService();

    await svc.listDeleted('subjects', {}, scope);

    const where = delegate.findMany.mock.calls[0][0].where as Record<
      string,
      unknown
    >;
    expect(where.case).toBeDefined();
  });

  it('applies no team filter to a type with no parent', async () => {
    // Guidance records, exchanges and calendar events hang off nothing, so
    // there is no team to scope by. The permission is the only gate, and the
    // absence of a filter here is a decision rather than an oversight.
    const { svc, delegate } = makeService();

    await svc.listDeleted('guidance-records', {}, scope);

    const where = delegate.findMany.mock.calls[0][0].where as Record<
      string,
      unknown
    >;
    expect(where.case).toBeUndefined();
  });

  it('caps the page size', async () => {
    const { svc, delegate } = makeService();

    await svc.listDeleted('subjects', { limit: 9999 }, scope);

    expect(delegate.findMany.mock.calls[0][0].take).toBe(100);
  });

  it('404s on an unknown resource rather than returning nothing', async () => {
    const { svc } = makeService();

    await expect(svc.listDeleted('khong-co', {}, scope)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('fails loudly when the registry names a model that does not exist', async () => {
    // Renaming a Prisma model without updating the registry would otherwise
    // return an empty list, which reads as "nothing was deleted".
    const { svc } = makeService({ subject: undefined as unknown as object });

    await expect(svc.listDeleted('subjects', {}, scope)).rejects.toThrow(
      BadRequestException,
    );
  });
});

describe('restore', () => {
  it('clears deletedAt and audits with the reason', async () => {
    const { svc, delegate, audit } = makeService();

    await svc.restore(
      'subjects',
      's-1',
      'Xoá nhầm khi dọn hồ sơ trùng.',
      'u-1',
      scope,
    );

    expect(delegate.update.mock.calls[0][0].data).toEqual({ deletedAt: null });
    expect(audit.log.mock.calls[0][0]).toMatchObject({
      action: 'CHILD_RECORD_RESTORED',
      subjectId: 's-1',
    });
  });

  it('demands a reason', async () => {
    // Restoring is reversing somebody else's decision; the log entry is only
    // worth having if it says why.
    const { svc } = makeService();

    await expect(
      svc.restore('subjects', 's-1', 'ngắn', 'u-1', scope),
    ).rejects.toThrow(BadRequestException);
  });

  it('refuses a record that is not deleted or is out of scope', async () => {
    const { svc } = makeService({
      subject: {
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(() => Promise.resolve(null)),
        update: jest.fn(),
      },
    });

    await expect(
      svc.restore(
        'subjects',
        's-1',
        'Xoá nhầm khi dọn hồ sơ trùng.',
        'u-1',
        scope,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('gives one message for all three refusals', async () => {
    // Separating "does not exist", "not deleted" and "another team's" turns
    // this endpoint into a probe for ids in other units.
    const { svc } = makeService({
      subject: {
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(() => Promise.resolve(null)),
        update: jest.fn(),
      },
    });

    await expect(
      svc.restore(
        'subjects',
        's-1',
        'Xoá nhầm khi dọn hồ sơ trùng.',
        'u-1',
        scope,
      ),
    ).rejects.toThrow(/đã xoá, hoặc nằm ngoài phạm vi/);
  });

  it('does not write when the lookup refused', async () => {
    const { svc, prisma } = makeService({
      subject: {
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(() => Promise.resolve(null)),
        update: jest.fn(),
      },
    });

    await expect(
      svc.restore(
        'subjects',
        's-1',
        'Xoá nhầm khi dọn hồ sơ trùng.',
        'u-1',
        scope,
      ),
    ).rejects.toThrow(NotFoundException);
    expect(
      (prisma.subject as { update: jest.Mock }).update,
    ).not.toHaveBeenCalled();
  });
});
