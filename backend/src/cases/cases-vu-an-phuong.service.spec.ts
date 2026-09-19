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
import { CASE_STATUS_LABEL } from '../common/constants/status-labels.constants';
import * as ExcelJSDoc from 'exceljs';
import { PassThrough } from 'stream';

const mockPrisma = {
  case: {
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    groupBy: jest.fn().mockResolvedValue([]),
  },
};

const PHAM_VI = {
  userIds: ['u1'],
  teamIds: ['t1'],
  writableTeamIds: [],
  writableUserIds: ['u1'],
};

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

  it('danh sách trả nguồn hồ sơ (caseProvenance) — cột Nguồn hồ sơ của màn Hồ sơ mới tiếp nhận', async () => {
    await service.getList({} as never, null);
    expect(
      mockPrisma.case.findMany.mock.calls[0][0].select.caseProvenance,
    ).toBe(true);
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
    // Bộ xuất chung ghi LUỒNG thẳng vào phản hồi — cần luồng thật; mỗi lượt xuất một phản hồi mới.
    const res = (phan: Buffer[] = []) => {
      const r = Object.assign(new PassThrough(), { setHeader: jest.fn() });
      r.on('data', (c: Buffer) => phan.push(c));
      return r;
    };

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

    it('tải HẾT mọi dòng khớp, không cắt ở 500 dòng đầu — đúng thứ tự danh sách', async () => {
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
      mockPrisma.case.count.mockResolvedValue(650);
      mockPrisma.case.findMany.mockImplementation(
        (a: { where: { id?: { in: string[] } } }) =>
          Promise.resolve(
            a.where.id
              ? a.where.id.in.map((id) => dong(Number(id.slice(1))))
              : Array.from({ length: 650 }, (_, k) => ({ id: `c${k}` })),
          ),
      );
      try {
        const phan: Buffer[] = [];
        await service.exportWardCases({} as never, null, res(phan) as never);
        await new Promise((r) => setImmediate(r));
        const wb = new ExcelJSDoc.Workbook();
        await wb.xlsx.load(Buffer.concat(phan) as never);
        const sheet = wb.worksheets[0];
        // Hàng 7 tiêu đề cột, 8..657 là 650 dòng dữ liệu.
        expect(sheet.getRow(657).getCell(2).value).toBe('26-649');
        expect(sheet.getRow(658).getCell(2).value).toBeNull();
      } finally {
        mockPrisma.case.findMany.mockReset().mockResolvedValue([]);
        mockPrisma.case.count.mockReset().mockResolvedValue(0);
      }
    });

    it('GIỮ đúng cột, tiêu đề và giá trị của tệp phường cũ; tên tệp, sheet, tiêu đề không đổi', async () => {
      const vuAn = {
        id: 'c1',
        caseCode: '2026-11171',
        name: 'Trộm xe máy',
        crime: 'chữ cũ',
        crimeChinh: { name: 'Tội trộm cắp tài sản' },
        status: CaseStatus.TIEP_NHAN,
        ngayDeXuat: new Date('2026-09-01T03:00:00Z'),
        subjects: [{ fullName: 'Nguyễn A' }, { fullName: 'Trần B' }],
        _count: { subjects: 5 },
        assignedTeam: { ward: { name: 'Phường Bến Nghé' } },
        investigator: { lastName: 'Lê', firstName: 'Văn C', username: 'lvc' },
      };
      mockPrisma.case.count.mockResolvedValue(1);
      mockPrisma.case.findMany
        .mockResolvedValueOnce([{ id: 'c1' }])
        .mockResolvedValueOnce([vuAn]);
      const phan: Buffer[] = [];
      const r = res(phan);
      try {
        await service.exportWardCases({} as never, null, r as never);
        await new Promise((x) => setImmediate(x));
      } finally {
        mockPrisma.case.count.mockReset().mockResolvedValue(0);
      }
      expect(r.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringMatching(/VuAnPhuongXa_\d{4}-\d{2}-\d{2}\.xlsx/),
      );
      const wb = new ExcelJSDoc.Workbook();
      await wb.xlsx.load(Buffer.concat(phan) as never);
      const sheet = wb.worksheets[0];
      expect(sheet.name).toBe('Danh sách vụ án');
      expect(JSON.stringify(sheet.getRow(4).values)).toContain(
        'DANH SÁCH VỤ ÁN THEO PHƯỜNG/XÃ',
      );
      expect((sheet.getRow(7).values as unknown[]).slice(1)).toEqual([
        'STT',
        'Mã hồ sơ',
        'Tên vụ án',
        'Tội danh',
        'Bị can',
        'Phường/Xã',
        'ĐTV phụ trách',
        'Ngày đề xuất',
        'Trạng thái',
      ]);
      expect(
        [2, 3, 4, 5, 6, 7, 8, 9].map((c) => sheet.getColumn(c).width),
      ).toEqual([14, 36, 28, 28, 22, 22, 14, 18]);
      expect((sheet.getRow(8).values as unknown[]).slice(1)).toEqual([
        1,
        '26-11171',
        'Trộm xe máy',
        'Tội trộm cắp tài sản',
        'Nguyễn A, Trần B (+3)',
        'Phường Bến Nghé',
        'Lê Văn C',
        // Same formatter as the old file (ICU output differs across Node builds).
        vuAn.ngayDeXuat.toLocaleDateString('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
        }),
        CASE_STATUS_LABEL[CaseStatus.TIEP_NHAN],
      ]);
    });

    it('không có vụ án nào vẫn trả tệp (chỉ tiêu đề) như trước; ghi nhật ký kind=ward', async () => {
      const audit = (service as unknown as { audit: { log: jest.Mock } }).audit;
      const r = res();
      await service.exportWardCases({} as never, null, r as never, {
        userId: 'u1',
      });
      expect(r.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('VuAnPhuongXa_'),
      );
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CASE_EXPORTED',
          metadata: expect.objectContaining({ kind: 'ward', format: 'xlsx' }),
        }),
      );
    });
  });

  it('mã hồ sơ dạng ngắn như trên bảng: 2026-11171 → 26-11171; mã lạ giữ nguyên', () => {
    expect(maHoSoNgan('2026-11171')).toBe('26-11171');
    expect(maHoSoNgan('26-11171')).toBe('26-11171');
    expect(maHoSoNgan('3023-1')).toBe('3023-1');
    expect(maHoSoNgan(null)).toBe('');
  });
});
