import { CaseChildAccessService } from '../case-child-access/case-child-access.service';
import { ordinaryChildFixture } from '../case-child-access/test-child-access-fixture';
import { CaseSourceCreationService } from '../case-child-access/case-source-creation.service';
import { ordinarySourceFixture, setSourceFixtureScope } from '../case-child-access/test-source-creation-fixture';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { IncidentsService } from './incidents.service';

function factory() {
  const source = {
    id: 'i1',
    code: 'VV1',
    name: 'Synthetic',
    status: 'TIEP_NHAN',
    intakeStage: 'PHAN_LOAI',
    investigatorId: null,
    assignedTeamId: 't1',
    deletedAt: null,
    updatedAt: new Date('2026-10-06'),
  };
  const db = {
    incident: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ ...source, ...data }),
        ),
      update: jest.fn().mockResolvedValue(source),
    },
    documentNumberLog: { update: jest.fn() },
    $transaction: jest.fn(),
  };
  db.$transaction.mockImplementation(
    (fn: (tx: typeof db) => Promise<unknown>) => fn(db),
  );
  const audit = { log: jest.fn() };
  const service = new IncidentsService(
    db as never,
    audit as never,
    {} as never,
    { getActive: jest.fn().mockResolvedValue(null) } as never,
    {
      commitWithTx: jest
        .fn()
        .mockResolvedValue({ number: 'VV1', logId: 'log1' }),
    } as never,
    { emit: jest.fn() } as never, ordinarySourceFixture(db as never), ordinaryChildFixture(db as never) as never
  );
  const create = service.create.bind(service) as (
    ...args: unknown[]
  ) => Promise<{ data: typeof source & { createRequestHash: string } }>;
  return { db, service, audit, source, create };
}

describe('Production compatibility: intake and existing endpoints', () => {
  it('intake option is separate from existing fifth idempotency argument and marks source stage', async () => {
    const { create, db } = factory();
    await create(
      { name: 'Synthetic' },
      'actor',
      undefined,
      undefined,
      'key-1',
      { intake: true },
    );
    expect(db.incident.create).toHaveBeenCalledWith(
      expect.objectContaining<Record<string, unknown>>({
        data: expect.objectContaining<Record<string, unknown>>({
          intakeStage: 'PHAN_LOAI',
          createRequestKey: 'key-1',
        }),
      }),
    );
  });
  it('same key/body across normal and intake modes conflicts rather than replaying the wrong stage', async () => {
    const { create, db } = factory();
    const normal = await create(
      { name: 'Synthetic' },
      'actor',
      undefined,
      undefined,
      'key-1',
    );
    db.incident.findFirst.mockResolvedValue(normal.data);
    await expect(
      create({ name: 'Synthetic' }, 'actor', undefined, undefined, 'key-1', {
        intake: true,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(db.incident.create).toHaveBeenCalledTimes(1);
  });
  it('existing result endpoint cannot write a pending dossier', async () => {
    const { service, db, source } = factory();
    db.incident.findFirst.mockResolvedValue({
      ...source,
      intakeStage: 'CHO_NHAN',
    });
    await expect(
      service.updateResult(
        source.id,
        {
          ketQuaXuLy: 'Text',
          expectedUpdatedAt: source.updatedAt.toISOString(),
        },
        'actor',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it('result writes guard checked stage/owner as well as client version', async () => {
    const { service, db, source } = factory();
    db.incident.findFirst.mockResolvedValue(source);
    await service.updateResult(
      source.id,
      { ketQuaXuLy: 'Text', expectedUpdatedAt: source.updatedAt.toISOString() },
      'actor',
    );
    expect(db.incident.update).toHaveBeenCalledWith(
      expect.objectContaining<Record<string, unknown>>({
        where: expect.objectContaining<Record<string, unknown>>({
          id: source.id,
          updatedAt: source.updatedAt,
          intakeStage: 'PHAN_LOAI',
          assignedTeamId: 't1',
          investigatorId: null,
          status: 'TIEP_NHAN',
          deletedAt: null,
        }),
      }),
    );
  });
});
