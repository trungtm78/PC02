import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IncidentStatus } from '@prisma/client';
import { IncidentsService } from './incidents.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SettingsService } from '../settings/settings.service';
import { DeadlineRulesService } from '../deadline-rules/deadline-rules.service';
import { DocumentNumbersService } from '../document-numbers/document-numbers.service';

/**
 * Một nguồn điều kiện lọc cho danh sách, thẻ số và xuất Excel của Vụ việc (18/09/2026) — cùng sửa gốc
 * với Đơn thư: `getList` và `getStats` từng dựng `where` ở HAI chỗ chép tay, chỉ cần một bên thêm bộ lọc
 * mà bên kia quên là thẻ số đứng yên khi bảng đổi. Nay cả hai đi qua `dungWhereDanhSach`; thẻ số chỉ bỏ
 * điều kiện trạng thái/giai đoạn (để các chip vẫn đếm mọi trạng thái).
 */
const mockPrisma = {
  incident: {
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    groupBy: jest.fn().mockResolvedValue([]),
  },
};

type Where = Record<string, unknown>;
const whereCua = (m: jest.Mock): Where =>
  (m.mock.calls[0] as [{ where: Where }])[0].where;

describe('IncidentsService — một nguồn điều kiện lọc cho danh sách, thẻ số, xuất', () => {
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
          useValue: { commitWithTx: jest.fn(), draft: jest.fn() },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();
    service = module.get(IncidentsService);
  });

  const boLoc = {
    canBoNhapId: 'u-bui-thanh',
    investigatorId: 'u-dtv',
    benVu: 'Nguyễn Văn A',
    reporter: '0909',
    loaiDonVu: 'TO_GIAC',
    tinhTrangHoSo: 'DANG_GIAI_QUYET',
    tinhTrangThoiHieu: 'CON_THOI_HIEU',
    stt: '26-9706',
    sttCu: '208',
    fromDateRange: '2026-01-01',
    toDateRange: '2026-12-31',
    overdue: true,
    wardTeamId: 'team-phuong',
  };

  it('thẻ số lọc theo Cán bộ nhập', async () => {
    await service.getStats(boLoc as never, null);
    expect(whereCua(mockPrisma.incident.groupBy).canBoNhapId).toBe(
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
      { ...boLoc, status: IncidentStatus.DANG_XAC_MINH } as never,
      null,
    );
    await service.getStats(boLoc as never, null);
    const danhSach = { ...whereCua(mockPrisma.incident.findMany) };
    const theSo = { ...whereCua(mockPrisma.incident.groupBy) };
    // Danh sách lọc thêm trạng thái đang chọn; thẻ số chỉ giữ phần "chưa kết thúc" của bộ lọc quá hạn.
    expect(danhSach.status).toEqual({
      equals: IncidentStatus.DANG_XAC_MINH,
      notIn: expect.any(Array) as unknown,
    });
    expect(theSo.status).toEqual({
      notIn: (danhSach.status as { notIn: unknown }).notIn,
    });
    delete danhSach.status;
    delete theSo.status;
    expect(theSo).toEqual(danhSach);
    jest.useRealTimers();
  });

  it('giai đoạn (phase) chỉ lọc danh sách, không lọc thẻ số', async () => {
    const { where: coTrangThai } = await service.dungWhereDanhSach(
      { phase: 'xac-minh' } as never,
      null,
    );
    const { where: boTrangThai } = await service.dungWhereDanhSach(
      { phase: 'xac-minh' } as never,
      null,
      { boTrangThai: true },
    );
    expect(coTrangThai.status).toEqual({ in: expect.any(Array) as unknown });
    expect(boTrangThai.status).toBeUndefined();
  });

  it('dungWhereDanhSach dùng được trực tiếp (đường xuất Excel) và trả kỳ đã áp', async () => {
    const { where, ky } = await service.dungWhereDanhSach(boLoc as never, null);
    expect(where.canBoNhapId).toBe('u-bui-thanh');
    expect(ky.ky).toBe('THANG_NAY');
  });
});
