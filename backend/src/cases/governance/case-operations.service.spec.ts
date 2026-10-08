import { CaseOperationsService } from './case-operations.service';
describe('CG16 same authorized dashboard and drilldown sets', () => {
  it('queues and formulas never consume or return private pinned native header fields', async () => {
    const row = { id: 'case', name: 'PRIVATE_NAME', status: 'DANG_DIEU_TRA', deadline: new Date('2026-10-01') };
    const db = { case: { findMany: jest.fn(async () => [row]) }, caseActionRequest: { findMany: jest.fn(async () => []) } };
    const core = { readableCaseWhere: jest.fn(async () => ({ id: 'case' })), serializeCaseResult: jest.fn(async () => ({ id: 'case', status: 'DANG_DIEU_TRA' })) };
    const service = new CaseOperationsService(db as never,core as never);
    const result = await service.queue('overdue',{ actorId: 'actor' },new Date('2026-10-06'));
    expect(result.data.items).toEqual([]);
    expect(core.serializeCaseResult).toHaveBeenCalledWith(db,'case',row,{ actorId: 'actor' });
  });
  it('civil overdue excludes every deadline on the current HCM day and includes the entire seven-day due window', async () => {
    const deadlines = { yesterday: '2026-10-05T00:00:00Z', today: '2026-10-06T00:00:00Z', late_today: '2026-10-06T16:59:59Z', seventh_day: '2026-10-13T16:59:59Z', eighth_day: '2026-10-13T17:00:00Z' };
    const rows = Object.entries(deadlines).map(([id,deadline]) => ({ id, name: id, status: 'DANG_DIEU_TRA', deadline: new Date(deadline) }));
    const db = { case: { findMany: jest.fn(async () => rows) }, caseActionRequest: { findMany: jest.fn(async () => []) } };
    const core = { readableCaseWhere: jest.fn(async () => ({ id: { in: rows.map(row => row.id) } })), serializeCaseResult: jest.fn(async (_tx: unknown,_id: string,row: unknown) => row) };
    const service = new CaseOperationsService(db as never,core as never);
    const clock = new Date('2026-10-06T05:00:00Z');
    expect((await service.queue('overdue',{ actorId: 'actor' },clock)).data.items.map(row => row.id)).toEqual(['yesterday']);
    expect((await service.queue('due',{ actorId: 'actor' },clock)).data.items.map(row => row.id)).toEqual(['today','late_today','seventh_day']);
  });
  it('uses identical authorized rows/formula and one explicit clock', async () => {
    const visible = [
      {
        id: 'a',
        name: 'Case A',
        intakeStage: 'CHO_NHAN',
        investigatorId: null,
        investigationPhase: null,
        status: 'TIEP_NHAN',
        deadline: new Date('2026-10-01'),
        ngayKhoiTo: null,
      },
      {
        id: 'b',
        name: 'Case B',
        intakeStage: 'DA_NHAN',
        investigatorId: 'actor',
        investigationPhase: 'INITIAL',
        status: 'DANG_DIEU_TRA',
        deadline: new Date('2026-10-10'),
        ngayKhoiTo: new Date('2026-01-01'),
      },
    ];
    const db = {
      case: { findMany: jest.fn().mockResolvedValue(visible) },
      caseActionRequest: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ caseId: 'b', status: 'SUBMITTED' }]),
      },
    };
    const core = {
      serializeCaseResult: jest.fn(async (_tx: unknown,_id: string,row: unknown) => row),
      readableCaseWhere: jest
        .fn()
        .mockResolvedValue({ assignedTeamId: { in: ['visible'] } }),
    };
    const svc = new CaseOperationsService(db as never, core as never);
    const now = new Date('2026-10-06');
    const dashboard = await svc.dashboard({ actorId: 'actor' }, now);
    for (const bucket of dashboard.data.buckets) {
      const list = await svc.queue(bucket.key, { actorId: 'actor' }, now);
      expect(list.data.items).toHaveLength(bucket.count);
      expect(bucket.link).toContain(bucket.key);
    }
    expect(db.case.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { assignedTeamId: { in: ['visible'] } },
      }),
    );
  });
});
