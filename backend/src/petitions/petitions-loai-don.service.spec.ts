/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LoaiDon } from '@prisma/client';
import { PetitionsService } from './petitions.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SettingsService } from '../settings/settings.service';
import { DeadlineRulesService } from '../deadline-rules/deadline-rules.service';
import { DocumentNumbersService } from '../document-numbers/document-numbers.service';
import { QueryPetitionsDto } from './dto/query-petitions.dto';
import { QueryPetitionsStatsDto } from './dto/query-petitions-stats.dto';

const mockPrisma = {
  petition: {
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    groupBy: jest.fn().mockResolvedValue([]),
  },
  directory: { findMany: jest.fn().mockResolvedValue([]) },
  $queryRawUnsafe: jest.fn().mockResolvedValue([{ co: false }]),
};

/**
 * Màn Đơn thư phường/xã (17/09/2026) chuyển lọc xuống máy chủ: trước đó tải 100/47.352 đơn rồi lọc
 * "Loại đơn" tại chỗ. Danh sách và thẻ thống kê phải nhận CÙNG tham số `petitionType` (mã enum).
 */
describe('PetitionsService — lọc Loại đơn (màn Đơn thư phường/xã)', () => {
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

  it('danh sách lọc petitionType', async () => {
    await service.getList({ petitionType: LoaiDon.TO_CAO } as never, null);
    expect(
      mockPrisma.petition.findMany.mock.calls[0][0].where.petitionType,
    ).toBe(LoaiDon.TO_CAO);
  });

  it('danh sách trả TÊN tổ thụ lý (màn Chuyển đội đọc cột Đội hiện tại)', async () => {
    await service.getList({} as never, null);
    expect(
      mockPrisma.petition.findMany.mock.calls[0][0].select.assignedTeam,
    ).toEqual({
      select: { id: true, name: true, ward: { select: { name: true } } },
    });
  });

  it('thống kê lọc CÙNG petitionType', async () => {
    await service.getStats({ petitionType: LoaiDon.KHIEU_NAI } as never, null);
    expect(
      mockPrisma.petition.groupBy.mock.calls[0][0].where.petitionType,
    ).toBe(LoaiDon.KHIEU_NAI);
  });

  it('[rà mã P3] chiToPhuong: danh sách lẫn thống kê chỉ lấy tổ CÓ phường', async () => {
    await service.getList({ chiToPhuong: true } as never, null);
    expect(
      mockPrisma.petition.findMany.mock.calls[0][0].where.assignedTeam,
    ).toEqual({ is: { wardId: { not: null } } });
    await service.getStats({ chiToPhuong: true } as never, null);
    expect(
      mockPrisma.petition.groupBy.mock.calls[0][0].where.assignedTeam,
    ).toEqual({ is: { wardId: { not: null } } });
  });

  it('DTO: mã lạ → lỗi kiểm (400 trước khi tới Prisma); cả DTO thống kê cũng kiểm', async () => {
    const loi = async (
      cls: typeof QueryPetitionsDto | typeof QueryPetitionsStatsDto,
      v: string,
    ) =>
      (await validate(plainToInstance(cls, { petitionType: v }))).map(
        (e) => e.property,
      );
    expect(await loi(QueryPetitionsDto, 'to_cao')).toEqual(['petitionType']);
    expect(await loi(QueryPetitionsDto, 'TO_CAO')).toEqual([]);
    expect(await loi(QueryPetitionsStatsDto, 'x')).toEqual(['petitionType']);
    expect(BadRequestException).toBeDefined();
  });
});
