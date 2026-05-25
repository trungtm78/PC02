import { resolveSource } from './source-resolver';
import type { ResolutionContext } from './types';

const mockPrisma = {
  case: { findUnique: jest.fn() },
  incident: { findUnique: jest.fn() },
  petition: { findUnique: jest.fn() },
  directory: { findUnique: jest.fn() },
  systemSetting: { findUnique: jest.fn() },
} as any;

const ctx: ResolutionContext = {
  userId: 'user-001',
  workId: 'CB-042',
  username: 'nguyen.van.a',
  departmentId: 'dept-001',
  caseId: 'case-001',
  incidentId: 'incident-001',
  petitionId: 'petition-001',
};

beforeEach(() => jest.clearAllMocks());

describe('resolveSource', () => {
  describe('NOW', () => {
    it('returns current Date instance', async () => {
      const before = Date.now();
      const result = await resolveSource('NOW', ctx, mockPrisma);
      const after = Date.now();
      expect(result).toBeInstanceOf(Date);
      expect((result as Date).getTime()).toBeGreaterThanOrEqual(before);
      expect((result as Date).getTime()).toBeLessThanOrEqual(after);
    });
  });

  describe('ctx:Login.*', () => {
    it('resolves ctx:Login.workId', async () => {
      expect(await resolveSource('ctx:Login.workId', ctx, mockPrisma)).toBe('CB-042');
    });

    it('resolves ctx:Login.username', async () => {
      expect(await resolveSource('ctx:Login.username', ctx, mockPrisma)).toBe(
        'nguyen.van.a',
      );
    });

    it('resolves ctx:Login.departmentId', async () => {
      expect(await resolveSource('ctx:Login.departmentId', ctx, mockPrisma)).toBe(
        'dept-001',
      );
    });

    it('resolves ctx:Login.id (maps to userId)', async () => {
      expect(await resolveSource('ctx:Login.id', ctx, mockPrisma)).toBe('user-001');
    });

    it('returns empty string for optional field not provided', async () => {
      const ctxNoWork: ResolutionContext = { userId: 'u1' };
      expect(await resolveSource('ctx:Login.workId', ctxNoWork, mockPrisma)).toBe('');
    });

    it('throws on unknown ctx field', async () => {
      await expect(
        resolveSource('ctx:Login.unknownField', ctx, mockPrisma),
      ).rejects.toThrow('Unknown ctx:Login field: unknownField');
    });
  });

  describe('lookup:', () => {
    it('lookup:cases.crime queries case table with caseId', async () => {
      mockPrisma.case.findUnique.mockResolvedValue({ crime: 'Trộm cắp' });
      const result = await resolveSource('lookup:cases.crime', ctx, mockPrisma);
      expect(result).toBe('Trộm cắp');
      expect(mockPrisma.case.findUnique).toHaveBeenCalledWith({
        where: { id: 'case-001' },
        select: { crime: true },
      });
    });

    it('lookup:incidents.incidentType queries incident table with incidentId', async () => {
      mockPrisma.incident.findUnique.mockResolvedValue({ incidentType: 'MA-001' });
      const result = await resolveSource(
        'lookup:incidents.incidentType',
        ctx,
        mockPrisma,
      );
      expect(result).toBe('MA-001');
    });

    it('lookup:petitions.petitionType queries petition table with petitionId', async () => {
      mockPrisma.petition.findUnique.mockResolvedValue({ petitionType: 'TO_CAO' });
      const result = await resolveSource(
        'lookup:petitions.petitionType',
        ctx,
        mockPrisma,
      );
      expect(result).toBe('TO_CAO');
    });

    it('lookup:directories.code queries directory table with departmentId', async () => {
      mockPrisma.directory.findUnique.mockResolvedValue({ code: 'T01' });
      const result = await resolveSource('lookup:directories.code', ctx, mockPrisma);
      expect(result).toBe('T01');
      expect(mockPrisma.directory.findUnique).toHaveBeenCalledWith({
        where: { id: 'dept-001' },
        select: { code: true },
      });
    });

    it('returns empty string when lookup record not found', async () => {
      mockPrisma.case.findUnique.mockResolvedValue(null);
      expect(await resolveSource('lookup:cases.crime', ctx, mockPrisma)).toBe('');
    });

    it('returns empty string when FK id missing from context', async () => {
      const ctxNoCaseId: ResolutionContext = { userId: 'u1' };
      expect(
        await resolveSource('lookup:cases.crime', ctxNoCaseId, mockPrisma),
      ).toBe('');
      expect(mockPrisma.case.findUnique).not.toHaveBeenCalled();
    });

    it('throws on unknown lookup table', async () => {
      await expect(
        resolveSource('lookup:users.email', ctx, mockPrisma),
      ).rejects.toThrow('Unknown lookup table: users');
    });
  });

  describe('setting:', () => {
    it('returns setting value from SystemSetting', async () => {
      mockPrisma.systemSetting.findUnique.mockResolvedValue({ value: 'PC02' });
      expect(await resolveSource('setting:UNIT_PREFIX', ctx, mockPrisma)).toBe('PC02');
      expect(mockPrisma.systemSetting.findUnique).toHaveBeenCalledWith({
        where: { key: 'UNIT_PREFIX' },
        select: { value: true },
      });
    });

    it('returns empty string when setting key not found', async () => {
      mockPrisma.systemSetting.findUnique.mockResolvedValue(null);
      expect(await resolveSource('setting:MISSING_KEY', ctx, mockPrisma)).toBe('');
    });
  });

  describe('unknown source type', () => {
    it('throws descriptive error', async () => {
      await expect(
        resolveSource('pgfn:some_func', ctx, mockPrisma),
      ).rejects.toThrow('Unknown source type: pgfn:some_func');
    });
  });
});
