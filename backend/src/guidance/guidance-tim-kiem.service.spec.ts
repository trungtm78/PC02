/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { GuidanceStatus } from '@prisma/client';
import { GuidanceService } from './guidance.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

/**
 * Hướng dẫn đơn tìm ở MÁY CHỦ (17/09/2026). Trước đó màn tải `limit=100` rồi lọc tại chỗ — prod có 541
 * bản ghi nên 441 bản (81%) gõ đúng thế nào cũng không ra, và thẻ thống kê đếm trên 100 dòng đã tải.
 */
const mockPrisma = {
  guidanceRecord: {
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    groupBy: jest.fn().mockResolvedValue([]),
  },
};

const whereList = () =>
  mockPrisma.guidanceRecord.findMany.mock.calls[0][0].where;

describe('GuidanceService — tìm kiếm dạng thẻ + thống kê phía máy chủ', () => {
  let service: GuidanceService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        GuidanceService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: { log: jest.fn() } },
      ],
    }).compile();
    service = module.get(GuidanceService);
  });

  it('thẻ `*` → cột bóng tổng `timKiemBd`, bỏ dấu; không còn where.OR chép tay', async () => {
    await service.getList({ tk: ['*~Nguyễn An'] } as never, null);
    const where = whereList();
    expect(where.OR).toBeUndefined();
    expect(JSON.stringify(where.AND)).toContain(
      '"timKiemBd":{"contains":"nguyen an"}',
    );
  });

  it('`search` cũ quy về thẻ tất cả các cột', async () => {
    await service.getList({ search: 'Hồng' } as never, null);
    expect(JSON.stringify(whereList().AND)).toContain(
      '"timKiemBd":{"contains":"hong"}',
    );
  });

  it('thẻ Người được hướng dẫn → cột bóng ghép tên + SĐT', async () => {
    await service.getList({ tk: ['nguoiDuocHuongDan~0909'] } as never, null);
    expect(JSON.stringify(whereList().AND)).toContain(
      '"nguoiDuocHuongDanBd":{"contains":"0909"}',
    );
  });

  it('khoá lạ → 400, không truy vấn', async () => {
    await expect(
      service.getList({ tk: ['khongCo~x'] } as never, null),
    ).rejects.toThrow(BadRequestException);
    expect(mockPrisma.guidanceRecord.findMany).not.toHaveBeenCalled();
  });

  /**
   * Cùng lớp lỗi đã vá ở Tài liệu (b9c1853d): điều kiện phạm vi và điều kiện tìm là HAI phần tử của AND,
   * không bên nào gán đè bên kia.
   */
  it('phạm vi dữ liệu + thẻ cùng áp, list và count dùng CÙNG where', async () => {
    await service.getList({ tk: ['vanDe~dat dai'] } as never, {
      userIds: ['u1'],
      teamIds: [],
      writableTeamIds: [],
    });
    const where = whereList();
    const chuoi = JSON.stringify(where.AND);
    expect(chuoi).toContain('"subjectBd":{"contains":"dat dai"}');
    expect(chuoi).toContain('"createdById":{"in":["u1"]}');
    expect(mockPrisma.guidanceRecord.count.mock.calls[0][0].where).toEqual(
      where,
    );
  });

  /**
   * Lọc ngày theo cột `date` (ngày hiện trên bảng), không phải `createdAt`: đo prod 17/09, cả 541 bản
   * di trú có `createdAt` = ngày chạy di trú (23/07/2026) nên lọc cũ ra rỗng hoặc ra tất cả.
   */
  it('từ ngày / đến ngày lọc cột `date` theo ngày Việt Nam, gồm trọn ngày cuối', async () => {
    await service.getList(
      { fromDate: '2024-08-01', toDate: '2024-08-31' } as never,
      null,
    );
    const where = whereList();
    expect(where.createdAt).toBeUndefined();
    expect(where.date).toEqual({
      gte: new Date('2024-07-31T17:00:00.000Z'),
      lt: new Date('2024-08-31T17:00:00.000Z'),
    });
  });

  it('ngày sai dạng → 400', async () => {
    await expect(
      service.getList({ fromDate: '31/31/2024' } as never, null),
    ).rejects.toThrow(BadRequestException);
  });

  it('danh sách trả mã hồ sơ năm-stt của hệ cũ, KHÔNG trả nguyên legacyRaw', async () => {
    mockPrisma.guidanceRecord.findMany.mockResolvedValueOnce([
      {
        id: 'g1',
        legacyRaw: { nam: 2024, stt: 482, tom_tat_noi_dung: 'dài…' },
      },
      { id: 'g2', legacyRaw: null },
      { id: 'g3', legacyRaw: { nam: '2025', stt: '4794' } },
      { id: 'g4', legacyRaw: { nam: '2025', stt: 'd' } },
    ]);
    const res = await service.getList({} as never, null);
    expect(res.data).toEqual([
      { id: 'g1', maHoSo: '2024-482' },
      { id: 'g2', maHoSo: null },
      { id: 'g3', maHoSo: '2025-4794' },
      { id: 'g4', maHoSo: null },
    ]);
    const select = mockPrisma.guidanceRecord.findMany.mock.calls[0][0];
    expect(select.include).toBeUndefined();
  });

  describe('getStats', () => {
    it('đếm theo trạng thái trên CÙNG thẻ/ngày/phạm vi với danh sách, bỏ lọc trạng thái', async () => {
      mockPrisma.guidanceRecord.groupBy.mockResolvedValueOnce([
        { status: GuidanceStatus.PENDING, _count: { _all: 7 } },
        { status: GuidanceStatus.COMPLETED, _count: { _all: 2 } },
      ]);
      mockPrisma.guidanceRecord.count.mockResolvedValueOnce(1);
      const res = await service.getStats(
        { tk: ['donVi~doi 4'], status: 'COMPLETED' } as never,
        null,
        new Date('2026-09-17T03:00:00.000Z'),
      );
      expect(res).toEqual({
        total: 9,
        byStatus: { PENDING: 7, COMPLETED: 2, CANCELLED: 0 },
        today: 1,
      });
      const whereGom = mockPrisma.guidanceRecord.groupBy.mock.calls[0][0].where;
      expect(whereGom.status).toBeUndefined();
      expect(JSON.stringify(whereGom.AND)).toContain(
        '"unitBd":{"contains":"doi 4"}',
      );
      // "Hôm nay" = ngày Việt Nam của thời điểm hỏi, trên cùng where.
      const whereHomNay =
        mockPrisma.guidanceRecord.count.mock.calls[0][0].where;
      expect(whereHomNay.AND).toEqual(
        expect.arrayContaining([
          {
            date: {
              gte: new Date('2026-09-16T17:00:00.000Z'),
              lt: new Date('2026-09-17T17:00:00.000Z'),
            },
          },
        ]),
      );
    });

    /**
     * Lọc trạng thái bằng THẺ phải cho cùng bộ số với lọc bằng ô chọn: thẻ Trạng thái không thu hẹp
     * thống kê (rà mã 17/09 bắt: tk=trangThai~PENDING làm thẻ "Đã hoàn thành" về 0).
     */
    it('thẻ Trạng thái KHÔNG thu hẹp thống kê, thẻ khác vẫn áp', async () => {
      await service.getStats(
        { tk: ['trangThai~PENDING', 'donVi~doi 4'] } as never,
        null,
      );
      const where = mockPrisma.guidanceRecord.groupBy.mock.calls[0][0].where;
      const chuoi = JSON.stringify(where);
      expect(chuoi).not.toContain('PENDING');
      expect(chuoi).toContain('"unitBd":{"contains":"doi 4"}');
    });

    it('trạng thái lạ ở danh sách → 400 (không để Prisma ném 500)', async () => {
      await expect(
        service.getList({ status: 'ACTIVE' } as never, null),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
