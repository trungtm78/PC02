import { IncidentsBulkService } from './incidents.bulk.service';

interface RaceWrite {
  where: {
    updatedAt?: Date;
    assignedTeamId?: string | null;
    status?: string;
    documents?: { none: unknown };
  };
  data: {
    investigatorId?: string | null;
    assignedTeamId?: string;
    status?: string;
    deletedAt?: Date | null;
  };
}

function conflict(): Error & { code: string } {
  return Object.assign(new Error('Synthetic optimistic conflict'), {
    code: 'P2025',
  });
}

describe('PR01: completed handoff/status change after bulk preflight', () => {
  it('delete cannot remove a dossier with a newly added document and unchanged parent version', async () => {
    const checked = {
      id: 'i1',
      updatedAt: new Date('2026-10-06'),
      status: 'TIEP_NHAN',
      intakeStage: null,
      assignedTeamId: 'A',
      investigatorId: null as string | null,
      deletedAt: null as Date | null,
      documents: [],
      petitions: [],
    };
    let documentAdded = false;
    let deleted = false;
    const update = jest.fn(({ where }: RaceWrite) => {
      if (where.documents?.none && documentAdded) throw conflict();
      deleted = true;
      return Promise.resolve(checked);
    });
    const db = {
      incident: { findMany: jest.fn().mockResolvedValue([checked]) },
      $transaction: jest.fn((fn: (tx: unknown) => unknown) => {
        documentAdded = true;
        return fn({ incident: { update } });
      }),
    };
    const audit = {
      logBulkHeader: jest.fn().mockResolvedValue({ bulkOperationId: 'op' }),
      logBulkItem: jest.fn(),
      completeBulk: jest.fn(),
    };
    const result = await new IncidentsBulkService(
      db as never,
      audit as never,
    ).bulkDelete({
      ids: ['i1'],
      actorId: 'actor',
      dataScope: null,
      reason: 'Synthetic attachment race',
    });
    expect(result.succeeded).toHaveLength(0);
    expect(deleted).toBe(false);
    expect(audit.logBulkItem).not.toHaveBeenCalled();
  });
  it.each(['assign', 'delete'] as const)(
    '%s cannot mutate a dossier handed to another team after preflight',
    async (operation) => {
      const checked = {
        id: 'i1',
        updatedAt: new Date('2026-10-06'),
        status: operation === 'delete' ? 'TIEP_NHAN' : 'DANG_XAC_MINH',
        intakeStage: 'DA_NHAN',
        assignedTeamId: 'team-A',
        investigatorId: null as string | null,
        deletedAt: null as Date | null,
        petitions: [],
        documents: [],
      };
      const received = {
        ...checked,
        updatedAt: new Date(checked.updatedAt.getTime() + 10),
        assignedTeamId: 'team-B',
      };
      let current = checked;
      const update = jest.fn(({ where, data }: RaceWrite) => {
        if (
          (where.updatedAt &&
            where.updatedAt.getTime() !== current.updatedAt.getTime()) ||
          (where.assignedTeamId !== undefined &&
            where.assignedTeamId !== current.assignedTeamId) ||
          (where.status && where.status !== current.status)
        )
          throw conflict();
        current = { ...current, ...data };
        return Promise.resolve(current);
      });
      const db = {
        user: {
          findFirst: jest
            .fn()
            .mockResolvedValue({ id: 'inv', status: 'active' }),
        },
        incident: { findMany: jest.fn().mockResolvedValue([checked]) },
        $transaction: jest.fn((fn: (tx: unknown) => unknown) => {
          current = received;
          return fn({ incident: { update } });
        }),
      };
      const audit = {
        logBulkHeader: jest.fn().mockResolvedValue({ bulkOperationId: 'op' }),
        logBulkItem: jest.fn(),
        completeBulk: jest.fn(),
      };
      const service = new IncidentsBulkService(db as never, audit as never);
      const base = {
        ids: ['i1'],
        actorId: 'actor',
        reason: 'Synthetic bulk race',
        dataScope: {
          canDispatch: true,
          userIds: ['actor'],
          writableUserIds: ['actor'],
          teamIds: ['team-A'],
          writableTeamIds: ['team-A'],
        },
      };
      const result =
        operation === 'assign'
          ? await service.bulkAssign({ ...base, investigatorId: 'inv' })
          : await service.bulkDelete(base);
      expect(result.succeeded).toHaveLength(0);
      expect(result.skipped).toEqual([
        expect.objectContaining({
          id: 'i1',
          reason: 'CONCURRENT_MODIFICATION',
        }),
      ]);
      expect(current).toEqual(received);
      expect(audit.logBulkItem).not.toHaveBeenCalled();
    },
  );
  it('assign cannot reopen a dossier prosecuted after preflight without client timestamp', async () => {
    const checked = {
      id: 'i1',
      updatedAt: new Date('2026-10-06'),
      status: 'DANG_XAC_MINH',
      intakeStage: 'DA_NHAN',
      assignedTeamId: 'A',
      investigatorId: null as string | null,
    };
    const prosecuted = {
      ...checked,
      updatedAt: new Date(checked.updatedAt.getTime() + 10),
      status: 'DA_CHUYEN_VU_AN',
    };
    let current = checked;
    const update = jest.fn(({ where, data }: RaceWrite) => {
      if (
        (where.updatedAt &&
          where.updatedAt.getTime() !== current.updatedAt.getTime()) ||
        (where.status && where.status !== current.status)
      )
        throw conflict();
      current = { ...current, ...data };
      return Promise.resolve(current);
    });
    const db = {
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'inv', status: 'active' }),
      },
      incident: { findMany: jest.fn().mockResolvedValue([checked]) },
      $transaction: jest.fn((fn: (tx: unknown) => unknown) => {
        current = prosecuted;
        return fn({ incident: { update } });
      }),
    };
    const audit = {
      logBulkHeader: jest.fn().mockResolvedValue({ bulkOperationId: 'op' }),
      logBulkItem: jest.fn(),
      completeBulk: jest.fn(),
    };
    const result = await new IncidentsBulkService(
      db as never,
      audit as never,
    ).bulkAssign({
      ids: ['i1'],
      actorId: 'actor',
      investigatorId: 'inv',
      reason: 'Synthetic race',
      dataScope: { canDispatch: true } as never,
    });
    expect(result.succeeded).toHaveLength(0);
    expect(current).toEqual(prosecuted);
    expect(audit.logBulkItem).not.toHaveBeenCalled();
  });
});
