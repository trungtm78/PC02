import { CaseChildAccessService } from '../case-child-access/case-child-access.service';
import { ordinaryChildFixture } from '../case-child-access/test-child-access-fixture';
import { CaseSourceCreationService } from '../case-child-access/case-source-creation.service';
import { ordinarySourceFixture, setSourceFixtureScope } from '../case-child-access/test-source-creation-fixture';
import { randomUUID } from 'node:crypto';
import {
  IncidentStatus,
  LyDoTamDinhChiVuViec,
  CaseProvenance,
  Incident,
  Prisma,
} from '@prisma/client';
import { CasesService } from '../cases/cases.service';
import { DocumentNumbersService } from '../document-numbers/document-numbers.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { IncidentsHandoffService } from './incidents-handoff.service';
import { IncidentsService } from './incidents.service';
import { IncidentsBulkService } from './bulk/incidents.bulk.service';
import type { DataScope } from '../auth/services/unit-scope.service';
import {
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

// Explicit opt-in: never connects to the normal app database during unit suites.
const url = process.env.INCIDENT_UAT_DATABASE_URL;
const suite = url ? describe : describe.skip;
suite('DB integration: giao/nhận/rollback/concurrency trên UAT cô lập', () => {
  let db: PrismaService;
  let service: IncidentsHandoffService;
  let audit: AuditService;
  let sender: string;
  let receiver: string;
  let receiver2: string;
  let sourceTeam: string;
  let targetTeam: string;
  let sendScope: DataScope;
  let receiveScope: DataScope;
  beforeAll(async () => {
    const target = new URL(url!);
    if (
      !['localhost', '127.0.0.1'].includes(target.hostname) ||
      target.pathname !== '/pc02_incident_release_uat' ||
      target.port !== '55441'
    )
      throw new Error('Refuse non-isolated database');
    process.env.DATABASE_URL = url;
    db = new PrismaService();
    await db.$connect();
    audit = new AuditService(db);
    service = new IncidentsHandoffService(db, audit);
    const tag = randomUUID();
    const role = await db.role.create({
      data: { name: 'UAT_INCIDENT_' + tag },
    });
    const users = await Promise.all(
      ['sender', 'receiver', 'receiver2'].map((kind) =>
        db.user.create({
          data: {
            username: kind + tag,
            passwordHash: 'not-a-login-credential',
            roleId: role.id,
          },
        }),
      ),
    );
    [sender, receiver, receiver2] = users.map((u) => u.id);
    const teams = await Promise.all(
      ['source', 'target'].map((kind) =>
        db.team.create({ data: { name: kind + tag, code: kind + tag } }),
      ),
    );
    [sourceTeam, targetTeam] = teams.map((t) => t.id);
    await db.userTeam.createMany({
      data: [
        { userId: sender, teamId: sourceTeam },
        { userId: receiver, teamId: targetTeam },
        { userId: receiver2, teamId: targetTeam },
      ],
    });
    await db.featureFlag.upsert({
      where: { key: 'INCIDENT_INTAKE_HANDOFF' },
      create: { key: 'INCIDENT_INTAKE_HANDOFF', label: 'UAT', enabled: true },
      update: { enabled: true },
    });
    sendScope = {
      teamIds: [sourceTeam],
      writableTeamIds: [sourceTeam],
      userIds: [sender],
      writableUserIds: [sender],
      canDispatch: true,
    };
    receiveScope = {
      teamIds: [targetTeam],
      writableTeamIds: [targetTeam],
      userIds: [receiver, receiver2],
      writableUserIds: [receiver, receiver2],
    };
  }, 30000);
  afterAll(async () => {
    await db?.$disconnect();
  });
  const createSource = () =>
    db.incident.create({
      data: {
        code: 'UAT-' + randomUUID(),
        name: 'Vụ việc UAT',
        status: IncidentStatus.DANG_XAC_MINH,
        assignedTeamId: sourceTeam,
        intakeStage: 'PHAN_LOAI',
        ngayDeXuat: new Date('2026-09-01'),
        deadline: new Date('2026-10-20'),
      },
    });
  const send = async () => {
    const incident = await createSource();
    const result = await service.send(
      incident.id,
      {
        toTeamId: targetTeam,
        requestKey: randomUUID(),
        expectedUpdatedAt: incident.updatedAt.toISOString(),
      },
      sender,
      sendScope,
    );
    const pending = await db.incident.findUniqueOrThrow({
      where: { id: incident.id },
    });
    return {
      incident,
      pending,
      handoff: result.data,
      dto: {
        expectedUpdatedAt: pending.updatedAt.toISOString(),
        expectedHandoffUpdatedAt: result.data.updatedAt.toISOString(),
      },
    };
  };
  it('hai retry cùng request key nhận cùng một ledger và chỉ một audit', async () => {
    const source = await createSource();
    const dto = {
      toTeamId: targetTeam,
      expectedUpdatedAt: source.updatedAt.toISOString(),
      requestKey: randomUUID(),
    };
    const requests = await Promise.allSettled([
      service.send(source.id, dto, sender, sendScope),
      service.send(source.id, dto, sender, sendScope),
    ]);
    expect(requests.every((r) => r.status === 'fulfilled')).toBe(true);
    expect(
      await db.incidentHandoff.count({ where: { incidentId: source.id } }),
    ).toBe(1);
    expect(
      await db.auditLog.count({
        where: { subjectId: source.id, action: 'INCIDENT_HANDOFF_SENT' },
      }),
    ).toBe(1);
  });
  it('giao và nhận giữ cùng ID/code/status/ngày/hạn, ghi audit thật', async () => {
    const x = await send();
    expect(x.pending.assignedTeamId).toBe(sourceTeam);
    await service.accept(
      x.incident.id,
      x.handoff.id,
      x.dto,
      receiver,
      receiveScope,
    );
    const received = await db.incident.findUniqueOrThrow({
      where: { id: x.incident.id },
    });
    expect(received.intakeStage).toBe('DA_NHAN');
    expect(received.assignedTeamId).toBe(targetTeam);
    expect([
      received.id,
      received.code,
      received.status,
      received.ngayDeXuat,
      received.deadline,
    ]).toEqual([
      x.incident.id,
      x.incident.code,
      x.incident.status,
      x.incident.ngayDeXuat,
      x.incident.deadline,
    ]);
    expect(
      await db.auditLog.count({
        where: {
          subjectId: x.incident.id,
          action: 'INCIDENT_HANDOFF_ACCEPTED',
        },
      }),
    ).toBe(1);
  });
  it('hai người nhận song song chỉ một commit', async () => {
    const x = await send();
    const attempts = await Promise.allSettled([
      service.accept(
        x.incident.id,
        x.handoff.id,
        x.dto,
        receiver,
        receiveScope,
      ),
      service.accept(
        x.incident.id,
        x.handoff.id,
        x.dto,
        receiver2,
        receiveScope,
      ),
    ]);
    expect(attempts.filter((a) => a.status === 'fulfilled')).toHaveLength(1);
    expect(
      await db.auditLog.count({
        where: {
          subjectId: x.incident.id,
          action: 'INCIDENT_HANDOFF_ACCEPTED',
        },
      }),
    ).toBe(1);
  });
  it('lượt giao stale rollback cả đổi stage/tổ của Incident', async () => {
    const x = await send();
    await expect(
      service.accept(
        x.incident.id,
        x.handoff.id,
        { ...x.dto, expectedHandoffUpdatedAt: '2000-01-01T00:00:00Z' },
        receiver,
        receiveScope,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    const after = await db.incident.findUniqueOrThrow({
      where: { id: x.incident.id },
    });
    expect(after.intakeStage).toBe('CHO_NHAN');
    expect(after.assignedTeamId).toBe(sourceTeam);
    expect(
      await db.auditLog.count({
        where: {
          subjectId: x.incident.id,
          action: 'INCIDENT_HANDOFF_ACCEPTED',
        },
      }),
    ).toBe(0);
  });
  it('người giao không thuộc tổ nhận không accept, dù có dispatch', async () => {
    const x = await send();
    await expect(
      service.accept(x.incident.id, x.handoff.id, x.dto, sender, sendScope),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('pending không đi vòng qua status hoặc khởi tố thường', async () => {
    const x = await send();
    const incidents = new IncidentsService(
      db,
      audit,
      {} as never,
      {} as never,
      {} as never,
      new EventEmitter2(), ordinarySourceFixture(db), ordinaryChildFixture(db) as never
    );
    await expect(
      incidents.updateStatus(
        x.incident.id,
        { status: IncidentStatus.TAM_DINH_CHI },
        sender,
        undefined,
        sendScope,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      incidents.prosecute(
        x.incident.id,
        {
          caseName: 'VA UAT',
          prosecutionDecision: 'QD-UAT',
          prosecutionDate: '2026-10-05',
        },
        sender,
        undefined,
        sendScope,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(
      await db.case.count({ where: { linkedIncidentId: x.incident.id } }),
    ).toBe(0);
    await expect(
      incidents.assignInvestigator(
        x.incident.id,
        { assignedTeamId: targetTeam },
        sender,
        undefined,
        sendScope,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(
      (await db.incident.findUniqueOrThrow({ where: { id: x.incident.id } }))
        .assignedTeamId,
    ).toBe(sourceTeam);
  });
  it('PUT không phân công hồ sơ phân loại trước nhận', async () => {
    const source = await createSource();
    const incidents = new IncidentsService(
      db,
      audit,
      {} as never,
      {} as never,
      {} as never,
      new EventEmitter2(), ordinarySourceFixture(db), ordinaryChildFixture(db) as never
    );
    await expect(
      incidents.update(
        source.id,
        { assignedTeamId: targetTeam },
        sender,
        undefined,
        sendScope,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(
      (await db.incident.findUniqueOrThrow({ where: { id: source.id } }))
        .assignedTeamId,
    ).toBe(sourceTeam);
  });
  it.each(['update', 'status', 'assign'] as const)(
    'giao đồng thời chặn %s dù không gửi timestamp',
    async (operation) => {
      const source = await createSource();
      await db.incident.update({
        where: { id: source.id },
        data: { intakeStage: 'DA_NHAN' },
      });
      const ready = await db.incident.findUniqueOrThrow({
        where: { id: source.id },
      });
      const incidents = new IncidentsService(
        db,
        audit,
        {} as never,
        {} as never,
        {} as never,
        new EventEmitter2(), ordinarySourceFixture(db), ordinaryChildFixture(db) as never
      );
      // The service awaits this delegate. This test adapter models the awaited
      // result instead of Prisma's fluent relation-client methods.
      const reader = db.incident as unknown as {
        findFirst(
          this: void,
          args?: Prisma.IncidentFindFirstArgs,
        ): Promise<Incident | null>;
      };
      const originalRead = reader.findFirst;
      let release!: () => void;
      let readDone!: () => void;
      const paused = new Promise<void>((resolve) => {
        release = resolve;
      });
      const didRead = new Promise<void>((resolve) => {
        readDone = resolve;
      });
      const spy = jest
        .spyOn(reader, 'findFirst')
        .mockImplementationOnce(async (args) => {
          const value = await originalRead(args);
          readDone();
          await paused;
          return value;
        });
      const action =
        operation === 'update'
          ? incidents.update(
              ready.id,
              { description: 'Không được ghi khi đang giao' },
              sender,
              undefined,
              sendScope,
            )
          : operation === 'status'
            ? incidents.updateStatus(
                ready.id,
                {
                  status: IncidentStatus.TAM_DINH_CHI,
                  decisionNumber: 'QD-RACE',
                  decisionDate: '2026-10-06',
                  lyDoTamDinhChiVuViec: [
                    LyDoTamDinhChiVuViec.CHUA_CO_KET_QUA_GIAM_DINH,
                  ],
                },
                sender,
                undefined,
                sendScope,
              )
            : incidents.assignInvestigator(
                ready.id,
                { assignedTeamId: targetTeam },
                sender,
                undefined,
                sendScope,
              );
      const outcome = action.then(
        () => null,
        (error: unknown) => error,
      );
      try {
        await didRead;
        await service.send(
          ready.id,
          {
            toTeamId: targetTeam,
            expectedUpdatedAt: ready.updatedAt.toISOString(),
            requestKey: randomUUID(),
          },
          sender,
          sendScope,
        );
        release();
        expect(await outcome).toBeInstanceOf(ConflictException);
        const after = await db.incident.findUniqueOrThrow({
          where: { id: ready.id },
        });
        expect(after.intakeStage).toBe('CHO_NHAN');
        expect(after.status).toBe(ready.status);
        expect(after.assignedTeamId).toBe(sourceTeam);
        expect(after.description).toBe(ready.description);
      } finally {
        release();
        spy.mockRestore();
      }
    },
  );
  it('Case form: audit lỗi rollback Case/link/history, nhận đủ mới khởi tố', async () => {
    const source = await createSource();
    const cases = new CasesService(
      db,
      audit,
      {} as never,
      new DocumentNumbersService(db),
      new EventEmitter2(),
    );
    const dto = {
      name: 'Case UAT ' + randomUUID(),
      caseProvenance: CaseProvenance.FROM_INCIDENT,
      linkedIncidentId: source.id,
      expectedIncidentUpdatedAt: source.updatedAt.toISOString(),
      soQuyetDinhKhoiTo: 'QD-UAT',
      ngayKhoiTo: '2026-10-06',
    };
    await expect(
      cases.create(dto, sender, undefined, sendScope),
    ).rejects.toBeInstanceOf(BadRequestException);
    const ready = await db.incident.update({
      where: { id: source.id },
      data: { intakeStage: 'DA_NHAN', description: 'Full verified source' },
    });
    dto.expectedIncidentUpdatedAt = ready.updatedAt.toISOString();
    const spy = jest
      .spyOn(audit, 'log')
      .mockRejectedValueOnce(new Error('synthetic audit failure'));
    try {
      await expect(
        cases.create(dto, sender, undefined, sendScope),
      ).rejects.toThrow('synthetic audit failure');
      expect(
        await db.case.count({ where: { linkedIncidentId: source.id } }),
      ).toBe(0);
      expect(
        await db.incidentStatusHistory.count({
          where: { incidentId: source.id },
        }),
      ).toBe(0);
      expect(
        (await db.incident.findUniqueOrThrow({ where: { id: source.id } }))
          .linkedCaseId,
      ).toBeNull();
    } finally {
      spy.mockRestore();
    }
    const attempts = await Promise.allSettled([
      cases.create(dto, sender, undefined, sendScope),
      cases.create(
        { ...dto, name: dto.name + '2' },
        sender,
        undefined,
        sendScope,
      ),
    ]);
    expect(attempts.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    const created = await db.case.findFirstOrThrow({
      where: { linkedIncidentId: source.id },
    });
    expect(created.soQuyetDinhKhoiTo).toBe('QD-UAT');
    expect(created.moTaChiTiet).toBe(ready.description);
    expect(created.deadline).toBeNull();
    expect(
      (created.metadata as { incidentSourceSnapshot: { id: string } })
        .incidentSourceSnapshot.id,
    ).toBe(source.id);
    expect(
      await db.auditLog.count({
        where: { subjectId: source.id, action: 'INCIDENT_PROSECUTED' },
      }),
    ).toBe(1);
    expect(
      await db.incidentStatusHistory.count({
        where: {
          incidentId: source.id,
          toStatus: IncidentStatus.DA_CHUYEN_VU_AN,
        },
      }),
    ).toBe(1);
  });
  it('A03: restored transfer rolls back source and history when audit fails', async () => {
    const source = await createSource();
    const ready = await db.incident.update({
      where: { id: source.id },
      data: {
        intakeStage: 'DA_NHAN',
        status: IncidentStatus.PHUC_HOI_NGUON_TIN,
      },
    });
    const incidents = new IncidentsService(
      db,
      audit,
      {} as never,
      {} as never,
      {} as never,
      new EventEmitter2(), ordinarySourceFixture(db), ordinaryChildFixture(db) as never
    );
    const spy = jest
      .spyOn(audit, 'log')
      .mockRejectedValueOnce(new Error('synthetic transfer audit failure'));
    try {
      await expect(
        incidents.transferUnit(
          source.id,
          {
            donViMoi: 'Synthetic unit',
            expectedUpdatedAt: ready.updatedAt.toISOString(),
          },
          sender,
          undefined,
          sendScope,
        ),
      ).rejects.toThrow('synthetic transfer audit failure');
      const unchanged = await db.incident.findUniqueOrThrow({
        where: { id: source.id },
      });
      expect(unchanged.status).toBe(IncidentStatus.PHUC_HOI_NGUON_TIN);
      expect(unchanged.updatedAt).toEqual(ready.updatedAt);
      expect(unchanged.chuyenDenDonVi).toBeNull();
      expect(
        await db.incidentStatusHistory.count({
          where: { incidentId: source.id },
        }),
      ).toBe(0);
      expect(await db.auditLog.count({ where: { subjectId: source.id } })).toBe(
        0,
      );
    } finally {
      spy.mockRestore();
    }
    await incidents.transferUnit(
      source.id,
      {
        donViMoi: 'Synthetic unit',
        expectedUpdatedAt: ready.updatedAt.toISOString(),
      },
      sender,
      undefined,
      sendScope,
    );
    expect(
      (await db.incident.findUniqueOrThrow({ where: { id: source.id } }))
        .status,
    ).toBe(IncidentStatus.DA_CHUYEN_DON_VI);
    expect(
      await db.incidentStatusHistory.count({
        where: {
          incidentId: source.id,
          fromStatus: IncidentStatus.PHUC_HOI_NGUON_TIN,
          toStatus: IncidentStatus.DA_CHUYEN_DON_VI,
        },
      }),
    ).toBe(1);
    expect(
      await db.auditLog.count({
        where: { subjectId: source.id, action: 'INCIDENT_TRANSFERRED' },
      }),
    ).toBe(1);
  });
  it.each(['assign', 'delete'] as const)(
    'PR01: real completed handoff after %s preflight rejects stale bulk write',
    async (operation) => {
      const source = await createSource();
      const ready = await db.incident.update({
        where: { id: source.id },
        data: {
          intakeStage: 'DA_NHAN',
          status:
            operation === 'delete'
              ? IncidentStatus.TIEP_NHAN
              : IncidentStatus.DANG_XAC_MINH,
        },
      });
      const original = db.incident.findMany.bind(db.incident) as (
        args?: Prisma.IncidentFindManyArgs,
      ) => Promise<Incident[]>;
      let moved = false;
      const spy = jest
        .spyOn(db.incident, 'findMany')
        .mockImplementation((async (args?: Prisma.IncidentFindManyArgs) => {
          const checked = await original(args);
          if (!moved) {
            moved = true;
            const sent = await service.send(
              ready.id,
              {
                toTeamId: targetTeam,
                requestKey: randomUUID(),
                expectedUpdatedAt: ready.updatedAt.toISOString(),
              },
              sender,
              sendScope,
            );
            const pending = await db.incident.findUniqueOrThrow({
              where: { id: ready.id },
            });
            await service.accept(
              ready.id,
              sent.data.id,
              {
                expectedUpdatedAt: pending.updatedAt.toISOString(),
                expectedHandoffUpdatedAt: sent.data.updatedAt.toISOString(),
              },
              receiver,
              receiveScope,
            );
          }
          return checked;
        }) as never);
      try {
        const bulk = new IncidentsBulkService(db, audit, ordinaryChildFixture(db) as never);
        const input = {
          ids: [ready.id],
          actorId: sender,
          dataScope: sendScope,
          reason: 'Synthetic controlled handoff race',
        };
        const result =
          operation === 'assign'
            ? await bulk.bulkAssign({ ...input, assignedTeamId: sourceTeam })
            : await bulk.bulkDelete(input);
        expect(result.succeeded).toHaveLength(0);
        expect(result.skipped).toEqual([
          expect.objectContaining({
            id: ready.id,
            reason: 'CONCURRENT_MODIFICATION',
          }),
        ]);
        const current = await db.incident.findUniqueOrThrow({
          where: { id: ready.id },
        });
        expect(current.assignedTeamId).toBe(targetTeam);
        expect(current.intakeStage).toBe('DA_NHAN');
        expect(current.deletedAt).toBeNull();
        expect(
          await db.auditLog.count({
            where: {
              subjectId: ready.id,
              action:
                operation === 'assign'
                  ? 'INCIDENT_ASSIGNED'
                  : 'INCIDENT_DELETED',
            },
          }),
        ).toBe(0);
      } finally {
        spy.mockRestore();
      }
    },
  );
  it('PR01: document added after delete preflight protects parent without changing its version', async () => {
    const source = await createSource();
    const ready = await db.incident.update({
      where: { id: source.id },
      data: { intakeStage: 'DA_NHAN', status: IncidentStatus.TIEP_NHAN },
    });
    const original = db.incident.findMany.bind(db.incident) as (
      args?: Prisma.IncidentFindManyArgs,
    ) => Promise<Incident[]>;
    let added = false;
    const spy = jest.spyOn(db.incident, 'findMany').mockImplementation((async (
      args?: Prisma.IncidentFindManyArgs,
    ) => {
      const checked = await original(args);
      if (!added) {
        added = true;
        await db.document.create({
          data: {
            title: 'Synthetic race document',
            fileName: 'synthetic-race.txt',
            originalName: 'synthetic-race.txt',
            mimeType: 'text/plain',
            size: 0,
            filePath: '/synthetic-no-file',
            incidentId: ready.id,
            uploadedById: sender,
          },
        });
      }
      return checked;
    }) as never);
    try {
      const result = await new IncidentsBulkService(db, audit, ordinaryChildFixture(db) as never).bulkDelete({
        ids: [ready.id],
        actorId: sender,
        dataScope: sendScope,
        reason: 'Synthetic relation race',
      });
      expect(result.succeeded).toHaveLength(0);
      const current = await db.incident.findUniqueOrThrow({
        where: { id: ready.id },
      });
      expect(current.updatedAt).toEqual(ready.updatedAt);
      expect(current.deletedAt).toBeNull();
      expect(
        await db.document.count({
          where: { incidentId: ready.id, deletedAt: null },
        }),
      ).toBe(1);
      expect(
        await db.auditLog.count({
          where: { subjectId: ready.id, action: 'INCIDENT_DELETED' },
        }),
      ).toBe(0);
    } finally {
      spy.mockRestore();
    }
  });
  it('lọc lịch sử tìm nguồn đã phục hồi, không suy từ status thiếu event; list/stats cùng predicate', async () => {
    const source = await createSource();
    await db.incident.update({
      where: { id: source.id },
      data: { intakeStage: 'DA_NHAN' },
    });
    const incidents = new IncidentsService(
      db,
      audit,
      {
        getKyThongKe: () =>
          Promise.resolve({
            ky: 'TAT_CA',
            truong: 'NGAY_TIEP_NHAN',
            tuNgay: null,
            denNgay: null,
          }),
      } as never,
      {} as never,
      {} as never,
      new EventEmitter2(), ordinarySourceFixture(db), ordinaryChildFixture(db) as never
    );
    await incidents.updateStatus(
      source.id,
      {
        status: IncidentStatus.TAM_DINH_CHI,
        decisionNumber: 'QD-TDC',
        decisionDate: '2026-10-06',
        lyDoTamDinhChiVuViec: [LyDoTamDinhChiVuViec.CHUA_CO_KET_QUA_GIAM_DINH],
      },
      sender,
      undefined,
      sendScope,
    );
    await incidents.updateStatus(
      source.id,
      {
        status: IncidentStatus.PHUC_HOI_NGUON_TIN,
        decisionNumber: 'QD-PH',
        decisionDate: '2026-10-06',
      },
      sender,
      undefined,
      sendScope,
    );
    const unknown = await db.incident.create({
      data: {
        code: 'UAT-UNKNOWN-' + randomUUID(),
        name: 'Không có sự kiện xác minh',
        assignedTeamId: sourceTeam,
        status: IncidentStatus.TAM_DINH_CHI,
        legacyCollection: 'ho_so',
      },
    });
    const query = {
      view: 'management' as const,
      historyStatus: IncidentStatus.TAM_DINH_CHI,
      limit: 100,
    };
    const result = await incidents.getList(query, sendScope);
    expect(result.data.map((x) => x.id)).toContain(source.id);
    expect(result.data.map((x) => x.id)).not.toContain(unknown.id);
    expect(result.historyNotice).toContain('chưa xác minh');
    const stats = await incidents.getStats(query, sendScope);
    expect(stats.total).toBe(result.total);
    expect(
      (await db.incident.findUniqueOrThrow({ where: { id: source.id } }))
        .status,
    ).toBe(IncidentStatus.PHUC_HOI_NGUON_TIN);
  });
});
