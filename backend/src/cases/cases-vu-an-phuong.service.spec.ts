/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CaseStatus, CaseType } from '@prisma/client';
import { CasesService } from './cases.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SettingsService } from '../settings/settings.service';
import { DocumentNumbersService } from '../document-numbers/document-numbers.service';
import { maHoSoNgan } from '../common/utils/ho-so-code.util';
import { BcaExcelHelper } from '../common/bca-excel.helper';

const mockPrisma = {
  case: {
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    groupBy: jest.fn().mockResolvedValue([]),
  },
};

const PHAM_VI = { userIds: ['u1'], teamIds: ['t1'], writableTeamIds: [] };

/**
 * Màn Vụ án phường/xã (17/09/2026) chuyển tìm, lọc, phân trang xuống máy chủ. Trước đó màn tải 100 vụ
 * án rồi lọc theo danh sách phường GÁN CỨNG ("Phường 2/4/6") trên cột `unit` rỗng 100% → cán bộ không
 * phải quản trị thấy 0 dòng. Đo prod: 368 vụ án REGULAR gắn tổ phường; tội danh chính có ở 344, ô chữ
 * `crime` chỉ 36.
 */
const kyMacDinh = {
  ky: 'TAT_CA',
  truong: 'NGAY_TIEP_NHAN',
  tuNgay: null as string | null,
  denNgay: null as string | null,
};

describe('CasesService — màn Vụ án phường/xã', () => {
  let service: CasesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CasesService,
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
          provide: DocumentNumbersService,
          useValue: { generate: jest.fn(), commitWithTx: jest.fn() },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();
    service = module.get(CasesService);
  });

  it('danh sách trả TÊN phường của tổ thụ lý (cột Phường/Xã đọc đúng trường thật)', async () => {
    await service.getList({} as never, null);
    const select = mockPrisma.case.findMany.mock.calls[0][0].select;
    expect(select.assignedTeam).toEqual({
      select: { id: true, name: true, ward: { select: { name: true } } },
    });
  });

  it('[rà mã P3] chiToPhuong: danh sách lẫn thống kê chỉ lấy tổ CÓ phường', async () => {
    await service.getList({ chiToPhuong: true } as never, null);
    expect(
      mockPrisma.case.findMany.mock.calls[0][0].where.assignedTeam,
    ).toEqual({
      is: { wardId: { not: null } },
    });
    await service.getStats({ chiToPhuong: true } as never, null);
    expect(mockPrisma.case.groupBy.mock.calls[0][0].where.assignedTeam).toEqual(
      {
        is: { wardId: { not: null } },
      },
    );
  });

  it('thẻ Tội danh chính lọc qua quan hệ danh mục, bỏ dấu, lùi cột gốc khi chưa nạp cột bóng', async () => {
    await service.getList({ tk: ['toiDanhChinh~Giết người'] } as never, null);
    const and = JSON.stringify(
      mockPrisma.case.findMany.mock.calls[0][0].where.AND,
    );
    expect(and).toContain('"crimeChinh":{"is"');
    expect(and).toContain('"nameBd":{"contains":"giet nguoi"}');
    expect(and).toContain(
      '"name":{"contains":"Giết người","mode":"insensitive"}',
    );
  });

  it('thẻ Tên vụ án lọc cột bóng TÊN, không phải cột ghép mọi cột', async () => {
    await service.getList({ tk: ['tenVuAn~trom'] } as never, null);
    const and = JSON.stringify(
      mockPrisma.case.findMany.mock.calls[0][0].where.AND,
    );
    expect(and).toContain('"nameBd":{"contains":"trom"}');
    expect(and).not.toContain('timKiemBd');
  });

  it('thẻ `*` vẫn tìm cả tên vụ án (cột ghép giữ nguyên, không cần nạp lại)', async () => {
    await service.getList({ tk: ['*~trom'] } as never, null);
    const and = JSON.stringify(
      mockPrisma.case.findMany.mock.calls[0][0].where.AND,
    );
    expect(and).toContain('"timKiemBd":{"contains":"trom"}');
  });

  it('[rà mã P2] thẻ `*` tìm cả chữ đang hiện ở cột Tội danh chính và Bị can (qua quan hệ)', async () => {
    await service.getList({ tk: ['*~giet nguoi'] } as never, null);
    const and = JSON.stringify(
      mockPrisma.case.findMany.mock.calls[0][0].where.AND,
    );
    expect(and).toContain('"crimeChinh":{"is"');
    expect(and).toContain('"subjects":{"some"');
    expect(and).toContain('"timKiemBd":{"contains":"giet nguoi"}');
  });

  describe('xuất Excel theo phường — CÙNG bộ lọc với danh sách', () => {
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

    it('áp thẻ tìm, phường, trạng thái, loại REGULAR và phạm vi dữ liệu như danh sách', async () => {
      await service.exportWardCases(
        {
          tk: ['tenVuAn~trom'],
          wardTeamId: 'w1',
          status: CaseStatus.TIEP_NHAN,
        } as never,
        PHAM_VI as never,
        res() as never,
      );
      const where = mockPrisma.case.findMany.mock.calls[0][0].where;
      expect(where.caseType).toBe(CaseType.REGULAR);
      expect(where.status).toBe(CaseStatus.TIEP_NHAN);
      expect(where.assignedTeam).toEqual({ is: { wardId: 'w1' } });
      const and = JSON.stringify(where.AND);
      expect(and).toContain('"nameBd":{"contains":"trom"}');
      expect(and).toContain('"assignedTeamId":{"in":["t1"]}');
    });

    it('[rà mã P2] phụ đề tệp xuất ghi ĐÚNG kỳ đang áp (kỳ mặc định tháng), không ghi Tất cả thời gian', async () => {
      const dauDe = jest.spyOn(BcaExcelHelper, 'addHeader');
      Object.assign(kyMacDinh, {
        ky: 'THANG_HIEN_TAI',
        tuNgay: '2026-09-01',
        denNgay: '2026-09-30',
      });
      try {
        await service.exportWardCases({} as never, null, res() as never);
        expect(dauDe.mock.calls[0][3]).toBe(
          'Ngày đề xuất từ 01/09/2026 đến 30/09/2026',
        );
        dauDe.mockClear();
        await service.exportWardCases(
          { fromDate: '2026-09-10' } as never,
          null,
          res() as never,
        );
        expect(dauDe.mock.calls[0][3]).toBe(
          'Ngày đề xuất từ 10/09/2026 đến 30/09/2026',
        );
        dauDe.mockClear();
        Object.assign(kyMacDinh, { ky: 'TAT_CA', tuNgay: null, denNgay: null });
        await service.exportWardCases({} as never, null, res() as never);
        expect(dauDe.mock.calls[0][3]).toBe('Tất cả thời gian');
      } finally {
        Object.assign(kyMacDinh, { ky: 'TAT_CA', tuNgay: null, denNgay: null });
        dauDe.mockRestore();
      }
    });

    it('tải HẾT mọi trang, không cắt ở 500 dòng đầu', async () => {
      const dong = (i: number) => ({
        id: `c${i}`,
        caseCode: `2026-${i}`,
        name: `Vụ ${i}`,
        crime: null,
        crimeChinh: { name: 'Tội trộm cắp tài sản' },
        status: CaseStatus.TIEP_NHAN,
        ngayDeXuat: new Date('2026-09-01T00:00:00Z'),
        subjects: [],
        _count: { subjects: 0 },
        assignedTeam: { ward: { name: 'Phường Bến Nghé' } },
        investigator: null,
      });
      mockPrisma.case.count.mockResolvedValue(450);
      mockPrisma.case.findMany.mockImplementation(
        ({ skip, take }: { skip: number; take: number }) =>
          Promise.resolve(
            Array.from(
              { length: Math.max(0, Math.min(take, 450 - skip)) },
              (_, k) => dong(skip + k),
            ),
          ),
      );
      await service.exportWardCases({} as never, null, res() as never);
      const layRa = mockPrisma.case.findMany.mock.calls.reduce(
        (n: number, [a]: [{ skip: number; take: number }]) =>
          n + Math.max(0, Math.min(a.take, 450 - a.skip)),
        0,
      );
      expect(layRa).toBe(450);
      mockPrisma.case.findMany.mockReset().mockResolvedValue([]);
      mockPrisma.case.count.mockReset().mockResolvedValue(0);
    });
  });

  it('mã hồ sơ dạng ngắn như trên bảng: 2026-11171 → 26-11171; mã lạ giữ nguyên', () => {
    expect(maHoSoNgan('2026-11171')).toBe('26-11171');
    expect(maHoSoNgan('26-11171')).toBe('26-11171');
    expect(maHoSoNgan('3023-1')).toBe('3023-1');
    expect(maHoSoNgan(null)).toBe('');
  });
});
