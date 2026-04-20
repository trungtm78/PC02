import { Test, TestingModule } from '@nestjs/testing';
import { FeatureFlagsService } from './feature-flags.service';
import { PrismaService } from '../prisma/prisma.service';
import { FEATURE_REGISTRY } from './feature-registry';

type FlagRow = {
  key: string;
  label: string;
  description: string | null;
  enabled: boolean;
  domain: string | null;
  rolloutPct: number;
};

const row = (overrides: Partial<FlagRow> = {}): FlagRow => ({
  key: 'cases',
  label: 'Quản lý vụ án',
  description: null,
  enabled: true,
  domain: null,
  rolloutPct: 100,
  ...overrides,
});

describe('FeatureFlagsService', () => {
  let service: FeatureFlagsService;
  let prisma: { featureFlag: { findMany: jest.Mock; update: jest.Mock } };
  const originalEnv = process.env['ENABLED_FEATURES'];

  afterEach(() => {
    if (originalEnv === undefined) delete process.env['ENABLED_FEATURES'];
    else process.env['ENABLED_FEATURES'] = originalEnv;
  });

  const build = async () => {
    prisma = {
      featureFlag: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
      },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureFlagsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(FeatureFlagsService);
  };

  describe('isEnabled', () => {
    it('returns true when DB says enabled', async () => {
      delete process.env['ENABLED_FEATURES'];
      await build();
      prisma.featureFlag.findMany.mockResolvedValue([row({ enabled: true })]);
      expect(await service.isEnabled('cases')).toBe(true);
    });

    it('returns false when DB says disabled', async () => {
      delete process.env['ENABLED_FEATURES'];
      await build();
      prisma.featureFlag.findMany.mockResolvedValue([row({ enabled: false })]);
      expect(await service.isEnabled('cases')).toBe(false);
    });

    it('default-allows unseeded flags', async () => {
      delete process.env['ENABLED_FEATURES'];
      await build();
      prisma.featureFlag.findMany.mockResolvedValue([]);
      expect(await service.isEnabled('brand-new-feature')).toBe(true);
    });

    it('respects build whitelist: allowed keys pass', async () => {
      process.env['ENABLED_FEATURES'] = 'cases,petitions';
      await build();
      prisma.featureFlag.findMany.mockResolvedValue([row({ key: 'cases' })]);
      expect(await service.isEnabled('cases')).toBe(true);
    });

    it('respects build whitelist: keys outside whitelist are always false', async () => {
      process.env['ENABLED_FEATURES'] = 'cases';
      await build();
      prisma.featureFlag.findMany.mockResolvedValue([
        row({ key: 'petitions', enabled: true }),
      ]);
      expect(await service.isEnabled('petitions')).toBe(false);
    });

    it('whitelist beats DB enabled=true', async () => {
      process.env['ENABLED_FEATURES'] = 'cases';
      await build();
      prisma.featureFlag.findMany.mockResolvedValue([
        row({ key: 'reports', enabled: true }),
      ]);
      expect(await service.isEnabled('reports')).toBe(false);
    });

    it('caches DB reads across many calls', async () => {
      delete process.env['ENABLED_FEATURES'];
      await build();
      prisma.featureFlag.findMany.mockResolvedValue([row()]);
      await service.isEnabled('cases');
      await service.isEnabled('cases');
      await service.isEnabled('cases');
      expect(prisma.featureFlag.findMany).toHaveBeenCalledTimes(1);
    });

    it('dedupes concurrent refreshes into a single DB call (thundering herd)', async () => {
      delete process.env['ENABLED_FEATURES'];
      await build();
      let resolveFn: ((val: FlagRow[]) => void) | null = null;
      prisma.featureFlag.findMany.mockImplementation(
        () =>
          new Promise<FlagRow[]>((resolve) => {
            resolveFn = resolve;
          }),
      );
      // Fire 5 concurrent calls — only one DB query should fly.
      const promises = [
        service.isEnabled('cases'),
        service.isEnabled('cases'),
        service.isEnabled('cases'),
        service.isEnabled('cases'),
        service.isEnabled('cases'),
      ];
      // Let the in-flight promise be set
      await new Promise((r) => setImmediate(r));
      resolveFn!([row()]);
      await Promise.all(promises);
      expect(prisma.featureFlag.findMany).toHaveBeenCalledTimes(1);
    });

    it('serves stale cache when refresh fails post-boot', async () => {
      delete process.env['ENABLED_FEATURES'];
      await build();
      // First refresh succeeds
      prisma.featureFlag.findMany.mockResolvedValueOnce([
        row({ enabled: true }),
      ]);
      expect(await service.isEnabled('cases')).toBe(true);
      // Force next ensureFresh to refresh
      service._resetCacheForTests();
      // Second refresh: simulate DB down; but because _reset also wiped cache,
      // let's test the real-world case: cache populated, then TTL expires, then DB fails.
      prisma.featureFlag.findMany.mockResolvedValueOnce([
        row({ enabled: true }),
      ]);
      await service.isEnabled('cases'); // rebuilds cache
      // Now expire TTL by advancing state, next refresh fails
      (service as unknown as { cacheExpiresAt: number }).cacheExpiresAt = 0;
      prisma.featureFlag.findMany.mockRejectedValueOnce(
        new Error('db blip'),
      );
      // Should NOT throw — stale cache served
      expect(await service.isEnabled('cases')).toBe(true);
    });

    it('backs off after a failed refresh to avoid hot-looping the DB', async () => {
      delete process.env['ENABLED_FEATURES'];
      await build();
      // Populate cache once so we have something stale to serve
      prisma.featureFlag.findMany.mockResolvedValueOnce([row()]);
      await service.isEnabled('cases');
      // Expire TTL
      (service as unknown as { cacheExpiresAt: number }).cacheExpiresAt = 0;
      // Next refresh fails
      prisma.featureFlag.findMany.mockRejectedValueOnce(new Error('down'));
      await service.isEnabled('cases');
      // DB should have been called exactly twice (populate + failed retry)
      expect(prisma.featureFlag.findMany).toHaveBeenCalledTimes(2);
      // A third call should NOT re-hit DB because we're inside the backoff window
      prisma.featureFlag.findMany.mockResolvedValueOnce([row()]);
      await service.isEnabled('cases');
      expect(prisma.featureFlag.findMany).toHaveBeenCalledTimes(2);
    });
  });

  describe('listAll', () => {
    it('merges FEATURE_REGISTRY with DB rows, default-allow for unseeded', async () => {
      delete process.env['ENABLED_FEATURES'];
      await build();
      // DB has only 1 row; all other registered features should still appear
      prisma.featureFlag.findMany.mockResolvedValue([
        row({ key: 'cases', enabled: false }),
      ]);
      const all = await service.listAll();
      expect(all.length).toBe(FEATURE_REGISTRY.length);
      const cases = all.find((f) => f.key === 'cases');
      expect(cases?.enabled).toBe(false);
      // Unseeded keys → default-allow
      const petitions = all.find((f) => f.key === 'petitions');
      expect(petitions?.enabled).toBe(true);
    });

    it('filters by build whitelist even when DB is empty', async () => {
      process.env['ENABLED_FEATURES'] = 'cases,petitions';
      await build();
      prisma.featureFlag.findMany.mockResolvedValue([]);
      const all = await service.listAll();
      const keys = all.map((f) => f.key).sort();
      expect(keys).toEqual(['cases', 'petitions']);
      // Both default-allow because DB is empty
      expect(all.every((f) => f.enabled)).toBe(true);
    });

    it('respects DB enabled=false even under whitelist', async () => {
      process.env['ENABLED_FEATURES'] = 'cases';
      await build();
      prisma.featureFlag.findMany.mockResolvedValue([
        row({ key: 'cases', enabled: false }),
      ]);
      const all = await service.listAll();
      expect(all.length).toBe(1);
      expect(all[0].enabled).toBe(false);
    });
  });

  describe('setEnabled', () => {
    it('updates DB and refreshes cache', async () => {
      delete process.env['ENABLED_FEATURES'];
      await build();
      prisma.featureFlag.update.mockResolvedValue(row({ enabled: false }));
      prisma.featureFlag.findMany.mockResolvedValue([row({ enabled: false })]);

      const result = await service.setEnabled('cases', false);
      expect(result.enabled).toBe(false);
      expect(prisma.featureFlag.update).toHaveBeenCalledWith({
        where: { key: 'cases' },
        data: { enabled: false },
      });
      expect(await service.isEnabled('cases')).toBe(false);
    });
  });
});
