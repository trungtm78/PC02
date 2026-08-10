/**
 * SettingsService Unit Tests
 *
 * Coverage:
 *   - getAll returns all rows
 *   - getValue returns value for non-deadline keys; null when missing
 *   - getNumericValue returns parsed integer; uses fallback when missing
 *   - HARD-GUARD: all read/write methods THROW BadRequest for the 12 deadline
 *     rule keys (post-20260511_deadline_rule_versioning migration; the
 *     authoritative source is DeadlineRulesService)
 *   - updateValue normalizes numeric strings, range-validates 0..365
 *   - seed inserts only non-deadline ops keys AND deletes any stray deadline keys
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  systemSetting: {
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn().mockResolvedValue(null),
    update: jest.fn(),
    upsert: jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
};

function makeSetting(key: string, value: string, unit: string | null = 'ngày') {
  return {
    id: `setting-${key}`,
    key,
    value,
    label: `Label for ${key}`,
    unit,
    legalBasis: null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { AuditService } = require('../audit/audit.service');

describe('SettingsService', () => {
  let service: SettingsService;
  const mockAudit = {
    log: jest.fn().mockResolvedValue(undefined),
    wrapUpdate: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();
    service = module.get(SettingsService);
    jest.clearAllMocks();
    mockPrisma.systemSetting.findMany.mockResolvedValue([]);
    mockPrisma.systemSetting.findUnique.mockResolvedValue(null);
    mockPrisma.systemSetting.upsert.mockResolvedValue({});
    mockPrisma.systemSetting.deleteMany.mockResolvedValue({ count: 0 });
  });

  describe('getAll', () => {
    it('returns all settings', async () => {
      mockPrisma.systemSetting.findMany.mockResolvedValue([
        makeSetting('TWO_FA_ENABLED', 'false', null),
      ]);
      const result = await service.getAll();
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });
  });

  describe('getValue (non-deadline keys)', () => {
    it('returns the value for an ops key', async () => {
      mockPrisma.systemSetting.findMany.mockResolvedValue([
        makeSetting('TWO_FA_ENABLED', 'true', null),
      ]);
      expect(await service.getValue('TWO_FA_ENABLED')).toBe('true');
    });

    it('returns null when key missing', async () => {
      expect(await service.getValue('UNKNOWN_OPS_KEY')).toBeNull();
    });
  });

  describe('hard-guard for the 12 deadline keys', () => {
    const deadlineKeys = [
      'THOI_HAN_XAC_MINH',
      'THOI_HAN_GIA_HAN_1',
      'THOI_HAN_GIA_HAN_2',
      'THOI_HAN_TOI_DA',
      'THOI_HAN_PHUC_HOI',
      'THOI_HAN_PHAN_LOAI',
      'SO_LAN_GIA_HAN_TOI_DA',
      'THOI_HAN_GUI_QD_VKS',
      'THOI_HAN_TO_CAO',
      'THOI_HAN_KHIEU_NAI',
      'THOI_HAN_KIEN_NGHI',
      'THOI_HAN_PHAN_ANH',
    ];

    it.each(deadlineKeys)('getValue throws BadRequest for %s', async (key) => {
      await expect(service.getValue(key)).rejects.toThrow(BadRequestException);
    });

    it.each(deadlineKeys)(
      'getNumericValue throws BadRequest for %s',
      async (key) => {
        await expect(service.getNumericValue(key, 20)).rejects.toThrow(
          BadRequestException,
        );
      },
    );

    it.each(deadlineKeys)(
      'updateValue throws BadRequest for %s',
      async (key) => {
        await expect(service.updateValue(key, '25')).rejects.toThrow(
          BadRequestException,
        );
      },
    );

    it('error message hints at the correct migration', async () => {
      try {
        await service.getValue('THOI_HAN_XAC_MINH');
      } catch (e) {
        expect((e as Error).message).toContain('DeadlineRulesService');
      }
    });
  });

  describe('updateValue (non-deadline keys)', () => {
    it('returns success: false when key not found', async () => {
      mockPrisma.systemSetting.findUnique.mockResolvedValue(null);
      const result = await service.updateValue('UNKNOWN_OPS', '10');
      expect(result.success).toBe(false);
    });

    it('updates and normalizes numeric value for unit=ngày', async () => {
      const existing = makeSetting('CANH_BAO_SAP_HAN', '7', 'ngày');
      mockPrisma.systemSetting.findUnique.mockResolvedValue(existing);
      mockPrisma.systemSetting.update.mockResolvedValue({
        ...existing,
        value: '10',
      });

      const result = await service.updateValue('CANH_BAO_SAP_HAN', '10');
      expect(result.success).toBe(true);
      expect(mockPrisma.systemSetting.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { value: '10' } }),
      );
    });

    it('normalizes float to int (3.7 → 3)', async () => {
      const existing = makeSetting('CANH_BAO_SAP_HAN', '7', 'ngày');
      mockPrisma.systemSetting.findUnique.mockResolvedValue(existing);
      mockPrisma.systemSetting.update.mockResolvedValue({
        ...existing,
        value: '3',
      });
      await service.updateValue('CANH_BAO_SAP_HAN', '3.7');
      expect(mockPrisma.systemSetting.update.mock.calls[0][0].data.value).toBe(
        '3',
      );
    });

    it('rejects values out of range (>365)', async () => {
      mockPrisma.systemSetting.findUnique.mockResolvedValue(
        makeSetting('CANH_BAO_SAP_HAN', '7', 'ngày'),
      );
      const result = await service.updateValue('CANH_BAO_SAP_HAN', '999');
      expect(result.success).toBe(false);
      expect(mockPrisma.systemSetting.update).not.toHaveBeenCalled();
    });

    // `giờ` was not in the validated set at all, so hour settings took any
    // string. Applying the 365 ceiling to them would have been worse than
    // nothing: THOI_HAN_EDIT_VU_VAN defaults to 168h and its legal basis is
    // BLTTHS Đ.147 (20 days = 480h), so 365 would silently cut the window
    // below what the law allows.
    it('accepts 480 hours — BLTTHS Đ.147 is 20 days, which a 365 ceiling would cut', async () => {
      const existing = makeSetting('THOI_HAN_EDIT_VU_VAN', '168', 'giờ');
      mockPrisma.systemSetting.findUnique.mockResolvedValue(existing);
      mockPrisma.systemSetting.update.mockResolvedValue({
        ...existing,
        value: '480',
      });

      const result = await service.updateValue('THOI_HAN_EDIT_VU_VAN', '480');

      expect(result.success).toBe(true);
    });

    it('still bounds hours — 99999 is rejected', async () => {
      mockPrisma.systemSetting.findUnique.mockResolvedValue(
        makeSetting('THOI_HAN_EDIT_VU_VAN', '168', 'giờ'),
      );

      const result = await service.updateValue('THOI_HAN_EDIT_VU_VAN', '99999');

      expect(result.success).toBe(false);
      expect(mockPrisma.systemSetting.update).not.toHaveBeenCalled();
    });

    it('rejects a non-numeric value for an hour setting', async () => {
      mockPrisma.systemSetting.findUnique.mockResolvedValue(
        makeSetting('THOI_HAN_EDIT_VU_VAN', '168', 'giờ'),
      );

      const result = await service.updateValue('THOI_HAN_EDIT_VU_VAN', 'sớm');

      expect(result.success).toBe(false);
    });

    it('names the unit in the error, so 8760 does not read as an arbitrary number', async () => {
      mockPrisma.systemSetting.findUnique.mockResolvedValue(
        makeSetting('THOI_HAN_EDIT_VU_VAN', '168', 'giờ'),
      );

      const result = await service.updateValue('THOI_HAN_EDIT_VU_VAN', '99999');

      expect(result.message).toContain('giờ');
      expect(result.message).toContain('8760');
    });

    it('leaves a non-numeric unit alone rather than guessing a ceiling', async () => {
      const existing = makeSetting('MOT_CAI_GI_DO', 'abc', 'văn bản');
      mockPrisma.systemSetting.findUnique.mockResolvedValue(existing);
      mockPrisma.systemSetting.update.mockResolvedValue({
        ...existing,
        value: 'xyz',
      });

      const result = await service.updateValue('MOT_CAI_GI_DO', 'xyz');

      expect(result.success).toBe(true);
    });
  });

  describe('seed', () => {
    it('upserts ops keys only and deletes stray deadline keys', async () => {
      await service.seed();
      expect(mockPrisma.systemSetting.upsert).toHaveBeenCalled();
      expect(mockPrisma.systemSetting.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ key: expect.any(Object) }),
        }),
      );
    });

    it('seeds exactly the 4 ops settings (incl. THOI_HAN_XOA_VU_AN v0.31.0.2)', async () => {
      await service.seed();
      const upsertCalls = mockPrisma.systemSetting.upsert.mock.calls.map(
        (c) => c[0].where.key,
      );
      expect(upsertCalls).toContain('TWO_FA_ENABLED');
      expect(upsertCalls).toContain('CANH_BAO_SAP_HAN');
      expect(upsertCalls).toContain('THOI_HAN_XOA_VU_VIEC');
      expect(upsertCalls).toContain('THOI_HAN_XOA_VU_AN');
      expect(upsertCalls).toContain('THOI_HAN_EDIT_VU_VAN');
      expect(upsertCalls).not.toContain('THOI_HAN_XAC_MINH');
    });
  });

  describe('getDeadlines (deprecated)', () => {
    it('returns deprecation hint', async () => {
      const result = await service.getDeadlines();
      expect(result.success).toBe(false);
      expect(result.message).toContain('/api/v1/deadline-rules');
    });
  });
});
