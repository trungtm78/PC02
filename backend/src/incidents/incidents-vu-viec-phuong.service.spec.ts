/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import * as ExcelJSDoc from 'exceljs';
import { PassThrough } from 'stream';
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
import { INCIDENT_STATUS_LABEL } from '../common/constants/status-labels.constants';

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

/** The response is a write-once stream (the shared exporter streams the xlsx into it). */
const res = () => {
  const r = Object.assign(new PassThrough(), { setHeader: jest.fn() });
  r.on('data', () => {});
  return r;
};

/** Response that collects the bytes, to read back the produced xlsx. */
const resThu = () => {
  const phan: Buffer[] = [];
  const r = Object.assign(new PassThrough(), { setHeader: jest.fn() });
  r.on('data', (c: Buffer) => phan.push(c));
  const docTep = async () => {
    await new Promise((xong) => setImmediate(xong));
    const wb = new ExcelJSDoc.Workbook();
    await wb.xlsx.load(Buffer.concat(phan) as never);
    return wb.worksheets[0];
  };
  return { r, docTep };
};

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

    it('tải HẾT mọi dòng, không cắt ở 500 dòng', async () => {
      const TONG = 650;
      mockPrisma.incident.count.mockResolvedValue(TONG);
      mockPrisma.incident.findMany.mockImplementation(
        (a: { where: { id?: { in: string[] } }; take?: number }) =>
          Promise.resolve(
            a.where.id
              ? a.where.id.in.map((id) => ({
                  id,
                  code: `2026-${id.slice(1)}`,
                  name: 'Vụ',
                  status: IncidentStatus.TIEP_NHAN,
                  ngayDeXuat: new Date('2026-09-01T00:00:00Z'),
                }))
              : Array.from(
                  { length: Math.min(a.take ?? TONG, TONG) },
                  (_, k) => ({
                    id: `i${k}`,
                  }),
                ),
          ),
      );
      try {
        const { r, docTep } = resThu();
        await service.exportWardIncidents({} as never, null, r as never);
        const sheet = await docTep();
        // Row 7 = column headers; data rows 8..(7 + TONG).
        expect(sheet.getRow(7 + TONG).getCell(1).value).toBe(TONG);
        expect(sheet.getRow(7 + TONG).getCell(2).value).toBe(`26-${TONG - 1}`);
      } finally {
        mockPrisma.incident.findMany.mockReset().mockResolvedValue([]);
        mockPrisma.incident.count.mockReset().mockResolvedValue(0);
      }
    });

    it('giữ NGUYÊN cột, tiêu đề, tên tệp và tên sheet của tệp phường cũ', async () => {
      mockPrisma.incident.count.mockResolvedValue(1);
      mockPrisma.incident.findMany
        .mockResolvedValueOnce([{ id: 'v1' }])
        .mockResolvedValueOnce([
          {
            id: 'v1',
            code: '2026-42',
            name: 'Trộm xe máy',
            crimeChinh: { name: 'Trộm cắp tài sản' },
            benVu: 'Nguyễn Văn A',
            assignedTeam: {
              id: 't1',
              name: 'Tổ 1',
              ward: { name: 'Phường 1' },
            },
            investigator: {
              id: 'u1',
              firstName: 'Bình',
              lastName: 'Trần',
              username: 'binh',
            },
            ngayDeXuat: new Date('2026-09-01T00:00:00Z'),
            status: IncidentStatus.TIEP_NHAN,
          },
        ]);
      try {
        const { r, docTep } = resThu();
        await service.exportWardIncidents({} as never, null, r as never);
        expect(r.setHeader).toHaveBeenCalledWith(
          'Content-Disposition',
          expect.stringMatching(/VuViecPhuongXa_\d{4}-\d{2}-\d{2}\.xlsx/),
        );
        const sheet = await docTep();
        expect(sheet.name).toBe('Vụ việc theo phường xã');
        expect(sheet.getCell('A4').value).toBe(
          'DANH SÁCH VỤ VIỆC THEO PHƯỜNG/XÃ',
        );
        expect((sheet.getRow(7).values as unknown[]).slice(1)).toEqual([
          'STT',
          'Mã hồ sơ',
          'Tên vụ việc',
          'Tội danh',
          'Người cung cấp, bị hại',
          'Phường/Xã',
          'ĐTV phụ trách',
          'Ngày đề xuất',
          'Trạng thái',
        ]);
        expect((sheet.getRow(8).values as unknown[]).slice(1)).toEqual([
          1,
          '26-42',
          'Trộm xe máy',
          'Trộm cắp tài sản',
          'Nguyễn Văn A',
          'Phường 1',
          'Trần Bình',
          // Same formatting call as the old ward file (output depends on the runtime ICU data).
          new Date('2026-09-01T00:00:00Z').toLocaleDateString('vi-VN', {
            timeZone: 'Asia/Ho_Chi_Minh',
          }),
          INCIDENT_STATUS_LABEL[IncidentStatus.TIEP_NHAN],
        ]);
      } finally {
        mockPrisma.incident.findMany.mockReset().mockResolvedValue([]);
        mockPrisma.incident.count.mockReset().mockResolvedValue(0);
      }
    });

    it('không có vụ việc nào vẫn trả tệp (chỉ tiêu đề) như trước', async () => {
      const { r, docTep } = resThu();
      await service.exportWardIncidents({} as never, null, r as never);
      const sheet = await docTep();
      expect(sheet.getRow(7).getCell(2).value).toBe('Mã hồ sơ');
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
