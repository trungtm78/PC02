/* eslint-disable @typescript-eslint/no-unsafe-assignment -- Jest asymmetric matchers return any. */
import { IncidentStatus } from '@prisma/client';
import {
  ConflictException,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { IncidentsHandoffService } from './incidents-handoff.service';

describe('AC-02/03: bàn giao khác nhận và phân công', () => {
  const version = new Date('2026-10-05T00:00:00Z');
  const incident = {
    id: 'i1',
    status: IncidentStatus.TIEP_NHAN,
    intakeStage: 'PHAN_LOAI',
    assignedTeamId: 'source',
    updatedAt: version,
    deletedAt: null,
  };
  const pending = {
    id: 'h1',
    incidentId: 'i1',
    fromTeamId: 'source',
    toTeamId: 'target',
    state: 'PENDING',
    priorIntakeStage: 'PHAN_LOAI',
    updatedAt: version,
  };
  const db = {
    featureFlag: { findUnique: jest.fn() },
    incident: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },
    incidentHandoff: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    team: { findFirst: jest.fn() },
    userTeam: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  };
  const audit = { log: jest.fn() };
  const dispatchScope = {
    teamIds: ['source'],
    userIds: ['sender'],
    writableTeamIds: ['source'],
    writableUserIds: ['sender'],
    canDispatch: true,
  };
  let service: IncidentsHandoffService;
  beforeEach(() => {
    jest.resetAllMocks();
    db.featureFlag.findUnique.mockResolvedValue({ enabled: true });
    db.incident.findFirst.mockResolvedValue(incident);
    db.incident.findUnique.mockResolvedValue(incident);
    db.incident.updateMany.mockResolvedValue({ count: 1 });
    db.team.findFirst.mockResolvedValue({ id: 'target', isActive: true });
    db.userTeam.findFirst.mockResolvedValue({
      userId: 'receiver',
      teamId: 'target',
    });
    db.incidentHandoff.findUnique.mockResolvedValue(null);
    db.incidentHandoff.findFirst.mockResolvedValue(pending);
    db.incidentHandoff.create.mockResolvedValue(pending);
    db.incidentHandoff.updateMany.mockResolvedValue({ count: 1 });
    db.incidentHandoff.findMany.mockResolvedValue([pending]);
    db.incidentHandoff.count.mockResolvedValue(1);
    db.$transaction.mockImplementation(
      (fn: (tx: typeof db) => Promise<unknown>) => fn(db),
    );
    service = new IncidentsHandoffService(db as never, audit as never);
  });
  const send = () =>
    service.send(
      'i1',
      {
        toTeamId: 'target',
        expectedUpdatedAt: version.toISOString(),
        requestKey: 'request-1',
      },
      'sender',
      dispatchScope,
    );

  it('giao chỉ đặt CHO_NHAN, chưa đổi tổ thụ lý hoặc legal status/ngày/hạn', async () => {
    await send();
    expect(db.incident.updateMany).toHaveBeenCalledWith({
      where: { id: 'i1', updatedAt: version, deletedAt: null },
      data: { intakeStage: 'CHO_NHAN' },
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'INCIDENT_HANDOFF_SENT' }),
      db,
    );
  });
  it('chỉ người điều phối có phạm vi được giao', async () => {
    await expect(
      service.send(
        'i1',
        {
          toTeamId: 'target',
          expectedUpdatedAt: version.toISOString(),
          requestKey: 'r',
        },
        'sender',
        { ...dispatchScope, canDispatch: false },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it('pending đã tồn tại không được giao tiếp', async () => {
    db.incident.findFirst.mockResolvedValue({
      ...incident,
      intakeStage: 'CHO_NHAN',
    });
    await expect(send()).rejects.toBeInstanceOf(ConflictException);
    expect(db.incidentHandoff.create).not.toHaveBeenCalled();
  });
  it('accept khác phân công: giữ legal status/ngày/hạn và cùng Incident ID', async () => {
    db.incident.findFirst.mockResolvedValue({
      ...incident,
      intakeStage: 'CHO_NHAN',
      investigatorId: 'old-officer',
    });
    await service.accept(
      'i1',
      'h1',
      {
        expectedUpdatedAt: version.toISOString(),
        expectedHandoffUpdatedAt: version.toISOString(),
      },
      'receiver',
      { ...dispatchScope, canDispatch: false },
    );
    const call = db.incident.updateMany.mock.calls[0] as [
      { data: Record<string, unknown> },
    ];
    expect(call[0].data).toEqual({
      intakeStage: 'DA_NHAN',
      assignedTeamId: 'target',
      investigatorId: null,
    });
    expect(db.incidentHandoff.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'h1', state: 'PENDING' }),
      }),
    );
  });
  it('read grant hoặc dispatcher ngoài tổ không được accept', async () => {
    db.userTeam.findFirst.mockResolvedValue(null);
    await expect(
      service.accept(
        'i1',
        'h1',
        {
          expectedUpdatedAt: version.toISOString(),
          expectedHandoffUpdatedAt: version.toISOString(),
        },
        'sender',
        dispatchScope,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.incident.updateMany).not.toHaveBeenCalled();
  });
  it('stale version không nhận, không ghi audit thành công', async () => {
    db.incident.findFirst.mockResolvedValue({
      ...incident,
      intakeStage: 'CHO_NHAN',
    });
    db.incident.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.accept(
        'i1',
        'h1',
        {
          expectedUpdatedAt: version.toISOString(),
          expectedHandoffUpdatedAt: version.toISOString(),
        },
        'receiver',
        dispatchScope,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(audit.log).not.toHaveBeenCalled();
  });
  const resolveDto = {
    expectedUpdatedAt: version.toISOString(),
    expectedHandoffUpdatedAt: version.toISOString(),
    reason: 'Sai tổ nhận',
  };
  it('flag OFF chặn gửi mới nhưng vẫn hủy pending và khôi phục stage cũ', async () => {
    db.featureFlag.findUnique.mockResolvedValue({ enabled: false });
    await expect(send()).rejects.toBeInstanceOf(ForbiddenException);
    db.incident.findFirst.mockResolvedValue({
      ...incident,
      intakeStage: 'CHO_NHAN',
    });
    await service.cancel('i1', 'h1', resolveDto, 'sender', dispatchScope);
    expect(db.incident.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { intakeStage: 'PHAN_LOAI' } }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'INCIDENT_HANDOFF_CANCELLED' }),
      db,
    );
  });
  it('hủy cần lý do; ledger stale không ghi audit thành công', async () => {
    await expect(
      service.cancel(
        'i1',
        'h1',
        { ...resolveDto, reason: ' ' },
        'sender',
        dispatchScope,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    db.incident.findFirst.mockResolvedValue({
      ...incident,
      intakeStage: 'CHO_NHAN',
    });
    db.incidentHandoff.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.cancel('i1', 'h1', resolveDto, 'sender', dispatchScope),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(audit.log).not.toHaveBeenCalled();
  });
  it('hủy stale hồ sơ hoặc đã nhận không ghi', async () => {
    db.incident.findFirst.mockResolvedValue({
      ...incident,
      intakeStage: 'CHO_NHAN',
    });
    db.incident.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.cancel('i1', 'h1', resolveDto, 'sender', dispatchScope),
    ).rejects.toBeInstanceOf(ConflictException);
    db.incidentHandoff.findFirst.mockResolvedValue({
      ...pending,
      state: 'ACCEPTED',
    });
    await expect(
      service.cancel('i1', 'h1', resolveDto, 'sender', dispatchScope),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it('retry hủy cùng actor không tạo audit thứ hai', async () => {
    db.incidentHandoff.findFirst.mockResolvedValue({
      ...pending,
      state: 'CANCELLED',
      cancelledById: 'sender',
    });
    await service.cancel('i1', 'h1', resolveDto, 'sender', dispatchScope);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it('inbox chỉ pending thuộc tổ của người xem, FIFO và tổng', async () => {
    const response = await service.inbox(dispatchScope, 20, 20);
    expect(response.total).toBe(1);
    expect(db.incidentHandoff.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          state: 'PENDING',
          incident: { deletedAt: null },
          toTeamId: { in: ['source'] },
        },
        skip: 20,
        take: 20,
        orderBy: [{ sentAt: 'asc' }, { id: 'asc' }],
      }),
    );
  });
  it.each([
    [-1, 20],
    [0, 0],
    [0, 101],
    [1.5, 20],
  ])('inbox từ chối phân trang %s/%s', async (offset, limit) => {
    await expect(
      service.inbox(dispatchScope, offset, limit),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it('history đúng scope, người ngoài không xem; dispatcher đọc được', async () => {
    const outside = {
      ...dispatchScope,
      canDispatch: false,
      teamIds: ['other'],
      userIds: [],
    };
    await expect(service.history('i1', outside)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await service.history('i1', { ...dispatchScope, canDispatch: false });
    await service.history('i1', dispatchScope);
    expect(db.incidentHandoff.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { incidentId: 'i1' }, take: 100 }),
    );
  });
  it('hồ sơ/lượt giao không tồn tại trả 404', async () => {
    db.incident.findFirst.mockResolvedValue(null);
    await expect(send()).rejects.toBeInstanceOf(NotFoundException);
    db.incident.findFirst.mockResolvedValue(incident);
    db.incidentHandoff.findFirst.mockResolvedValue(null);
    await expect(
      service.accept('i1', 'h1', resolveDto, 'receiver', dispatchScope),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.cancel('i1', 'h1', resolveDto, 'sender', dispatchScope),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
  it('send retry cùng nội dung trả lại ledger, không gửi lần hai', async () => {
    db.incidentHandoff.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ ...pending, ...data }),
    );
    const first = await send();
    db.incidentHandoff.findUnique.mockResolvedValue(first.data);
    db.incident.findFirst.mockResolvedValue({
      ...incident,
      intakeStage: 'CHO_NHAN',
      updatedAt: new Date(),
    });
    const retry = await send();
    expect(retry.data).toEqual(first.data);
    expect(db.incidentHandoff.create).toHaveBeenCalledTimes(1);
    expect(audit.log).toHaveBeenCalledTimes(1);
    await expect(
      service.send(
        'i1',
        {
          toTeamId: 'other',
          requestKey: 'request-1',
          expectedUpdatedAt: version.toISOString(),
        },
        'sender',
        dispatchScope,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it.each([
    'terminal',
    'same-team',
    'inactive-target',
    'no-scope',
    'stale',
    'bad-date',
    'no-key',
  ])('từ chối giao %s trước transaction', async (kind) => {
    const dto = {
      toTeamId: 'target',
      expectedUpdatedAt: version.toISOString(),
      requestKey: 'r',
    };
    if (kind === 'terminal')
      db.incident.findFirst.mockResolvedValue({
        ...incident,
        status: IncidentStatus.DA_CHUYEN_VU_AN,
      });
    if (kind === 'same-team') dto.toTeamId = 'source';
    if (kind === 'inactive-target') db.team.findFirst.mockResolvedValue(null);
    if (kind === 'no-scope')
      db.incident.findFirst.mockResolvedValue({
        ...incident,
        assignedTeamId: 'outside',
      });
    if (kind === 'stale') dto.expectedUpdatedAt = '2000-01-01T00:00:00Z';
    if (kind === 'bad-date') dto.expectedUpdatedAt = 'not-a-date';
    if (kind === 'no-key') dto.requestKey = '';
    await expect(
      service.send('i1', dto, 'sender', dispatchScope),
    ).rejects.toBeInstanceOf(Error);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it('accept stale ledger không audit; retry đã nhận cùng actor không ghi nữa', async () => {
    db.incident.findFirst.mockResolvedValue({
      ...incident,
      intakeStage: 'CHO_NHAN',
    });
    db.incidentHandoff.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.accept('i1', 'h1', resolveDto, 'receiver', dispatchScope),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(audit.log).not.toHaveBeenCalled();
    db.incidentHandoff.findFirst.mockResolvedValue({
      ...pending,
      state: 'ACCEPTED',
      receivedById: 'receiver',
    });
    jest.clearAllMocks();
    await service.accept('i1', 'h1', resolveDto, 'receiver', dispatchScope);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});
