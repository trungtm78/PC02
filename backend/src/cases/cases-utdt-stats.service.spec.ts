/**
 * Cases UTDT stats endpoint tests (F2).
 *
 * GET /api/v1/cases/utdt-stats — 4 parallel counts grouped by computed
 * TrangThaiPhanHoi state. Mirrors pattern of /cases/stats + /incidents/stats +
 * /petitions/stats but adapts for computed (not stored) grouping field.
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CasesService } from './cases.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SettingsService } from '../settings/settings.service';
import { DocumentNumbersService } from '../document-numbers/document-numbers.service';

const mockPrisma = {
  case: {
    count: jest.fn(),
  },
};

describe('CasesService.getUtdtStats — UTDT chip count aggregation (F2)', () => {
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
            // Kỳ TAT_CA để các ca sẵn có chốt đúng thứ chúng chốt, không có điều kiện ngày
            // chen vào. Việc kỳ được áp có ca kiểm riêng.
            getKyThongKe: jest.fn().mockResolvedValue({
              ky: 'TAT_CA',
              truong: 'NGAY_TIEP_NHAN',
              tuNgay: null,
              denNgay: null,
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

  it('returns { total, byTrangThai } với exhaustive 4-state keys', async () => {
    // 4 parallel counts in state order: DA_PHAN_HOI, KHONG_THUC_HIEN_DUOC, QUA_HAN, CHUA_PHAN_HOI
    mockPrisma.case.count
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(12);

    const result = await service.getUtdtStats({}, null);

    expect(result.total).toBe(20);
    expect(result.byTrangThai.DA_PHAN_HOI).toBe(5);
    expect(result.byTrangThai.KHONG_THUC_HIEN_DUOC).toBe(2);
    expect(result.byTrangThai.QUA_HAN).toBe(1);
    expect(result.byTrangThai.CHUA_PHAN_HOI).toBe(12);
  });

  it('total derived from sum of 4 counts (snapshot consistent)', async () => {
    mockPrisma.case.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(7);

    const result = await service.getUtdtStats({}, null);
    expect(result.total).toBe(10);
  });

  it('forces caseType=UY_THAC_DIEU_TRA on all 4 queries', async () => {
    mockPrisma.case.count.mockResolvedValue(0);
    await service.getUtdtStats({}, null);
    expect(mockPrisma.case.count).toHaveBeenCalledTimes(4);
    for (let i = 0; i < 4; i++) {
      const callArg = mockPrisma.case.count.mock.calls[i][0];
      expect(callArg.where.caseType).toBe('UY_THAC_DIEU_TRA');
      expect(callArg.where.deletedAt).toBeNull();
    }
  });

  it('search filter pass-through (includes UTDT-specific fields)', async () => {
    mockPrisma.case.count.mockResolvedValue(0);
    await service.getUtdtStats({ search: 'PC01' }, null);
    const callArg = mockPrisma.case.count.mock.calls[0][0];
    expect(callArg.where.OR).toBeDefined();
    expect(Array.isArray(callArg.where.OR)).toBe(true);
    const fields = (callArg.where.OR as any[]).map((o) => Object.keys(o)[0]);
    expect(fields).toContain('donViGiao');
    expect(fields).toContain('soQuyetDinhUyThac');
  });

  it('donViGiao + loaiUyThac + ngayTiepNhanFrom filters pass-through', async () => {
    mockPrisma.case.count.mockResolvedValue(0);
    await service.getUtdtStats(
      { donViGiao: 'PC01', loaiUyThac: 'UY_THAC_DIEU_TRA' as any, ngayTiepNhanFrom: '2026-01-01' },
      null,
    );
    const callArg = mockPrisma.case.count.mock.calls[0][0];
    expect(callArg.where.donViGiao).toEqual({ contains: 'PC01', mode: 'insensitive' });
    expect(callArg.where.loaiUyThac).toBe('UY_THAC_DIEU_TRA');
    expect(callArg.where.ngayTiepNhan).toBeDefined();
  });

  it('applies DataScope filter to where.AND when dataScope non-null', async () => {
    mockPrisma.case.count.mockResolvedValue(0);
    await service.getUtdtStats(
      {},
      { userIds: ['user-001'], teamIds: ['team-a'], writableTeamIds: [] },
    );
    const callArg = mockPrisma.case.count.mock.calls[0][0];
    expect(callArg.where.AND).toBeDefined();
    expect(Array.isArray(callArg.where.AND)).toBe(true);
  });

  it('each state query merges baseWhere + buildTrangThaiFilter (no clobber)', async () => {
    mockPrisma.case.count.mockResolvedValue(0);
    await service.getUtdtStats({}, null);
    // 4 calls, each with where.AND containing state-specific predicate
    for (let i = 0; i < 4; i++) {
      const callArg = mockPrisma.case.count.mock.calls[i][0];
      expect(callArg.where.AND).toBeDefined();
      expect(Array.isArray(callArg.where.AND)).toBe(true);
    }
  });

  it('zero results — all counts 0', async () => {
    mockPrisma.case.count.mockResolvedValue(0);
    const result = await service.getUtdtStats({}, null);
    expect(result.total).toBe(0);
    expect(result.byTrangThai.DA_PHAN_HOI).toBe(0);
    expect(result.byTrangThai.CHUA_PHAN_HOI).toBe(0);
  });
});
