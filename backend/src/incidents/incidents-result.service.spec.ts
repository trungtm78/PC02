import { ConflictException, NotFoundException } from '@nestjs/common';
import { IncidentsService } from './incidents.service';

type IncidentRecord = Record<string, unknown> & {
  id: string;
  investigatorId?: string | null;
  assignedTeamId?: string | null;
  deletedAt: Date | null;
  updatedAt: Date;
};

function makeService(
  record: IncidentRecord | null = {
    id: 'incident-1',
    investigatorId: 'user-1',
    assignedTeamId: 'team-1',
    deletedAt: null,
    updatedAt: new Date('2026-09-01T00:00:00.000Z'),
  },
) {
  const incident = {
    findFirst: jest
      .fn<Promise<IncidentRecord | null>, [unknown]>()
      .mockResolvedValue(record),
    update: jest.fn<Promise<IncidentRecord>, [unknown]>().mockResolvedValue({
      ...record,
      id: record?.id ?? 'incident-1',
      deletedAt: record?.deletedAt ?? null,
      ketQuaXuLy: 'Đã xác minh',
      updatedAt: new Date('2026-09-02T00:00:00.000Z'),
    }),
  };
  const transactionClient = { incident };
  const transaction = jest.fn<
    Promise<unknown>,
    [(tx: typeof transactionClient) => unknown]
  >((callback) => Promise.resolve(callback(transactionClient)));
  const prisma = { incident, $transaction: transaction };
  const audit = {
    log: jest
      .fn<Promise<void>, [unknown, unknown?]>()
      .mockResolvedValue(undefined),
  };
  const service = new IncidentsService(
    prisma as never,
    audit as never,
    {} as never,
    {} as never,
    {} as never,
    { emit: jest.fn() } as never,
  );
  return { service, prisma, transactionClient, audit };
}

describe('IncidentsService.updateResult', () => {
  const scope = {
    writableUserIds: ['user-1'],
    writableTeamIds: ['team-1'],
    userIds: ['user-1'],
    teamIds: ['team-1'],
    isWardOfficer: false,
    canDispatch: false,
  };

  it('only updates result with an optimistic lock and audits the change', async () => {
    const { service, prisma, transactionClient, audit } = makeService();
    const result = await service.updateResult(
      'incident-1',
      {
        ketQuaXuLy: '  Đã xác minh  ',
        expectedUpdatedAt: '2026-09-01T00:00:00.000Z',
      },
      'actor-1',
      {},
      scope as never,
    );

    expect(prisma.incident.update).toHaveBeenCalledWith({
      where: {
        id: 'incident-1',
        updatedAt: new Date('2026-09-01T00:00:00.000Z'),
      },
      data: { ketQuaXuLy: 'Đã xác minh' },
      select: { id: true, ketQuaXuLy: true, updatedAt: true },
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'INCIDENT_RESULT_UPDATED',
        subjectId: 'incident-1',
      }),
      transactionClient,
    );
    expect(result.data.ketQuaXuLy).toBe('Đã xác minh');
  });

  it('returns 409 when another user has updated the record', async () => {
    const { service, prisma } = makeService();
    prisma.incident.update.mockRejectedValue({ code: 'P2025' });
    await expect(
      service.updateResult(
        'incident-1',
        {
          ketQuaXuLy: 'Kết quả',
          expectedUpdatedAt: '2026-09-01T00:00:00.000Z',
        },
        'actor-1',
        {},
        scope as never,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('runs the result update and audit in one transaction', async () => {
    const { service, prisma, audit } = makeService();
    await service.updateResult(
      'incident-1',
      { ketQuaXuLy: 'Kết quả', expectedUpdatedAt: '2026-09-01T00:00:00.000Z' },
      'actor-1',
      {},
      scope as never,
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.incident.update).toHaveBeenCalledTimes(1);
    expect(audit.log).toHaveBeenCalledTimes(1);
  });

  it('returns 404 for a missing incident', async () => {
    const { service } = makeService(null);
    await expect(
      service.updateResult(
        'missing',
        {
          ketQuaXuLy: 'Kết quả',
          expectedUpdatedAt: '2026-09-01T00:00:00.000Z',
        },
        'actor-1',
        {},
        scope as never,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
