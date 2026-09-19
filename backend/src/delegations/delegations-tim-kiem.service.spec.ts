/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DelegationStatus } from '@prisma/client';
import { DelegationsService } from './delegations.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DocumentNumbersService } from '../document-numbers/document-numbers.service';

/**
 * Ủy thác điều tra tìm ở MÁY CHỦ (17/09/2026). Cùng hai lỗi đã vá ở Kiến nghị VKS (#396): `getList` gán
 * `where.OR` cho ô tìm rồi GÁN LẠI cho phạm vi (ô tìm bị đè), và phạm vi danh sách lệch quyền xem chi
 * tiết (người điều phối / tổ trưởng không thấy bản ghi mà `getById` vẫn cho xem).
 */
const mockPrisma = {
  delegation: {
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    groupBy: jest.fn().mockResolvedValue([]),
  },
};

const whereList = () => mockPrisma.delegation.findMany.mock.calls[0][0].where;

describe('DelegationsService — tìm kiếm dạng thẻ + thống kê phía máy chủ', () => {
  let service: DelegationsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        DelegationsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: { log: jest.fn() } },
        { provide: DocumentNumbersService, useValue: {} },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();
    service = module.get(DelegationsService);
  });

  it('thẻ `*` → cột bóng tổng, bỏ dấu; `search` cũ tìm cả mọi cột lẫn tên vụ án liên quan', async () => {
    await service.getList({ tk: ['*~Quận Tân Bình'] } as never, null);
    expect(JSON.stringify(whereList().AND)).toContain(
      '"timKiemBd":{"contains":"quan tan binh"}',
    );
    jest.clearAllMocks();
    await service.getList({ search: 'trom cap' } as never, null);
    const chuoi = JSON.stringify(whereList().AND);
    expect(chuoi).toContain('"timKiemBd":{"contains":"trom cap"}');
    expect(chuoi).toContain('"nameBd":{"contains":"trom cap"}');
  });

  it('khoá lạ → 400, không truy vấn; trạng thái lạ → 400', async () => {
    await expect(
      service.getList({ tk: ['khongCo~x'] } as never, null),
    ).rejects.toThrow(BadRequestException);
    expect(mockPrisma.delegation.findMany).not.toHaveBeenCalled();
    await expect(
      service.getList({ status: 'pending' } as never, null),
    ).rejects.toThrow(BadRequestException);
  });

  it('[P1] phạm vi KHÔNG đè điều kiện tìm: cả hai trong AND, list và count cùng where', async () => {
    await service.getList({ tk: ['donViNhan~quan 1'] } as never, {
      userIds: ['u1'],
      teamIds: ['t1'],
      writableTeamIds: [],
      writableUserIds: ['u1'],
    });
    const where = whereList();
    expect(where.OR).toBeUndefined();
    const chuoi = JSON.stringify(where.AND);
    expect(chuoi).toContain('"receivingUnitBd":{"contains":"quan 1"}');
    expect(chuoi).toContain('"createdById":{"in":["u1"]}');
    expect(mockPrisma.delegation.count.mock.calls[0][0].where).toEqual(where);
  });

  it('phạm vi khớp getById: người điều phối đọc toàn bộ; tổ trưởng thấy bản không gắn hồ sơ', async () => {
    await service.getList(
      {} as never,
      {
        userIds: ['u1'],
        teamIds: ['t1'],
        writableTeamIds: [],
        writableUserIds: ['u1'],
        canDispatch: true,
      } as never,
    );
    expect(JSON.stringify(whereList())).not.toContain('createdById');
    jest.clearAllMocks();
    await service.getList({} as never, {
      userIds: [],
      teamIds: ['t1'],
      writableTeamIds: [],
      writableUserIds: [],
    });
    expect(JSON.stringify(whereList().AND)).toContain(
      '{"relatedCase":null,"createdById":{"not":null}}',
    );
  });

  /** Lọc NGÀY ỦY THÁC đang hiện trên bảng (không phải ngày nhập máy), theo ngày Việt Nam. */
  it('từ/đến ngày lọc cột delegationDate theo ngày Việt Nam, gồm trọn ngày cuối', async () => {
    await service.getList(
      { fromDate: '2026-09-01', toDate: '2026-09-30' } as never,
      null,
    );
    const where = whereList();
    expect(where.createdAt).toBeUndefined();
    expect(where.delegationDate).toEqual({
      gte: new Date('2026-08-31T17:00:00.000Z'),
      lt: new Date('2026-09-30T17:00:00.000Z'),
    });
  });

  it('getStats: đủ 3 trạng thái trên CÙNG thẻ/ngày/phạm vi, bỏ lọc trạng thái (tham số lẫn thẻ)', async () => {
    mockPrisma.delegation.groupBy.mockResolvedValueOnce([
      { status: DelegationStatus.PENDING, _count: { _all: 4 } },
      { status: DelegationStatus.COMPLETED, _count: { _all: 1 } },
    ]);
    const res = await service.getStats(
      {
        tk: ['trangThai~COMPLETED', 'donViNhan~quan 1'],
        status: 'COMPLETED',
      } as never,
      null,
    );
    expect(res).toEqual({
      total: 5,
      byStatus: { PENDING: 4, RECEIVED: 0, COMPLETED: 1 },
    });
    const where = mockPrisma.delegation.groupBy.mock.calls[0][0].where;
    expect(where.status).toBeUndefined();
    const chuoi = JSON.stringify(where);
    expect(chuoi).not.toContain('COMPLETED');
    expect(chuoi).toContain('"receivingUnitBd":{"contains":"quan 1"}');
  });

  /**
   * Rà mã 17/09: tổ trưởng thấy dòng không gắn hồ sơ mà người tạo đã bị xoá (createdById null) — getById
   * từ chối (assertCreatorInScope) nên dòng hiện mà mở ra 403. Phân trang cần khoá sắp phụ ổn định.
   */
  it('tổ trưởng: chỉ bản không gắn hồ sơ CÓ người tạo; sắp theo createdAt rồi id', async () => {
    await service.getList({} as never, {
      userIds: [],
      teamIds: ['t1'],
      writableTeamIds: [],
      writableUserIds: [],
    });
    const call = mockPrisma.delegation.findMany.mock.calls[0][0];
    expect(JSON.stringify(call.where.AND)).toContain(
      '{"relatedCase":null,"createdById":{"not":null}}',
    );
    expect(call.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
  });
});
