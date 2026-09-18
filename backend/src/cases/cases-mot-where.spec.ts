import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CaseStatus } from '@prisma/client';
import { CasesService } from './cases.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SettingsService } from '../settings/settings.service';
import { DocumentNumbersService } from '../document-numbers/document-numbers.service';

/**
 * Cùng lỗi anh báo 18/09/2026 ở Đơn thư ("bấm Áp dụng không lọc được"): thẻ số và bảng phải đếm CÙNG
 * tập hồ sơ. Vụ án từng tự dựng `where` riêng trong `getStats` (chép tay từ `getList`) — mỗi lần thêm
 * bộ lọc phải nhớ sửa hai nơi. Nay MỘT hàm `dungWhereDanhSach` cho danh sách, thẻ số và xuất Excel;
 * thẻ số chỉ bỏ điều kiện trạng thái/nhóm trạng thái.
 */
const mockPrisma = {
  case: {
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    groupBy: jest.fn().mockResolvedValue([]),
  },
};

type Where = Record<string, unknown>;
const whereCua = (m: jest.Mock): Where =>
  (m.mock.calls[0] as [{ where: Where }])[0].where;

describe('CasesService — một nguồn điều kiện lọc cho danh sách, thẻ số, xuất', () => {
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
            getKyThongKe: jest.fn().mockResolvedValue({
              ky: 'THANG_NAY',
              truong: 'NGAY_TIEP_NHAN',
              tuNgay: '2026-09-01',
              denNgay: '2026-09-30',
            }),
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

  afterEach(() => {
    jest.useRealTimers();
  });

  const boLoc = {
    createdById: 'u-bui-thanh',
    investigatorId: 'dtv-1',
    fromDate: '2026-01-01',
    toDate: '2026-12-31',
    overdue: true,
    capDoToiPham: 'NGHIEM_TRONG',
    loaiUyThac: 'UY_THAC_DIEU_TRA',
    trangThaiPhanHoi: 'QUA_HAN',
    ngayTiepNhanFrom: '2026-02-01',
    ngayTiepNhanTo: '2026-03-31',
    districtId: 'q-1',
    wardId: 'p-1',
    wardTeamId: 'to-phuong-1',
  };

  it('thẻ số lọc theo Cán bộ nhập và Điều tra viên như danh sách', async () => {
    await service.getStats(boLoc as never, null);
    const theSo = whereCua(mockPrisma.case.groupBy);
    expect(theSo.createdById).toBe('u-bui-thanh');
    expect(theSo.investigatorId).toBe('dtv-1');
  });

  it('điều kiện thẻ số = điều kiện danh sách, chỉ khác phần trạng thái', async () => {
    // "Quá hạn" và trạng thái phản hồi so với giờ hiện tại — cố định đồng hồ để hai lần dựng cùng mốc.
    jest.useFakeTimers({
      now: new Date('2026-09-18T08:00:00Z'),
      doNotFake: ['nextTick', 'setImmediate'],
    });
    const phamVi = {
      teamIds: ['to-1'],
      userIds: ['u-1'],
      writableTeamIds: ['to-1'],
    };
    await service.getList(
      { ...boLoc, status: CaseStatus.DANG_DIEU_TRA } as never,
      phamVi as never,
    );
    await service.getStats(boLoc as never, phamVi as never);
    const danhSach = { ...whereCua(mockPrisma.case.findMany) };
    const theSo = { ...whereCua(mockPrisma.case.groupBy) };
    // Danh sách lọc thêm trạng thái đang chọn; thẻ số chỉ giữ phần "chưa kết thúc" của bộ lọc quá hạn.
    expect(danhSach.status).toEqual({
      equals: CaseStatus.DANG_DIEU_TRA,
      notIn: expect.any(Array) as unknown,
    });
    expect(theSo.status).toEqual({
      notIn: (danhSach.status as { notIn: unknown }).notIn,
    });
    delete danhSach.status;
    delete theSo.status;
    expect(theSo).toEqual(danhSach);
  });

  it('nhóm trạng thái chỉ lọc danh sách, không lọc thẻ số', async () => {
    await service.getStats(
      { statusGroup: 'dang-dieu-tra', status: CaseStatus.TIEP_NHAN } as never,
      null,
    );
    expect(whereCua(mockPrisma.case.groupBy).status).toBeUndefined();
  });

  it('dungWhereDanhSach dùng được trực tiếp (đường xuất Excel) và trả kỳ đã áp', async () => {
    const { where, ky } = await service.dungWhereDanhSach(boLoc as never, null);
    expect(where.createdById).toBe('u-bui-thanh');
    expect(ky.ky).toBe('THANG_NAY');
  });
});
