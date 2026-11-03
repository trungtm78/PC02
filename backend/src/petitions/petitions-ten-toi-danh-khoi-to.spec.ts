import { CaseChildAccessService } from '../case-child-access/case-child-access.service';
import { ordinaryChildFixture } from '../case-child-access/test-child-access-fixture';
import { CaseEvidenceGovernanceService } from '../cases/evidence-governance/evidence-governance.service';
import { CaseSourceCreationService } from '../case-child-access/case-source-creation.service';
import { ordinarySourceFixture } from '../case-child-access/test-source-creation-fixture';
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PetitionsService } from './petitions.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SettingsService } from '../settings/settings.service';
import { DeadlineRulesService } from '../deadline-rules/deadline-rules.service';
import { DocumentNumbersService } from '../document-numbers/document-numbers.service';

/**
 * The prosecution-decision crime is stored as an ID inside `petitions.metadata`. The list column must show the crime
 * NAME, so the service resolves names in ONE lookup per page - and only when some row carries an ID.
 */
const mockPrisma = {
  petition: { count: jest.fn(), findMany: jest.fn() },
  crime: { findMany: jest.fn() },
};

const dong = (id: string, metadata: unknown) => ({
  id,
  stt: `2026-${id}`,
  metadata,
});

describe('PetitionsService.getList - prosecution crime name', () => {
  let service: PetitionsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.petition.count.mockResolvedValue(3);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: CaseChildAccessService,
          useValue: ordinaryChildFixture(mockPrisma),
        },
        {
          provide: CaseEvidenceGovernanceService,
          useValue: {
            assertDocumentCanChangeParent: jest
              .fn()
              .mockResolvedValue(undefined),
          },
        },
        {
          provide: CaseSourceCreationService,
          useValue: ordinarySourceFixture(mockPrisma),
        },
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

  it('resolves each ID to its name with a single lookup, deduplicating IDs', async () => {
    mockPrisma.petition.findMany.mockResolvedValue([
      dong('a', { toiDanhChinhKhoiToId: 'c1' }),
      dong('b', { toiDanhChinhKhoiToId: 'c1' }),
      dong('c', { toiDanhChinhKhoiToId: 'c2' }),
    ]);
    mockPrisma.crime.findMany.mockResolvedValue([
      { id: 'c1', name: 'Tội giết người' },
      { id: 'c2', name: 'Tội cướp tài sản' },
    ]);

    const ra = await service.getList({ limit: 20, offset: 0 } as never, null);

    expect(mockPrisma.crime.findMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.crime.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['c1', 'c2'] } },
      select: { id: true, name: true },
    });
    expect(
      (ra.data as Array<{ toiDanhChinhKhoiToTen: string | null }>).map(
        (d) => d.toiDanhChinhKhoiToTen,
      ),
    ).toEqual(['Tội giết người', 'Tội giết người', 'Tội cướp tài sản']);
  });

  it('does not query crimes when no row carries an ID (malformed metadata is ignored, not fatal)', async () => {
    mockPrisma.petition.findMany.mockResolvedValue([
      dong('a', null),
      dong('b', {}),
      dong('c', [1, 2]),
      dong('d', { toiDanhChinhKhoiToId: 42 }),
      dong('e', { toiDanhChinhKhoiToId: '' }),
    ]);

    const ra = await service.getList({ limit: 20, offset: 0 } as never, null);

    expect(mockPrisma.crime.findMany).not.toHaveBeenCalled();
    expect(
      (ra.data as Array<{ toiDanhChinhKhoiToTen: string | null }>).every(
        (d) => d.toiDanhChinhKhoiToTen === null,
      ),
    ).toBe(true);
  });

  it('an ID that matches no crime gives null - a blank cell, never the raw ID', async () => {
    mockPrisma.petition.findMany.mockResolvedValue([
      dong('a', { toiDanhChinhKhoiToId: 'deleted-crime' }),
    ]);
    mockPrisma.crime.findMany.mockResolvedValue([]);

    const ra = await service.getList({ limit: 20, offset: 0 } as never, null);

    expect(
      (ra.data as Array<{ toiDanhChinhKhoiToTen: string | null }>)[0]
        .toiDanhChinhKhoiToTen,
    ).toBeNull();
  });

  it('the list select returns every field a hidden column reads (a missing one renders blank without an error)', async () => {
    mockPrisma.petition.findMany.mockResolvedValue([]);
    await service.getList({ limit: 20, offset: 0 } as never, null);
    const select = (
      mockPrisma.petition.findMany.mock.calls[0] as [
        { select: Record<string, unknown> },
      ]
    )[0].select;
    for (const field of [
      'soPhieuChuyen',
      'nhanThay',
      'deXuat',
      'huongXuLy',
      'raSoatTrung',
      'baoCaoBanGiamDocText',
      'ghiChuKhac',
      'phuongThucThuDoan',
      'phanLoaiNguonTin',
      'laCongNgheCao',
      'dieuTraVien',
      'senderPhone',
      'senderBirthYear',
      'senderIdNumber',
      'senderIdIssuePlace',
      'senderAddress',
      'soQDPhanCongNguonTin',
      'ngayQDPhanCongNguonTin',
      'soQDTamDinhChiNguonTin',
      'ngayQDTamDinhChiNguonTin',
      'canCuTamDinhChiNguonTin',
      'soPhucHoiNguonTin',
      'ngayPhucHoiNguonTin',
      'thoiHanUTDT',
      'soTienBiThietHai',
      'soLuongBiHai',
      'crimeChinh',
      'metadata',
    ]) {
      expect(select).toHaveProperty(field);
    }
  });
});
