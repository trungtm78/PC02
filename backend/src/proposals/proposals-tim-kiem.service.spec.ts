/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ProposalStatus } from '@prisma/client';
import { ProposalsService } from './proposals.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DocumentNumbersService } from '../document-numbers/document-numbers.service';

/**
 * Kiến nghị VKS tìm ở MÁY CHỦ (17/09/2026). Trước đó màn tải `limit=100` rồi lọc tại chỗ; còn `getList`
 * gán `where.OR` cho ô tìm rồi GÁN LẠI `where.OR` cho phạm vi — cán bộ có phạm vi gõ gì cũng ra mọi
 * kiến nghị trong phạm vi (cùng lớp lỗi đã vá ở Tài liệu, b9c1853d).
 */
const mockPrisma = {
  proposal: {
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    groupBy: jest.fn().mockResolvedValue([]),
  },
};

const whereList = () => mockPrisma.proposal.findMany.mock.calls[0][0].where;
const PHAM_VI = {
  userIds: ['u1'],
  teamIds: ['t1'],
  writableTeamIds: [],
  writableUserIds: ['u1'],
};

describe('ProposalsService — tìm kiếm dạng thẻ + thống kê phía máy chủ', () => {
  let service: ProposalsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ProposalsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: { log: jest.fn() } },
        { provide: DocumentNumbersService, useValue: {} },
      ],
    }).compile();
    service = module.get(ProposalsService);
  });

  it('thẻ `*` → cột bóng tổng, bỏ dấu; `search` cũ quy về `*`', async () => {
    await service.getList({ tk: ['*~Lừa đảo'] } as never, null);
    expect(JSON.stringify(whereList().AND)).toContain(
      '"timKiemBd":{"contains":"lua dao"}',
    );
    jest.clearAllMocks();
    await service.getList({ search: 'Quận 12' } as never, null);
    expect(JSON.stringify(whereList().AND)).toContain(
      '"timKiemBd":{"contains":"quan 12"}',
    );
  });

  it('khoá lạ → 400, không truy vấn', async () => {
    await expect(
      service.getList({ tk: ['khongCo~x'] } as never, null),
    ).rejects.toThrow(BadRequestException);
    expect(mockPrisma.proposal.findMany).not.toHaveBeenCalled();
  });

  it('[P1] phạm vi KHÔNG đè điều kiện tìm: cả hai nằm trong AND, list và count cùng where', async () => {
    await service.getList({ tk: ['donViVks~quan 12'] } as never, PHAM_VI);
    const where = whereList();
    expect(where.OR).toBeUndefined();
    const chuoi = JSON.stringify(where.AND);
    expect(chuoi).toContain('"unitBd":{"contains":"quan 12"}');
    expect(chuoi).toContain('"createdById":{"in":["u1"]}');
    expect(mockPrisma.proposal.count.mock.calls[0][0].where).toEqual(where);
  });

  it('thẻ Hồ sơ liên quan lọc theo TÊN vụ án đang hiện (cột bóng của đích)', async () => {
    await service.getList({ tk: ['hoSoLienQuan~trom cap'] } as never, null);
    expect(JSON.stringify(whereList().AND)).toContain('"relatedCase"');
    expect(JSON.stringify(whereList().AND)).toContain(
      '"nameBd":{"contains":"trom cap"}',
    );
  });

  it('trạng thái lạ → 400; từ/đến ngày lọc theo ngày Việt Nam, gồm trọn ngày cuối', async () => {
    await expect(
      service.getList({ status: 'X' } as never, null),
    ).rejects.toThrow(BadRequestException);
    await service.getList(
      { fromDate: '2025-08-01', toDate: '2025-08-31' } as never,
      null,
    );
    expect(whereList().createdAt).toEqual({
      gte: new Date('2025-07-31T17:00:00.000Z'),
      lt: new Date('2025-08-31T17:00:00.000Z'),
    });
  });

  it('getStats: đếm đủ 4 trạng thái trên CÙNG thẻ/ngày/phạm vi, bỏ lọc trạng thái (tham số lẫn thẻ)', async () => {
    mockPrisma.proposal.groupBy.mockResolvedValueOnce([
      { status: ProposalStatus.CHO_GUI, _count: { _all: 30 } },
      { status: ProposalStatus.DA_GUI, _count: { _all: 3 } },
    ]);
    const res = await service.getStats(
      {
        tk: ['trangThai~DA_GUI', 'donViVks~quan 8'],
        status: 'DA_GUI',
      } as never,
      PHAM_VI,
    );
    expect(res).toEqual({
      total: 33,
      byStatus: { CHO_GUI: 30, DA_GUI: 3, CO_PHAN_HOI: 0, DA_XU_LY: 0 },
    });
    const where = mockPrisma.proposal.groupBy.mock.calls[0][0].where;
    expect(where.status).toBeUndefined();
    const chuoi = JSON.stringify(where);
    expect(chuoi).not.toContain('DA_GUI');
    expect(chuoi).toContain('"unitBd":{"contains":"quan 8"}');
    expect(chuoi).toContain('"createdById":{"in":["u1"]}');
  });

  /**
   * Ô tìm cũ (cờ TIM_KIEM_THE tắt) trước đây khớp cả TÊN vụ án liên quan đang hiện trên cột — `search`
   * phải tìm cả mọi cột lẫn Hồ sơ liên quan (Codex rà 226abee2 bắt).
   */
  it('`search` cũ tìm CẢ mọi cột lẫn tên vụ án liên quan (một khối hoặc)', async () => {
    await service.getList({ search: 'trom cap' } as never, null);
    const chuoi = JSON.stringify(whereList().AND);
    expect(chuoi).toContain('"timKiemBd":{"contains":"trom cap"}');
    expect(chuoi).toContain('"nameBd":{"contains":"trom cap"}');
  });

  /**
   * Phạm vi danh sách phải KHỚP quyền xem chi tiết (`getById`): người điều phối đọc toàn bộ; tổ trưởng
   * (userIds rỗng, có tổ) thấy kiến nghị không gắn hồ sơ. Rà mã độc lập bắt: danh sách ẩn những bản ghi
   * mà màn chi tiết vẫn cho xem.
   */
  it('người điều phối (canDispatch): KHÔNG thêm điều kiện phạm vi', async () => {
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
    expect(JSON.stringify(whereList())).not.toContain('relatedCase');
  });

  it('tổ trưởng (userIds rỗng, có tổ): thấy kiến nghị không gắn hồ sơ', async () => {
    await service.getList({} as never, {
      userIds: [],
      teamIds: ['t1'],
      writableTeamIds: [],
      writableUserIds: [],
    });
    const chuoi = JSON.stringify(whereList().AND);
    expect(chuoi).toContain('{"relatedCase":null,"createdById":{"not":null}}');
  });

  it('tổ trưởng: chỉ bản không gắn hồ sơ CÓ người tạo; sắp theo createdAt rồi id', async () => {
    await service.getList({} as never, {
      userIds: [],
      teamIds: ['t1'],
      writableTeamIds: [],
      writableUserIds: [],
    });
    const call = mockPrisma.proposal.findMany.mock.calls[0][0];
    expect(JSON.stringify(call.where.AND)).toContain(
      '{"relatedCase":null,"createdById":{"not":null}}',
    );
    expect(call.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
  });
});
