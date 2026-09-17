/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IncidentStatus } from '@prisma/client';
import { IncidentsService } from './incidents.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SettingsService } from '../settings/settings.service';
import { DeadlineRulesService } from '../deadline-rules/deadline-rules.service';
import { DocumentNumbersService } from '../document-numbers/document-numbers.service';
import { BcaExcelHelper } from '../common/bca-excel.helper';

const mockPrisma = {
  incident: {
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    groupBy: jest.fn().mockResolvedValue([]),
  },
};

const PHAM_VI = { userIds: ['u1'], teamIds: ['t1'], writableTeamIds: [] };

const kyMacDinh = {
  ky: 'TAT_CA',
  truong: 'NGAY_TIEP_NHAN',
  tuNgay: null as string | null,
  denNgay: null as string | null,
};

const res = () => ({
  setHeader: jest.fn(),
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
  destroy: jest.fn(),
  headersSent: false,
  write: jest.fn(),
  end: jest.fn(),
  on: jest.fn(),
  once: jest.fn(),
  emit: jest.fn(),
});

/**
 * Màn Vụ việc phường/xã (17/09/2026) chuyển tìm, lọc, phân trang xuống máy chủ. Trước đó màn tải 100/4.725
 * vụ việc rồi lọc tại chỗ; cột Phường đọc `unitId` (prod 0%), Loại đọc `incidentType` (0%), Địa điểm hiện
 * mô tả, Mức độ gán cứng. Đo prod: 1.165 vụ việc tổ phường, tội danh chính 1.009, `benVu` 1.112.
 */
describe('IncidentsService — màn Vụ việc phường/xã', () => {
  let service: IncidentsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IncidentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: { log: jest.fn() } },
        {
          provide: SettingsService,
          useValue: {
            getValue: jest.fn().mockResolvedValue(null),
            getKyThongKe: jest.fn(() => Promise.resolve({ ...kyMacDinh })),
          },
        },
        {
          provide: DeadlineRulesService,
          useValue: { getActiveByKey: jest.fn().mockResolvedValue(null) },
        },
        {
          provide: DocumentNumbersService,
          useValue: { commitWithTx: jest.fn(), draft: jest.fn() },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();
    service = module.get(IncidentsService);
  });

  const whereAnd = () =>
    JSON.stringify(mockPrisma.incident.findMany.mock.calls[0][0].where.AND);

  it('danh sách trả TÊN phường của tổ thụ lý và tên tội danh chính', async () => {
    await service.getList({} as never, null);
    const select = mockPrisma.incident.findMany.mock.calls[0][0].select;
    expect(select.assignedTeam).toEqual({
      select: { id: true, name: true, ward: { select: { name: true } } },
    });
    expect(select.crimeChinh).toEqual({ select: { name: true } });
  });

  it('[rà mã P3] chiToPhuong: danh sách lẫn thống kê chỉ lấy tổ CÓ phường', async () => {
    await service.getList({ chiToPhuong: true } as never, null);
    expect(
      mockPrisma.incident.findMany.mock.calls[0][0].where.assignedTeam,
    ).toEqual({
      is: { wardId: { not: null } },
    });
    await service.getStats({ chiToPhuong: true } as never, null);
    expect(
      mockPrisma.incident.groupBy.mock.calls[0][0].where.assignedTeam,
    ).toEqual({
      is: { wardId: { not: null } },
    });
  });

  it('thẻ Tội danh chính lọc qua quan hệ, bỏ dấu, lùi cột gốc', async () => {
    await service.getList({ tk: ['toiDanhChinh~Trộm cắp'] } as never, null);
    expect(whereAnd()).toContain('"crimeChinh":{"is"');
    expect(whereAnd()).toContain('"nameBd":{"contains":"trom cap"}');
  });

  it('thẻ Tên vụ việc lọc cột bóng tên', async () => {
    await service.getList({ tk: ['tenVuViec~trom'] } as never, null);
    expect(whereAnd()).toContain('"nameBd":{"contains":"trom"}');
    expect(whereAnd()).not.toContain('timKiemBd');
    // cột `nameBd` cũng có ở `crimes`: thẻ Tên vụ việc KHÔNG được đi qua quan hệ tội danh.
    expect(whereAnd()).not.toContain('crimeChinh');
  });

  it('thẻ `*` tìm cả cột ghép lẫn tên tội danh chính', async () => {
    await service.getList({ tk: ['*~trom cap'] } as never, null);
    expect(whereAnd()).toContain('"timKiemBd":{"contains":"trom cap"}');
    expect(whereAnd()).toContain('"crimeChinh":{"is"');
  });

  describe('xuất Excel theo phường — CÙNG bộ lọc với danh sách', () => {
    it('áp thẻ, phường, trạng thái và phạm vi như danh sách', async () => {
      await service.exportWardIncidents(
        {
          tk: ['tenVuViec~trom'],
          wardTeamId: 'w1',
          status: IncidentStatus.TIEP_NHAN,
        } as never,
        PHAM_VI as never,
        res() as never,
      );
      const where = mockPrisma.incident.findMany.mock.calls[0][0].where;
      expect(where.status).toBe(IncidentStatus.TIEP_NHAN);
      expect(where.assignedTeam).toEqual({ is: { wardId: 'w1' } });
      expect(JSON.stringify(where.AND)).toContain(
        '"nameBd":{"contains":"trom"}',
      );
      expect(JSON.stringify(where.AND)).toContain(
        '"assignedTeamId":{"in":["t1"]}',
      );
    });

    it('tải HẾT mọi trang, không cắt ở 500 dòng', async () => {
      mockPrisma.incident.count.mockResolvedValue(650);
      mockPrisma.incident.findMany.mockImplementation(
        ({ skip, take }: { skip: number; take: number }) =>
          Promise.resolve(
            Array.from(
              { length: Math.max(0, Math.min(take, 650 - skip)) },
              (_, k) => ({
                id: `i${skip + k}`,
                code: `2026-${skip + k}`,
                name: 'Vụ',
                status: IncidentStatus.TIEP_NHAN,
                ngayDeXuat: new Date('2026-09-01T00:00:00Z'),
              }),
            ),
          ),
      );
      try {
        await service.exportWardIncidents({} as never, null, res() as never);
        const tong = mockPrisma.incident.findMany.mock.calls.reduce(
          (n: number, [a]: [{ skip: number; take: number }]) =>
            n + Math.max(0, Math.min(a.take, 650 - a.skip)),
          0,
        );
        expect(tong).toBe(650);
      } finally {
        mockPrisma.incident.findMany.mockReset().mockResolvedValue([]);
        mockPrisma.incident.count.mockReset().mockResolvedValue(0);
      }
    });

    it('phụ đề ghi ĐÚNG kỳ đang áp, không ghi Tất cả thời gian khi có kỳ mặc định', async () => {
      const dauDe = jest.spyOn(BcaExcelHelper, 'addHeader');
      Object.assign(kyMacDinh, {
        ky: 'THANG_HIEN_TAI',
        tuNgay: '2026-09-01',
        denNgay: '2026-09-30',
      });
      try {
        await service.exportWardIncidents({} as never, null, res() as never);
        expect(dauDe.mock.calls[0][3]).toBe(
          'Ngày đề xuất từ 01/09/2026 đến 30/09/2026',
        );
      } finally {
        Object.assign(kyMacDinh, { ky: 'TAT_CA', tuNgay: null, denNgay: null });
        dauDe.mockRestore();
      }
    });
  });
});
