/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ExchangesService } from './exchanges.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

/**
 * Trao đổi chuyên án tìm ở MÁY CHỦ (17/09/2026). Đo prod: 76 bản đều di trú — mã hồ sơ rỗng 73/76 (mã
 * `năm-stt` thật nằm trong legacyRaw), thông tin thật ở `subject`.
 */
const mockPrisma = {
  exchange: {
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
    create: jest.fn(),
    update: jest.fn().mockResolvedValue({}),
  },
  exchangeMessage: { create: jest.fn().mockResolvedValue({ id: 'm1' }) },
  $transaction: jest.fn(),
};

const goiList = () => mockPrisma.exchange.findMany.mock.calls[0][0];

describe('ExchangesService — tìm kiếm dạng thẻ phía máy chủ', () => {
  let service: ExchangesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    );
    const module = await Test.createTestingModule({
      providers: [
        ExchangesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: { log: jest.fn() } },
      ],
    }).compile();
    service = module.get(ExchangesService);
  });

  it('thẻ `*` → cột bóng tổng (gồm subject), bỏ dấu; `search` cũ quy về `*`', async () => {
    await service.getList({ tk: ['*~Mai Thanh Tâm'] } as never, null);
    expect(JSON.stringify(goiList().where.AND)).toContain(
      '"timKiemBd":{"contains":"mai thanh tam"}',
    );
    jest.clearAllMocks();
    await service.getList({ search: 'to cao' } as never, null);
    expect(JSON.stringify(goiList().where.AND)).toContain(
      '"timKiemBd":{"contains":"to cao"}',
    );
  });

  it('khoá lạ / trạng thái lạ → 400', async () => {
    await expect(
      service.getList({ tk: ['tinNhanCuoi~x'] } as never, null),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.getList({ status: 'open' } as never, null),
    ).rejects.toThrow(BadRequestException);
  });

  it('phạm vi khớp getById: userIds → người tạo; điều phối đọc toàn bộ; tổ trưởng bỏ bản không người tạo', async () => {
    await service.getList({ tk: ['donViNhan~doi 4'] } as never, {
      userIds: ['u1'],
      teamIds: ['t1'],
      writableTeamIds: [],
    });
    let chuoi = JSON.stringify(goiList().where.AND);
    expect(chuoi).toContain('"receiverUnitBd":{"contains":"doi 4"}');
    expect(chuoi).toContain('"createdById":{"in":["u1"]}');
    jest.clearAllMocks();
    await service.getList(
      {} as never,
      {
        userIds: ['u1'],
        teamIds: [],
        writableTeamIds: [],
        canDispatch: true,
      } as never,
    );
    expect(JSON.stringify(goiList().where)).not.toContain('createdById');
    jest.clearAllMocks();
    await service.getList({} as never, {
      userIds: [],
      teamIds: ['t1'],
      writableTeamIds: [],
    });
    chuoi = JSON.stringify(goiList().where.AND);
    expect(chuoi).toContain('"createdById":{"not":null}');
  });

  it('ngày lọc createdAt theo giờ Việt Nam; sắp updatedAt rồi id', async () => {
    await service.getList(
      { fromDate: '2025-08-01', toDate: '2025-08-31' } as never,
      null,
    );
    expect(goiList().where.createdAt).toEqual({
      gte: new Date('2025-07-31T17:00:00.000Z'),
      lt: new Date('2025-08-31T17:00:00.000Z'),
    });
    expect(goiList().orderBy).toEqual([{ updatedAt: 'desc' }, { id: 'desc' }]);
  });

  it('dòng danh sách có maHoSo: mã đang lưu, rỗng thì năm-stt hệ cũ; KHÔNG trả legacyRaw', async () => {
    mockPrisma.exchange.findMany.mockResolvedValueOnce([
      {
        id: 'e1',
        recordCode: 'VA-01',
        legacyRaw: { nam: 2025, stt: 1 },
        messages: [],
        _count: { messages: 0 },
      },
      {
        id: 'e2',
        recordCode: null,
        legacyRaw: { nam: 2025, stt: 586 },
        messages: [],
        _count: { messages: 0 },
      },
    ]);
    const res = await service.getList({} as never, null);
    expect(res.data.map((d) => [d.id, d.maHoSo])).toEqual([
      ['e1', 'VA-01'],
      ['e2', '2025-586'],
    ]);
    expect(res.data[0]).not.toHaveProperty('legacyRaw');
  });

  /** Form tạo gửi nội dung tin nhắn đầu tiên — DTO từng không có `content` nên tạo mới luôn 400. */
  it('tạo kèm nội dung → tạo trao đổi VÀ tin nhắn đầu tiên trong một giao dịch', async () => {
    mockPrisma.exchange.create.mockResolvedValue({ id: 'e9', subject: 'S' });
    await service.create(
      { subject: 'S', content: 'Xin trao đổi hồ sơ' } as never,
      'u1',
    );
    expect(mockPrisma.$transaction).toHaveBeenCalled();
    expect(mockPrisma.exchangeMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          exchangeId: 'e9',
          senderId: 'u1',
          content: 'Xin trao đổi hồ sơ',
        }),
      }),
    );
    const data = mockPrisma.exchange.create.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('content');
  });

  /** addMessage từng không kiểm phạm vi: biết id là gửi được tin vào trao đổi mình không được xem. */
  it('gửi tin nhắn vào trao đổi ngoài phạm vi → 403, không ghi', async () => {
    mockPrisma.exchange.findFirst.mockResolvedValue({
      id: 'e1',
      createdById: 'u-khac',
      deletedAt: null,
    });
    await expect(
      service.addMessage({ exchangeId: 'e1', content: 'x' }, 'u1', {
        userIds: ['u1'],
        teamIds: [],
        writableTeamIds: [],
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(mockPrisma.exchangeMessage.create).not.toHaveBeenCalled();
  });
});
