// Mock seed-admin-units BEFORE import — runner is a thin invoker so we test orchestration.
jest.mock('./seed-admin-units', () => ({
  seedAdminUnits: jest.fn(),
  loadDataset: jest.fn(),
  CURRENT_VERSION: 'v2025-1300',
}));

import { runSeed } from './seed-admin-units-runner';
import { seedAdminUnits, loadDataset } from './seed-admin-units';

describe('seed-admin-units-runner — orchestration', () => {
  let prisma: any;
  const mockSeed = seedAdminUnits as jest.MockedFunction<typeof seedAdminUnits>;
  const mockLoad = loadDataset as jest.MockedFunction<typeof loadDataset>;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = {
      adminUnitDatasetImport: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      directory: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    mockSeed.mockResolvedValue({
      version: 'v2025-1300',
      skipped: false,
      addedProvinces: 34,
      addedWards: 3321,
      updatedWards: 0,
      abolishedWards: 0,
    });
    mockLoad.mockReturnValue({
      version: 'v2025-1300',
      legalBasis: '',
      effectiveFrom: '',
      downloadedAt: '',
      sourceUrl: '',
      sourceNote: '',
      provinces: [],
      wards: [],
    } as any);
  });

  describe('default flow (no flags)', () => {
    it('calls seedAdminUnits without touching ledger or directories', async () => {
      await runSeed({ prisma });
      expect(mockSeed).toHaveBeenCalledTimes(1);
      expect(mockSeed).toHaveBeenCalledWith(prisma);
      expect(prisma.adminUnitDatasetImport.updateMany).not.toHaveBeenCalled();
      expect(prisma.directory.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('--dry-run', () => {
    it('calls loadDataset to verify file + checksum, never invokes seedAdminUnits or any DB op', async () => {
      await runSeed({ prisma, dryRun: true });
      expect(mockLoad).toHaveBeenCalledTimes(1);
      expect(mockSeed).not.toHaveBeenCalled();
      expect(prisma.adminUnitDatasetImport.updateMany).not.toHaveBeenCalled();
      expect(prisma.directory.deleteMany).not.toHaveBeenCalled();
    });

    it('propagates loadDataset error (e.g., bad checksum) by rethrowing', async () => {
      mockLoad.mockImplementation(() => {
        throw new Error('Checksum mismatch');
      });
      await expect(runSeed({ prisma, dryRun: true })).rejects.toThrow('Checksum mismatch');
      expect(mockSeed).not.toHaveBeenCalled();
    });
  });

  describe('--force', () => {
    it('marks existing ACTIVE/IMPORTING ledger rows SUPERSEDED then calls seedAdminUnits', async () => {
      prisma.adminUnitDatasetImport.updateMany.mockResolvedValue({ count: 1 });
      const callOrder: string[] = [];
      prisma.adminUnitDatasetImport.updateMany.mockImplementation(async () => {
        callOrder.push('updateMany');
        return { count: 1 };
      });
      mockSeed.mockImplementation(async () => {
        callOrder.push('seed');
        return { version: 'v2025-1300', skipped: false, addedProvinces: 34, addedWards: 3321, updatedWards: 0, abolishedWards: 0 };
      });

      await runSeed({ prisma, force: true });

      expect(prisma.adminUnitDatasetImport.updateMany).toHaveBeenCalledWith({
        where: { status: { in: ['ACTIVE', 'IMPORTING'] } },
        data: { status: 'SUPERSEDED' },
      });
      expect(callOrder).toEqual(['updateMany', 'seed']);
      expect(prisma.directory.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('--clean-slate', () => {
    it('deletes all WARD+PROVINCE directories, supersedes ledger, then seeds (in that order)', async () => {
      const callOrder: string[] = [];
      prisma.directory.deleteMany.mockImplementation(async () => {
        callOrder.push('deleteMany');
        return { count: 10058 };
      });
      prisma.adminUnitDatasetImport.updateMany.mockImplementation(async () => {
        callOrder.push('updateMany');
        return { count: 0 };
      });
      mockSeed.mockImplementation(async () => {
        callOrder.push('seed');
        return { version: 'v2025-1300', skipped: false, addedProvinces: 34, addedWards: 3321, updatedWards: 0, abolishedWards: 0 };
      });

      await runSeed({ prisma, cleanSlate: true });

      expect(prisma.directory.deleteMany).toHaveBeenCalledWith({
        where: { type: { in: ['WARD', 'PROVINCE'] } },
      });
      expect(callOrder).toEqual(['deleteMany', 'updateMany', 'seed']);
    });

    it('clean-slate + force = same behavior (clean implies force)', async () => {
      await runSeed({ prisma, cleanSlate: true, force: true });
      expect(prisma.directory.deleteMany).toHaveBeenCalledTimes(1);
      expect(prisma.adminUnitDatasetImport.updateMany).toHaveBeenCalledTimes(1);
      expect(mockSeed).toHaveBeenCalledTimes(1);
    });
  });

  describe('return value', () => {
    it('returns SeedResult from seedAdminUnits on success', async () => {
      const result = await runSeed({ prisma });
      expect(result.result).toEqual({
        version: 'v2025-1300',
        skipped: false,
        addedProvinces: 34,
        addedWards: 3321,
        updatedWards: 0,
        abolishedWards: 0,
      });
    });

    it('returns dry-run marker when dryRun=true', async () => {
      const result = await runSeed({ prisma, dryRun: true });
      expect(result.dryRun).toBe(true);
      expect(result.result).toBeUndefined();
    });

    it('includes cleaned count when cleanSlate=true', async () => {
      prisma.directory.deleteMany.mockResolvedValue({ count: 10058 });
      const result = await runSeed({ prisma, cleanSlate: true });
      expect(result.cleaned).toBe(10058);
    });
  });
});
