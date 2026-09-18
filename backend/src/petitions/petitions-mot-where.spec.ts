import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PetitionStatus } from '@prisma/client';
import { PetitionsService } from './petitions.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SettingsService } from '../settings/settings.service';
import { DeadlineRulesService } from '../deadline-rules/deadline-rules.service';
import { DocumentNumbersService } from '../document-numbers/document-numbers.service';

/**
 * Anh báo 18/09/2026: bấm "Áp dụng" ở Bộ lọc Đơn thư "không lọc được". Tái hiện trên trình duyệt thật:
 * chọn "Cán bộ nhập" thì bảng đổi nhưng thẻ "Tổng đơn thư" đứng yên — `getStats` tự dựng `where` riêng
 * và sót `enteredById` (cả `stt`, `sttCu`, và dùng danh sách trạng thái kết thúc khác `getList`).
 *
 * Sửa gốc: MỘT hàm dựng điều kiện (`dungWhereDanhSach`) cho danh sách, thẻ số và xuất Excel. Thẻ số bỏ
 * điều kiện trạng thái (để các chip vẫn đếm mọi trạng thái); ngoài ra phải BẰNG điều kiện danh sách.
 */
const mockPrisma = {
  petition: {
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    groupBy: jest.fn().mockResolvedValue([]),
  },
};

type Where = Record<string, unknown>;
const whereCua = (m: jest.Mock): Where =>
  (m.mock.calls[0] as [{ where: Where }])[0].where;

describe('PetitionsService — một nguồn điều kiện lọc cho danh sách, thẻ số, xuất', () => {
  let service: PetitionsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PetitionsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: { log: jest.fn() } },
        {
          provide: SettingsService,
          useValue: {
            getValue: jest.fn().mockResolvedValue(null),
            getKyThongKe: jest.fn().mockResolvedValue({
              ky: 'THANG_NAY',
              truong: 'NGAY_TIEP_NHAN',
              tuNgay: '2026-09-01',
              denNgay: '2026-09-30',
            }),
          },
        },
        {
          provide: DeadlineRulesService,
          useValue: { getActiveByKey: jest.fn().mockResolvedValue(null) },
        },
        {
          provide: DocumentNumbersService,
          useValue: { generate: jest.fn(), commitWithTx: jest.fn() },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();
    service = module.get(PetitionsService);
  });

  const boLoc = {
    enteredById: 'u-bui-thanh',
    stt: '26-11171',
    sttCu: '208',
    fromDate: '2026-01-01',
    toDate: '2026-12-31',
    overdue: true,
    petitionType: 'TO_CAO',
  };

  it('thẻ số lọc theo Cán bộ nhập (bản cũ sót → thẻ đứng yên khi bảng đổi)', async () => {
    await service.getStats(boLoc as never, null);
    expect(whereCua(mockPrisma.petition.groupBy).enteredById).toBe(
      'u-bui-thanh',
    );
  });

  it('điều kiện thẻ số = điều kiện danh sách, chỉ khác phần trạng thái', async () => {
    // "Quá hạn" so với giờ hiện tại — cố định đồng hồ để hai lần dựng cùng một mốc.
    jest.useFakeTimers({
      now: new Date('2026-09-18T08:00:00Z'),
      doNotFake: ['nextTick', 'setImmediate'],
    });
    await service.getList(
      { ...boLoc, status: PetitionStatus.DANG_XU_LY } as never,
      null,
    );
    await service.getStats(boLoc as never, null);
    const danhSach = { ...whereCua(mockPrisma.petition.findMany) };
    const theSo = { ...whereCua(mockPrisma.petition.groupBy) };
    // Danh sách lọc thêm trạng thái đang chọn; thẻ số chỉ giữ phần "chưa kết thúc" của bộ lọc quá hạn.
    expect(danhSach.status).toEqual({
      equals: PetitionStatus.DANG_XU_LY,
      notIn: expect.any(Array),
    });
    expect(theSo.status).toEqual({
      notIn: (danhSach.status as { notIn: unknown }).notIn,
    });
    delete danhSach.status;
    delete theSo.status;
    expect(theSo).toEqual(danhSach);
    jest.useRealTimers();
  });

  it('dungWhereDanhSach dùng được trực tiếp (đường xuất Excel) và trả kỳ đã áp', async () => {
    const { where, ky } = await service.dungWhereDanhSach(boLoc as never, null);
    expect(where.enteredById).toBe('u-bui-thanh');
    expect(ky.ky).toBe('THANG_NAY');
  });
});
