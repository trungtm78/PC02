/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { QueryDuplicatesDto } from './dto/query-duplicates.dto';
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PetitionStatus } from '@prisma/client';
import { PetitionsService } from './petitions.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SettingsService } from '../settings/settings.service';
import { DeadlineRulesService } from '../deadline-rules/deadline-rules.service';
import { DocumentNumbersService } from '../document-numbers/document-numbers.service';

const mockPrisma = {
  petition: {
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
 * Màn Đơn trùng (18/09/2026) có nguồn dữ liệu THẬT. Trước đó màn tải `limit=100` đơn bất kỳ rồi hiện
 * chúng như "đơn trùng": cột "Tiêu chí trùng" và "Hồ sơ gốc" luôn rỗng, còn logic tìm trùng thật chỉ
 * nằm trong đường xuất Excel.
 *
 * Gom nhóm theo cột CHUẨN HOÁ (giữ dấu thanh) do CSDL sinh: đo prod 17/09 trên 47.352 đơn — so nguyên
 * văn 7.579 nhóm/28.950 đơn, chuẩn hoá 7.571/29.788 (gộp đúng "Toà án"/"Tòa án"), bỏ dấu thì gộp nhầm
 * "Hồ Vĩnh Thanh" với "Hồ Vĩnh Thạnh". Nhóm "nặc danh" (183 đơn) bị loại vì không phải người trùng.
 */
describe('PetitionsService.listDuplicates — nhóm đơn trùng thật', () => {
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
              ky: 'TAT_CA',
              truong: 'NGAY_TIEP_NHAN',
              tuNgay: null,
              denNgay: null,
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

  const nhom = (giaTri: string, n: number) => ({
    senderNameChuan: giaTri,
    _count: { _all: n },
  });

  it('gom theo cột CHUẨN HOÁ, chỉ lấy nhóm từ 2 đơn, loại nhóm "nặc danh"', async () => {
    mockPrisma.petition.groupBy.mockResolvedValue([nhom('lê thị nhâm', 3)]);
    await service.listDuplicates({} as never, null);
    const goi = mockPrisma.petition.groupBy.mock.calls[0][0];
    expect(goi.by).toEqual(['senderNameChuan']);
    expect(goi.having).toEqual({ senderNameChuan: { _count: { gt: 1 } } });
    expect(goi.where.senderNameChuan).toEqual({ notIn: ['', 'nặc danh'] });
  });

  it('mỗi nhóm trả giá trị gom, số đơn và ĐƠN GỐC = đơn có ngày đề xuất sớm nhất', async () => {
    mockPrisma.petition.groupBy.mockResolvedValue([nhom('lê thị nhâm', 2)]);
    mockPrisma.petition.findMany.mockResolvedValue([
      {
        id: 'p2',
        stt: '2026-20',
        senderName: 'Lê Thị Nhâm',
        senderNameChuan: 'lê thị nhâm',
        ngayDeXuat: new Date('2026-03-01T00:00:00Z'),
        status: PetitionStatus.DANG_XU_LY,
      },
      {
        id: 'p1',
        stt: '2026-1',
        senderName: 'Lê thị Nhâm',
        senderNameChuan: 'lê thị nhâm',
        ngayDeXuat: new Date('2026-01-01T00:00:00Z'),
        status: PetitionStatus.MOI_TIEP_NHAN,
      },
    ]);
    const kq = await service.listDuplicates({} as never, null);
    expect(kq.data).toHaveLength(1);
    expect(kq.ky.ky).toBe('TAT_CA'); // màn hiện nhãn kỳ đang áp
    expect(kq.data[0].giaTri).toBe('lê thị nhâm');
    expect(kq.data[0].soDon).toBe(2);
    expect(kq.data[0].goc?.id).toBe('p1');
    expect(kq.data[0].dons.map((d) => d.id)).toEqual(['p1', 'p2']);
  });

  it('tiêu chí khác đổi đúng cột gom; tiêu chí lạ → 400', async () => {
    mockPrisma.petition.groupBy.mockResolvedValue([]);
    await service.listDuplicates({ criteria: 'senderPhone' } as never, null);
    expect(mockPrisma.petition.groupBy.mock.calls[0][0].by).toEqual([
      'senderPhoneChuan',
    ]);
    await expect(
      service.listDuplicates({ criteria: 'khongCo' } as never, null),
    ).rejects.toThrow(BadRequestException);
  });

  it('áp phạm vi dữ liệu, trạng thái, ngày và thẻ tìm — cả bước gom lẫn bước lấy đơn', async () => {
    mockPrisma.petition.groupBy.mockResolvedValue([nhom('lê thị nhâm', 2)]);
    mockPrisma.petition.findMany.mockResolvedValue([]);
    await service.listDuplicates(
      {
        status: PetitionStatus.MOI_TIEP_NHAN,
        fromDate: '2026-01-01',
        tk: ['nguoiGui~le thi'],
      } as never,
      PHAM_VI as never,
    );
    const gom = mockPrisma.petition.groupBy.mock.calls[0][0].where;
    const lay = mockPrisma.petition.findMany.mock.calls[0][0].where;
    for (const w of [gom, lay]) {
      expect(w.status).toBe(PetitionStatus.MOI_TIEP_NHAN);
      expect(w.ngayDeXuat.gte).toEqual(new Date('2026-01-01T00:00:00'));
      const chuoi = JSON.stringify(w.AND);
      expect(chuoi).toContain('senderNameBd');
      expect(chuoi).toContain('u1');
    }
    // Mặc định lấy theo TỪNG nhóm (mỗi nhóm một truy vấn có trần) nên điều kiện là giá trị nhóm.
    expect(lay.senderNameChuan).toBe('lê thị nhâm');
  });

  it('[rà mã P3] mỗi nhóm chỉ lấy tối đa 20 đơn — trang 1 gom nhóm lớn nhất, lấy hết là vài nghìn đơn/1,9 MB', async () => {
    mockPrisma.petition.groupBy.mockResolvedValue([nhom('a', 569)]);
    mockPrisma.petition.findMany.mockResolvedValue([]);
    await service.listDuplicates({} as never, null);
    for (const [a] of mockPrisma.petition.findMany.mock.calls) {
      expect(a.take).toBe(20);
    }
  });

  it('[rà mã P3] tuỳ chọn lấy HẾT đơn mỗi nhóm (đường xuất Excel) thì không đặt trần', async () => {
    mockPrisma.petition.groupBy.mockResolvedValue([nhom('a', 569)]);
    mockPrisma.petition.findMany.mockResolvedValue([]);
    await service.listDuplicates({} as never, null, { soDonMoiNhom: null });
    for (const [a] of mockPrisma.petition.findMany.mock.calls) {
      expect(a.take).toBeUndefined();
    }
  });

  it('phân trang theo NHÓM: tổng là số nhóm, không phải số đơn', async () => {
    mockPrisma.petition.groupBy.mockResolvedValue([
      nhom('a', 5),
      nhom('b', 4),
      nhom('c', 2),
    ]);
    mockPrisma.petition.findMany.mockResolvedValue([]);
    const kq = await service.listDuplicates(
      { limit: 2, offset: 2 } as never,
      null,
    );
    expect(kq.total).toBe(3);
    expect(kq.data.map((n) => n.giaTri)).toEqual(['c']);
  });
});

describe('PetitionsService.exportDuplicates — tệp xuất dùng CHUNG nguồn với màn', () => {
  it('gọi listDuplicates ĐÚNG MỘT lượt, lấy mọi nhóm và trọn đơn (rà mã P2)', async () => {
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
              ky: 'TAT_CA',
              truong: 'NGAY_TIEP_NHAN',
              tuNgay: null,
              denNgay: null,
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
    const svc = module.get(PetitionsService);
    const goi = jest
      .spyOn(svc, 'listDuplicates')
      .mockResolvedValueOnce({
        criteria: 'senderPhone',
        total: 1,
        data: [
          {
            giaTri: '0903123456',
            soDon: 2,
            goc: {
              id: 'p1',
              stt: '2026-1',
              senderName: 'A',
              ngayDeXuat: null,
              status: PetitionStatus.MOI_TIEP_NHAN,
            },
            dons: [
              {
                id: 'p1',
                stt: '2026-1',
                senderName: 'A',
                ngayDeXuat: null,
                status: PetitionStatus.MOI_TIEP_NHAN,
              },
              {
                id: 'p2',
                stt: '2026-2',
                senderName: 'B',
                ngayDeXuat: null,
                status: PetitionStatus.MOI_TIEP_NHAN,
              },
            ],
          },
        ],
      } as never)
      .mockResolvedValue({
        criteria: 'senderPhone',
        total: 1,
        data: [],
      } as never);
    const res = {
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
    };
    await svc.exportDuplicates(
      { criteria: 'senderPhone' } as never,
      null,
      res as never,
    );
    // [rà mã P2] MỘT lượt: gọi theo trang thì 7.500 nhóm = ~150 lần tính lại phép gom (~40-60 giây).
    expect(goi).toHaveBeenCalledTimes(1);
    expect(goi.mock.calls[0][2]).toEqual({
      tatCaNhom: true,
      soDonMoiNhom: null,
    });
    expect(goi.mock.calls[0][0]).toEqual(
      expect.objectContaining({ criteria: 'senderPhone' }),
    );
  });
});

describe('QueryDuplicatesDto — nhận cả nhãn tiếng Việt cũ (rà mã P3)', () => {
  it.each([
    ['Họ tên', 'senderName'],
    ['Số điện thoại', 'senderPhone'],
    ['Địa chỉ', 'senderAddress'],
    ['Bị đơn trùng', 'suspectedPerson'],
    ['senderName', 'senderName'],
  ])('criteria=%s → %s', async (vao, ra) => {
    const dto = plainToInstance(QueryDuplicatesDto, { criteria: vao });
    expect(dto.criteria).toBe(ra);
    expect((await validate(dto)).map((e) => e.property)).toEqual([]);
  });

  it('mã lạ vẫn 400 ở cổng', async () => {
    const dto = plainToInstance(QueryDuplicatesDto, { criteria: 'khongCo' });
    expect((await validate(dto)).map((e) => e.property)).toEqual(['criteria']);
  });
});
