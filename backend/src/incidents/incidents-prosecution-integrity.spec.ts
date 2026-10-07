import { CaseChildAccessService } from '../case-child-access/case-child-access.service';
import { ordinaryChildFixture } from '../case-child-access/test-child-access-fixture';
import { CaseSourceCreationService } from '../case-child-access/case-source-creation.service';
import { ordinarySourceFixture, setSourceFixtureScope } from '../case-child-access/test-source-creation-fixture';
/* eslint-disable @typescript-eslint/no-unsafe-assignment -- Jest asymmetric matchers have an any return type. */
import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IncidentStatus } from '@prisma/client';
import { IncidentsService } from './incidents.service';
import { ProsecuteIncidentDto } from './dto/prosecute-incident.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { LyDoTamDinhChiVuViec, LyDoKhongKhoiTo } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DocumentNumbersService } from '../document-numbers/document-numbers.service';
import { SettingsService } from '../settings/settings.service';
import { DeadlineRulesService } from '../deadline-rules/deadline-rules.service';

describe('AC-04/05: khởi tố và liên kết hồ sơ', () => {
  const source = {
    id: 'incident-1',
    code: 'VV-1',
    status: IncidentStatus.DANG_XAC_MINH,
    updatedAt: new Date('2026-10-01T00:00:00Z'),
    deletedAt: null,
    linkedCaseId: null,
    assignedTeamId: 'team-1',
    investigatorId: 'officer-1',
    description: 'Toàn bộ nội dung nguồn tin',
    benVu: 'Người báo tin kiểm thử',
    chuyenTuDonVi: 'Đơn vị nguồn',
    donViGiaiQuyet: 'Đơn vị thụ lý',
    cmndNguoiToGiac: 'TEST-ID',
    sdtNguoiToGiac: '0900000000',
    diaChiNguoiToGiac: 'Địa chỉ kiểm thử',
    sinhNamNguoiToGiac: '1980',
    diaChiXayRa: 'Địa điểm kiểm thử',
    crimeChinhId: 'crime-1',
    lanhDaoToTung: 'Lãnh đạo kiểm thử',
    dieuTraVien: 'ĐTV kiểm thử',
    ngayDeXuat: new Date('2026-09-01T00:00:00Z'),
    ngayTiepNhanNguonTin: new Date('2026-08-31T00:00:00Z'),
    deadline: new Date('2026-10-15T00:00:00Z'),
    fromDate: new Date('2026-08-20T00:00:00Z'),
    metadata: { legacyExtra: { detail: 'Giữ dữ liệu phụ' } },
  };
  const input = {
    caseName: 'Vụ án kiểm thử',
    prosecutionDecision: 'QD-001',
    prosecutionDate: '2026-10-05',
    expectedUpdatedAt: source.updatedAt.toISOString(),
  };
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    case: {
      create: jest.fn().mockResolvedValue({ id: 'case-1', caseCode: 'CASE-1' }),
    },
    incident: {
      findFirst: jest.fn().mockResolvedValue(source),
      update: jest.fn().mockResolvedValue({}),
    },
    incidentStatusHistory: { create: jest.fn().mockResolvedValue({}) },
    documentNumberLog: { update: jest.fn().mockResolvedValue({}) },
  };
  const db = {
    incident: {
      findFirst: jest.fn().mockResolvedValue(source),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn(),
    },
    incidentStatusHistory: tx.incidentStatusHistory,
    $transaction: jest.fn(
      (fn: ((t: typeof tx) => Promise<unknown>) | Promise<unknown>[]) =>
        typeof fn === 'function' ? fn(tx) : Promise.all(fn),
    ),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  let service: IncidentsService;
  it.each(['extend', 'transfer', 'merge'] as const)(
    'không cho %s nguồn mới trước khi xác nhận nhận',
    async (operation) => {
      db.incident.findFirst.mockResolvedValue({
        ...source,
        intakeStage: 'PHAN_LOAI',
      });
      tx.incident.findFirst.mockResolvedValue({
        ...source,
        intakeStage: 'PHAN_LOAI',
      });
      const action =
        operation === 'extend'
          ? () => service.extendDeadline(source.id, 'actor-1')
          : operation === 'transfer'
            ? () =>
                service.transferUnit(
                  source.id,
                  { donViMoi: 'Đơn vị khác' },
                  'actor-1',
                )
            : () =>
                service.mergeInto(
                  source.id,
                  { targetId: 'target-1' },
                  'actor-1',
                );
      await expect(action()).rejects.toThrow('xác nhận nhận');
      if (operation === 'merge') {
        // Current production merge locks/re-reads inside the transaction before validation.
        expect(db.$transaction).toHaveBeenCalledTimes(1);
        expect(tx.incident.update).not.toHaveBeenCalled();
      } else expect(db.$transaction).not.toHaveBeenCalled();
    },
  );
  beforeEach(async () => {
    jest.clearAllMocks();
    db.incident.findFirst.mockResolvedValue(source);
    tx.incident.findFirst.mockResolvedValue(source);
    audit.log.mockResolvedValue(undefined);
    const module = await Test.createTestingModule({
      providers: [{ provide: CaseChildAccessService, useValue: ordinaryChildFixture(db) },{ provide: CaseSourceCreationService, useValue: ordinarySourceFixture(db) },
        IncidentsService,
        { provide: PrismaService, useValue: db },
        { provide: AuditService, useValue: audit },
        {
          provide: DocumentNumbersService,
          useValue: {
            commitWithTx: jest
              .fn()
              .mockResolvedValue({ number: 'CASE-1', logId: 'log-1' }),
          },
        },
        {
          provide: SettingsService,
          useValue: {
            getKyThongKe: jest.fn().mockResolvedValue({
              ky: 'TAT_CA',
              truong: 'NGAY_TIEP_NHAN',
              tuNgay: null,
              denNgay: null,
            }),
          },
        },
        { provide: DeadlineRulesService, useValue: {} },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();
    service = module.get(IncidentsService);
  });

  it('lọc lịch sử phân biệt không có kết quả với lịch sử cũ chưa xác minh', async () => {
    const result = await service.getList({
      historyStatus: IncidentStatus.TAM_DINH_CHI,
    });
    expect(result).toEqual(
      expect.objectContaining({
        historyNotice: expect.stringContaining('chưa xác minh'),
      }),
    );
    expect(db.incident.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          statusHistory: { some: { toStatus: IncidentStatus.TAM_DINH_CHI } },
        }),
      }),
    );
  });

  it('lưu số/ngày quyết định, tổ và các thông tin nguồn trong Case', async () => {
    setSourceFixtureScope(db, null);
await service.prosecute(source.id, input, 'actor-1');
    expect(tx.case.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          soQuyetDinhKhoiTo: 'QD-001',
          ngayKhoiTo: new Date('2026-10-05'),
          moTaChiTiet: source.description,
          tenCungCap: source.benVu,
          nguonDon: source.chuyenTuDonVi,
          donViGiaiQuyet: source.donViGiaiQuyet,
          cccdCungCap: source.cmndNguoiToGiac,
          sdtCungCap: source.sdtNguoiToGiac,
          diaChiCungCap: source.diaChiNguoiToGiac,
          sinhNamCungCap: '1980',
          noiXayRa: source.diaChiXayRa,
          crimeChinhId: source.crimeChinhId,
          assignedTeamId: 'team-1',
          createdById: 'actor-1',
          lanhDaoToTung: source.lanhDaoToTung,
          dieuTraVien: source.dieuTraVien,
          caseProvenance: 'FROM_INCIDENT',
          linkedIncidentId: source.id,
          ngayXayRa: source.fromDate,
          ngayDeXuat: source.ngayDeXuat,
        }),
      }),
    );
  });
  it('A03: restored source prosecutes directly with history and audit in transaction', async () => {
    db.incident.findFirst.mockResolvedValue({
      ...source,
      intakeStage: 'DA_NHAN',
      status: IncidentStatus.PHUC_HOI_NGUON_TIN,
    });
    setSourceFixtureScope(db, null);
await service.prosecute(source.id, input, 'actor-1');
    expect(tx.incidentStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fromStatus: IncidentStatus.PHUC_HOI_NGUON_TIN,
          toStatus: IncidentStatus.DA_CHUYEN_VU_AN,
        }),
      }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'INCIDENT_PROSECUTED' }),
      tx,
    );
  });
  it('A03: restored transfer records source, history and audit within transaction', async () => {
    db.incident.findFirst.mockResolvedValue({
      ...source,
      intakeStage: 'DA_NHAN',
      status: IncidentStatus.PHUC_HOI_NGUON_TIN,
    });
    await service.transferUnit(
      source.id,
      {
        donViMoi: 'Đơn vị nhận',
        expectedUpdatedAt: source.updatedAt.toISOString(),
      },
      'actor-1',
    );
    expect(tx.incident.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: IncidentStatus.DA_CHUYEN_DON_VI,
          chuyenDenDonVi: 'Đơn vị nhận',
        }),
      }),
    );
    expect(tx.incidentStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fromStatus: IncidentStatus.PHUC_HOI_NGUON_TIN,
          toStatus: IncidentStatus.DA_CHUYEN_DON_VI,
        }),
      }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'INCIDENT_TRANSFERRED' }),
      tx,
    );
  });
  it('A03: blank transfer destination fails before writing', async () => {
    await expect(
      service.transferUnit(source.id, { donViMoi: '   ' }, 'actor-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it.each([IncidentStatus.KHONG_KHOI_TO, IncidentStatus.TAM_DINH_CHI])(
    'A03: restored source directly records %s decision with audit',
    async (status) => {
      db.incident.findFirst.mockResolvedValue({
        ...source,
        intakeStage: 'DA_NHAN',
        status: IncidentStatus.PHUC_HOI_NGUON_TIN,
      });
      await service.updateStatus(
        source.id,
        {
          status,
          decisionNumber: 'QD-RESTORED',
          decisionDate: '2026-10-06',
          ...(status === IncidentStatus.KHONG_KHOI_TO
            ? { lyDoKhongKhoiTo: Object.values(LyDoKhongKhoiTo)[0] }
            : {
                lyDoTamDinhChiVuViec: [Object.values(LyDoTamDinhChiVuViec)[0]],
              }),
        },
        'actor-1',
      );
      expect(tx.incidentStatusHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            fromStatus: IncidentStatus.PHUC_HOI_NGUON_TIN,
            toStatus: status,
          }),
        }),
      );
      expect(tx.incident.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining(
            status === IncidentStatus.KHONG_KHOI_TO
              ? {
                  soQDKhongKhoiTo: 'QD-RESTORED',
                  ngayQDKhongKhoiTo: new Date('2026-10-06'),
                }
              : {
                  soQuyetDinhTamDinhChiVV: 'QD-RESTORED',
                  ngayTamDinhChiVV: new Date('2026-10-06'),
                },
          ),
        }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'INCIDENT_STATUS_CHANGED' }),
        tx,
      );
    },
  );
  it.each([IncidentStatus.KHONG_KHOI_TO, IncidentStatus.TAM_DINH_CHI])(
    'A03: restored %s without decision is rejected',
    async (status) => {
      db.incident.findFirst.mockResolvedValue({
        ...source,
        intakeStage: 'DA_NHAN',
        status: IncidentStatus.PHUC_HOI_NGUON_TIN,
      });
      await expect(
        service.updateStatus(source.id, { status }, 'actor-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(db.$transaction).not.toHaveBeenCalled();
    },
  );
  it('A03: transfer audit failure rejects the business operation', async () => {
    audit.log.mockRejectedValueOnce(new Error('audit unavailable'));
    await expect(
      service.transferUnit(source.id, { donViMoi: 'Unit' }, 'actor-1'),
    ).rejects.toThrow('audit unavailable');
  });
  it.each([
    IncidentStatus.TAM_DINH_CHI,
    IncidentStatus.KHONG_KHOI_TO,
    IncidentStatus.DA_CHUYEN_VU_AN,
    IncidentStatus.DA_CHUYEN_DON_VI,
  ])(
    'AR-A03: direct transfer rejects source %s outside graph',
    async (status) => {
      db.incident.findFirst.mockResolvedValue({
        ...source,
        status,
        linkedCaseId:
          status === IncidentStatus.DA_CHUYEN_VU_AN ? 'case-1' : null,
      });
      await expect(
        service.transferUnit(source.id, { donViMoi: 'Unit' }, 'actor-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(db.$transaction).not.toHaveBeenCalled();
    },
  );

  it('giữ snapshot nguồn, không lấy hạn nguồn tin làm hạn vụ án', async () => {
    setSourceFixtureScope(db, null);
await service.prosecute(source.id, input, 'actor-1');
    const call = tx.case.create.mock.calls[0] as unknown as [
      { data: Record<string, unknown> },
    ];
    expect(call[0].data.deadline).toBeUndefined();
    expect(call[0].data.metadata).toEqual(
      expect.objectContaining({
        incidentSourceSnapshot: expect.objectContaining({
          id: source.id,
          code: source.code,
          metadata: source.metadata,
          ngayTiepNhanNguonTin: source.ngayTiepNhanNguonTin.toISOString(),
        }),
      }),
    );
  });

  it.each(['', '   ', undefined])(
    'từ chối ngày quyết định thiếu (%s) trước transaction',
    async (date) => {
      setSourceFixtureScope(db, null);
await expect(
        service.prosecute(
          source.id,
          { ...input, prosecutionDate: date } as ProsecuteIncidentDto,
          'actor-1',
        ),
      ).rejects.toThrow();
      expect(db.$transaction).not.toHaveBeenCalled();
    },
  );

  it.each(['2026-02-30', 'not-a-date'])(
    'từ chối ngày quyết định không thật (%s)',
    async (date) => {
      setSourceFixtureScope(db, null);
await expect(
        service.prosecute(
          source.id,
          { ...input, prosecutionDate: date } as ProsecuteIncidentDto,
          'actor-1',
        ),
      ).rejects.toThrow();
      expect(db.$transaction).not.toHaveBeenCalled();
    },
  );

  it.each(['', '   '])('từ chối số quyết định rỗng (%s)', async (decision) => {
    setSourceFixtureScope(db, null);
await expect(
      service.prosecute(
        source.id,
        { ...input, prosecutionDecision: decision },
        'actor-1',
      ),
    ).rejects.toThrow();
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('audit khởi tố dùng cùng transaction client', async () => {
    setSourceFixtureScope(db, null);
await service.prosecute(source.id, input, 'actor-1');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'INCIDENT_PROSECUTED' }),
      tx,
    );
  });

  it.each([source.updatedAt.toISOString(), undefined])(
    'xung đột có/không timestamp client (%s) trả 409',
    async (timestamp) => {
      tx.incident.update.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('Concurrent modification', {
          code: 'P2025',
          clientVersion: 'test',
        }),
      );
      setSourceFixtureScope(db, null);
await expect(
        service.prosecute(
          source.id,
          { ...input, expectedUpdatedAt: timestamp },
          'actor-1',
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(tx.incident.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: source.id,
            status: source.status,
            linkedCaseId: null,
            updatedAt: source.updatedAt,
          }),
        }),
      );
      expect(audit.log).not.toHaveBeenCalled();
    },
  );

  it('audit thất bại không trả khởi tố thành công', async () => {
    const error = new Error('Audit unavailable');
    audit.log.mockRejectedValueOnce(error);
    setSourceFixtureScope(db, null);
await expect(service.prosecute(source.id, input, 'actor-1')).rejects.toBe(
      error,
    );
  });

  it.each([
    IncidentStatus.DA_CHUYEN_VU_AN,
    IncidentStatus.DA_NHAP_VU_KHAC,
    IncidentStatus.DA_CHUYEN_DON_VI,
  ])(
    'status chung không tạo kết quả %s thiếu nghiệp vụ đích',
    async (status) => {
      await expect(
        service.updateStatus(source.id, { status }, 'actor-1'),
      ).rejects.toThrow();
      expect(db.$transaction).not.toHaveBeenCalled();
      expect(tx.case.create).not.toHaveBeenCalled();
    },
  );

  it('tạm đình chỉ thiếu số/ngày quyết định phải bị chặn trước ghi', async () => {
    await expect(
      service.updateStatus(
        source.id,
        { status: IncidentStatus.TAM_DINH_CHI },
        'actor-1',
      ),
    ).rejects.toThrow(/quyết định/i);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('tạm đình chỉ lưu số/ngày và các lý do vào cột nghiệp vụ, audit cùng tx', async () => {
    await service.updateStatus(
      source.id,
      {
        status: IncidentStatus.TAM_DINH_CHI,
        decisionNumber: 'TDC-001',
        decisionDate: '2026-10-05',
        lyDoTamDinhChiVuViec: [Object.values(LyDoTamDinhChiVuViec)[0]],
      } as UpdateStatusDto,
      'actor-1',
    );
    expect(tx.incident.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          soQuyetDinhTamDinhChiVV: 'TDC-001',
          ngayTamDinhChiVV: new Date('2026-10-05'),
          lyDoTamDinhChiVuViec: [Object.values(LyDoTamDinhChiVuViec)[0]],
        }),
      }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'INCIDENT_STATUS_CHANGED' }),
      tx,
    );
  });

  it('dùng quyết định đã lưu không cắt ngày UTC hoặc đổi mốc cũ', async () => {
    const stored = new Date('2026-10-04T17:00:00Z');
    db.incident.findFirst.mockResolvedValue({
      ...source,
      soQuyetDinhTamDinhChiVV: 'TDC-OLD',
      ngayTamDinhChiVV: stored,
      lyDoTamDinhChiVuViec: [Object.values(LyDoTamDinhChiVuViec)[0]],
    });
    await service.updateStatus(
      source.id,
      { status: IncidentStatus.TAM_DINH_CHI },
      'actor-1',
    );
    expect(tx.incident.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ngayTamDinhChiVV: stored }),
      }),
    );
  });
});
