import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FeatureFlagsService } from './feature-flags.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CORE_FEATURE_KEYS } from './core-features.constants';
import { FEATURE_REGISTRY } from './feature-registry';

/**
 * `setEnabled` existed as dead code: no caller, no validation, and a
 * `prisma.update` that threw P2025 for any flag the first seed had not
 * created — which is every flag added since. This is the write path made real.
 */
const mockPrisma = {
  featureFlag: {
    findMany: jest.fn().mockResolvedValue([]),
    upsert: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockAudit = { log: jest.fn().mockResolvedValue(undefined) };

/** A real key from the compiled registry, so the manifest lookup succeeds. */
const NON_CORE_KEY =
  FEATURE_REGISTRY.find((m) => !CORE_FEATURE_KEYS.includes(m.key))?.key ?? '';

describe('FeatureFlagsService.setEnabled', () => {
  let service: FeatureFlagsService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        FeatureFlagsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();
    service = moduleRef.get(FeatureFlagsService);

    jest.clearAllMocks();
    delete process.env.ENABLED_FEATURES;
    mockPrisma.featureFlag.findMany.mockResolvedValue([]);
    mockPrisma.$transaction.mockImplementation(
      (fn: (tx: typeof mockPrisma) => unknown) => fn(mockPrisma),
    );
    mockPrisma.featureFlag.upsert.mockImplementation(
      ({
        where,
        update,
      }: {
        where: { key: string };
        update: { enabled: boolean };
      }) =>
        Promise.resolve({
          key: where.key,
          label: 'Nhãn',
          description: null,
          domain: 'core',
          rolloutPct: 100,
          enabled: update.enabled,
        }),
    );
  });

  it('rejects a key that is not in the compiled registry', async () => {
    await expect(service.setEnabled('khong-ton-tai', false)).rejects.toThrow(
      NotFoundException,
    );
    expect(mockPrisma.featureFlag.upsert).not.toHaveBeenCalled();
  });

  it.each(CORE_FEATURE_KEYS)(
    'refuses to switch off the core feature %s',
    async (key) => {
      await expect(service.setEnabled(key, false)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrisma.featureFlag.upsert).not.toHaveBeenCalled();
    },
  );

  it('still allows enabling a core feature — that is a no-op, not a lockout', async () => {
    await expect(
      service.setEnabled(CORE_FEATURE_KEYS[0], true),
    ).resolves.toBeDefined();
  });

  it('upserts rather than updates, so a never-seeded flag does not P2025', async () => {
    await service.setEnabled(NON_CORE_KEY, false);

    expect(mockPrisma.featureFlag.upsert).toHaveBeenCalledTimes(1);
    expect(mockPrisma.featureFlag.update).not.toHaveBeenCalled();
  });

  it('writes the audit entry inside the same transaction as the flag', async () => {
    await service.setEnabled(NON_CORE_KEY, false);

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'FEATURE_FLAG_DISABLED',
        subject: 'FeatureFlag',
        subjectId: NON_CORE_KEY,
      }),
      mockPrisma,
    );
  });

  it('records who did it and what it was before', async () => {
    mockPrisma.featureFlag.findMany.mockResolvedValue([
      {
        key: NON_CORE_KEY,
        label: 'x',
        description: null,
        domain: 'core',
        rolloutPct: 100,
        enabled: true,
      },
    ]);
    await service.isEnabled(NON_CORE_KEY); // prime the cache

    await service.setEnabled(NON_CORE_KEY, false, {
      id: 'actor-1',
      ipAddress: '10.0.0.1',
    });

    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'actor-1',
        ipAddress: '10.0.0.1',
        metadata: expect.objectContaining({ before: true, after: false }),
      }),
      expect.anything(),
    );
  });

  it('rejects a key the build does not ship', async () => {
    process.env.ENABLED_FEATURES = 'auth,admin';
    const moduleRef = await Test.createTestingModule({
      providers: [
        FeatureFlagsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();
    const scoped = moduleRef.get(FeatureFlagsService);

    await expect(scoped.setEnabled(NON_CORE_KEY, false)).rejects.toThrow(
      BadRequestException,
    );
  });
});

describe('core features cannot be switched off from the database either', () => {
  let service: FeatureFlagsService;

  beforeEach(async () => {
    // Clear the env BEFORE constructing: the whitelist is read in the
    // constructor, so a leftover ENABLED_FEATURES from the suite above would
    // make every key outside it report disabled and the assertion below fail
    // for the wrong reason.
    delete process.env.ENABLED_FEATURES;
    const moduleRef = await Test.createTestingModule({
      providers: [
        FeatureFlagsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();
    service = moduleRef.get(FeatureFlagsService);
    jest.clearAllMocks();
  });

  it('reports a core flag as enabled even when its row says false', async () => {
    // The recovery scenario: somebody ran UPDATE feature_flags SET
    // enabled=false WHERE key='admin'. If that took effect, nobody could
    // reach the screen that undoes it.
    mockPrisma.featureFlag.findMany.mockResolvedValue(
      CORE_FEATURE_KEYS.map((key) => ({
        key,
        label: key,
        description: null,
        domain: 'core',
        rolloutPct: 100,
        enabled: false,
      })),
    );

    for (const key of CORE_FEATURE_KEYS) {
      await expect(service.isEnabled(key)).resolves.toBe(true);
    }
  });

  it('every core key exists in the registry — a typo here disables nothing', () => {
    const known = new Set(FEATURE_REGISTRY.map((m) => m.key));
    const missing = CORE_FEATURE_KEYS.filter((k) => !known.has(k));
    expect(missing).toEqual([]);
  });
});
