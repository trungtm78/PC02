/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/**
 * SettingsService Unit Tests
 *
 * getAll:
 *   - returns { success: true, data } array of all settings
 *
 * getValue:
 *   - fetches from Prisma and returns the matching value
 *   - returns null when key does not exist
 *
 * updateValue:
 *   - returns success: false when key does not exist
 *   - normalizes numeric string to parsed integer before storing
 *   - returns success: false for out-of-range numeric value
 */

import { Test, TestingModule } from '@nestjs/testing';
import { SettingsService } from './settings.service';
import { PrismaService } from '../prisma/prisma.service';

// ─── Mock Prisma ──────────────────────────────────────────────────────────────

const mockPrisma = {
  systemSetting: {
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn().mockResolvedValue(null),
    update: jest.fn(),
    upsert: jest.fn(),
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('SettingsService', () => {
  let service: SettingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SettingsService>(SettingsService);
    jest.clearAllMocks();
    mockPrisma.systemSetting.findMany.mockResolvedValue([]);
    mockPrisma.systemSetting.findUnique.mockResolvedValue(null);
  });

  // ── getAll ─────────────────────────────────────────────────────────────────

  describe('getAll', () => {
    it('returns { success: true, data } with all settings', async () => {
      mockPrisma.systemSetting.findMany.mockResolvedValue([
        makeSetting('THOI_HAN_XAC_MINH', '20'),
        makeSetting('THOI_HAN_TOI_DA', '140'),
      ]);

      const result = await service.getAll();

      expect(result).toHaveProperty('success', true);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].key).toBe('THOI_HAN_XAC_MINH');
    });

    it('returns empty data array when no settings exist', async () => {
      const result = await service.getAll();
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });
  });

  // ── getValue ───────────────────────────────────────────────────────────────

  describe('getValue', () => {
    it('returns the value string for an existing key', async () => {
      mockPrisma.systemSetting.findMany.mockResolvedValue([
        makeSetting('THOI_HAN_XAC_MINH', '20'),
      ]);

      const result = await service.getValue('THOI_HAN_XAC_MINH');

      expect(result).toBe('20');
    });

    it('returns null when the key does not exist', async () => {
      mockPrisma.systemSetting.findMany.mockResolvedValue([]);

      const result = await service.getValue('NONEXISTENT_KEY');

      expect(result).toBeNull();
    });
  });

  // ── updateValue ────────────────────────────────────────────────────────────

  describe('updateValue', () => {
    it('returns success: false with message when key does not exist', async () => {
      mockPrisma.systemSetting.findUnique.mockResolvedValue(null);

      const result = await service.updateValue('MISSING_KEY', '10');

      expect(result.success).toBe(false);
      expect(result).toHaveProperty('message');
    });

    it('calls prisma.update and returns success: true on valid update', async () => {
      const existing = makeSetting('THOI_HAN_XAC_MINH', '20', 'ngày');
      const updated = makeSetting('THOI_HAN_XAC_MINH', '30', 'ngày');
      mockPrisma.systemSetting.findUnique.mockResolvedValue(existing);
      mockPrisma.systemSetting.update.mockResolvedValue(updated);

      const result = await service.updateValue('THOI_HAN_XAC_MINH', '30');

      expect(result.success).toBe(true);
      expect(mockPrisma.systemSetting.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { key: 'THOI_HAN_XAC_MINH' },
          data: { value: '30' },
        }),
      );
    });

    it('normalizes float string to parsed integer (e.g. "3.7" → stored as "3")', async () => {
      const existing = makeSetting('THOI_HAN_XAC_MINH', '20', 'ngày');
      mockPrisma.systemSetting.findUnique.mockResolvedValue(existing);
      mockPrisma.systemSetting.update.mockResolvedValue({ ...existing, value: '3' });

      await service.updateValue('THOI_HAN_XAC_MINH', '3.7');

      const updateCall = mockPrisma.systemSetting.update.mock.calls[0][0];
      expect(updateCall.data.value).toBe('3');
    });

    it('returns success: false for out-of-range value (> 365)', async () => {
      const existing = makeSetting('THOI_HAN_XAC_MINH', '20', 'ngày');
      mockPrisma.systemSetting.findUnique.mockResolvedValue(existing);

      const result = await service.updateValue('THOI_HAN_XAC_MINH', '999');

      expect(result.success).toBe(false);
      expect(mockPrisma.systemSetting.update).not.toHaveBeenCalled();
    });
  });
});
