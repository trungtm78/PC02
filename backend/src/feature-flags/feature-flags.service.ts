import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { FEATURE_REGISTRY, getManifest } from './feature-registry';
import { isCoreFeature } from './core-features.constants';

export interface FeatureFlagDto {
  key: string;
  label: string;
  description: string | null;
  enabled: boolean;
  domain: string | null;
  rolloutPct: number;
  /**
   * True for flags that cannot be switched off. Sent so the admin screen can
   * render the toggle disabled instead of offering an action the API will
   * refuse — and so nobody has to keep a second copy of the list in the
   * frontend.
   */
  isCore?: boolean;
}

// Happy-path cache window — after this we try a refresh.
const CACHE_TTL_MS = Number(process.env['FEATURE_FLAG_CACHE_TTL_MS'] ?? 30_000);
// On a failed refresh we don't want to hammer the DB every request. Serve
// the stale cache for this window before the next retry.
const RETRY_BACKOFF_MS = 5_000;

@Injectable()
export class FeatureFlagsService implements OnModuleInit {
  private readonly logger = new Logger(FeatureFlagsService.name);
  private cache = new Map<string, FeatureFlagDto>();
  private cacheExpiresAt = 0;
  private refreshing: Promise<void> | null = null;
  private readonly buildWhitelist: Set<string> | null;

  constructor(
    private readonly prisma: PrismaService,
    /**
     * Optional on purpose. This module is `@Global` and supplies an
     * `APP_GUARD`, so it is constructed very early; a hard dependency on
     * AuditModule risks a circular graph that only shows up as a boot failure.
     * `@Optional()` keeps the app bootable, and the flag-write path is the
     * only thing that uses it — a missing audit logger there is visible in the
     * tests rather than at 3am.
     */
    @Optional() private readonly audit?: AuditService,
  ) {
    const envList = process.env['ENABLED_FEATURES'];
    this.buildWhitelist =
      envList && envList.trim().length > 0
        ? new Set(
            envList
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
          )
        : null;
  }

  async onModuleInit() {
    try {
      await this.refresh();
    } catch (err: unknown) {
      // DB may not be ready at boot (migration hasn't run yet, container
      // race conditions). Swallow — the first real request will retry via
      // ensureFresh() which has its own error handling.
      this.logger.warn(
        `Initial feature flag load skipped (DB not ready?): ${(err as Error).message}`,
      );
    }
  }

  private async refresh(): Promise<void> {
    const rows = await this.prisma.featureFlag.findMany();
    const next = new Map<string, FeatureFlagDto>();
    for (const row of rows) {
      next.set(row.key, {
        key: row.key,
        label: row.label,
        description: row.description,
        enabled: row.enabled,
        domain: row.domain,
        rolloutPct: row.rolloutPct,
      });
    }
    this.cache = next;
    this.cacheExpiresAt = Date.now() + CACHE_TTL_MS;
  }

  /**
   * Refresh the cache if it is stale. Safe against:
   *  - thundering herd: concurrent callers share one in-flight promise
   *  - transient DB failures: on error we log, keep the prior cache, and
   *    back off by RETRY_BACKOFF_MS so we don't hot-loop the DB
   */
  private async ensureFresh(): Promise<void> {
    if (Date.now() < this.cacheExpiresAt) return;

    this.refreshing ??= this.refresh()
      .catch((err: unknown) => {
        this.logger.error(
          `Feature flag refresh failed, serving stale cache: ${(err as Error).message}`,
        );
        // Push the next retry out so we don't spin. Stale cache keeps
        // serving until then. If the cache has never been populated,
        // callers will fall through to default-allow behavior.
        this.cacheExpiresAt = Date.now() + RETRY_BACKOFF_MS;
      })
      .finally(() => {
        this.refreshing = null;
      });

    await this.refreshing;
  }

  /**
   * Is the feature key enabled for this request? Semantics:
   *  1. If a build whitelist is set (`ENABLED_FEATURES` env) and the key
   *     is not in it, return false. Whitelist is the first gate.
   *  2. If the DB has a row, respect `enabled`.
   *  3. If the DB has no row, default-allow (so a fresh module code-ships
   *     before its seed runs without locking users out).
   */
  /**
   * The one place that decides whether a flag counts as on.
   *
   * `isEnabled()` and `listAll()` used to answer this question separately, and
   * two copies of a rule drift. Core keys are forced true here so that a
   * hand-edited row — `UPDATE feature_flags SET enabled=false WHERE key='admin'`
   * — cannot lock everyone out of the screen that would undo it.
   */
  private effectiveEnabled(
    key: string,
    row: { enabled: boolean } | undefined,
  ): boolean {
    if (isCoreFeature(key)) return true;
    if (!row) return true; // default-allow unseeded features
    return row.enabled;
  }

  async isEnabled(key: string): Promise<boolean> {
    if (this.buildWhitelist && !this.buildWhitelist.has(key)) {
      return false;
    }
    await this.ensureFresh();
    return this.effectiveEnabled(key, this.cache.get(key));
  }

  /**
   * Return every flag the frontend should know about. Merges the compiled
   * FEATURE_REGISTRY (source of truth for what modules exist in this build)
   * with the DB cache (source of truth for runtime enable state).
   *
   * This matters because a fresh deploy that hasn't been seeded yet still
   * needs to return *something* — otherwise the frontend menu renders blank
   * until an operator runs the seed script.
   *
   * Build whitelist still filters: keys outside `ENABLED_FEATURES` are hidden
   * from the frontend entirely, regardless of DB state.
   */
  async listAll(): Promise<FeatureFlagDto[]> {
    await this.ensureFresh();

    const result: FeatureFlagDto[] = [];
    for (const manifest of FEATURE_REGISTRY) {
      if (this.buildWhitelist && !this.buildWhitelist.has(manifest.key)) {
        continue;
      }
      const row = this.cache.get(manifest.key);
      const enabled = this.effectiveEnabled(manifest.key, row);
      if (row) {
        // Same rule as isEnabled(), not a second copy of it: a core key reads
        // as on here even when its row says otherwise, so the admin screen and
        // the guard never disagree about what is running.
        result.push({ ...row, enabled, isCore: isCoreFeature(manifest.key) });
      } else {
        result.push({
          key: manifest.key,
          label: manifest.label,
          description: manifest.description ?? null,
          enabled,
          domain: manifest.domain,
          rolloutPct: 100,
          isCore: isCoreFeature(manifest.key),
        });
      }
    }
    return result;
  }

  /**
   * Flip a flag.
   *
   * Three validations, all fail-fast, all before anything is written:
   *
   *   - Unknown key → 404. The registry is compiled in, so a key that is not
   *     in it does not exist in this build; accepting it would create a row
   *     nothing ever reads.
   *   - Core key + `enabled: false` → 400. See CORE_FEATURE_KEYS: switching
   *     one off removes the means of switching it back on.
   *   - Key outside `ENABLED_FEATURES` → 400. The build does not ship it, so
   *     enabling it in the database changes nothing and reads as a bug report
   *     later.
   *
   * `upsert`, not `update`: the old version threw P2025 for any flag the seed
   * had not created yet, which is every flag added since the first seed ran.
   * The audit entry goes in the same transaction — a flag that changed with no
   * record of who changed it is worse than one that did not change.
   */
  async setEnabled(
    key: string,
    enabled: boolean,
    actor?: { id: string; ipAddress?: string; userAgent?: string },
  ): Promise<FeatureFlagDto> {
    const manifest = getManifest(key);
    if (!manifest) {
      throw new NotFoundException(`Tính năng "${key}" không tồn tại`);
    }
    if (!enabled && isCoreFeature(key)) {
      throw new BadRequestException(
        `Không thể tắt tính năng lõi "${manifest.label}" — tắt nó thì không còn đường bật lại.`,
      );
    }
    if (this.buildWhitelist && !this.buildWhitelist.has(key)) {
      throw new BadRequestException(
        `Tính năng "${manifest.label}" không có trong gói build này (ENABLED_FEATURES), bật/tắt ở đây không có tác dụng.`,
      );
    }

    const before = this.cache.get(key)?.enabled;

    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.featureFlag.upsert({
        where: { key },
        update: { enabled },
        create: {
          key,
          label: manifest.label,
          description: manifest.description ?? null,
          domain: manifest.domain,
          enabled,
        },
      });
      await this.audit?.log(
        {
          userId: actor?.id ?? 'system',
          action: enabled ? 'FEATURE_FLAG_ENABLED' : 'FEATURE_FLAG_DISABLED',
          subject: 'FeatureFlag',
          subjectId: key,
          metadata: { key, label: manifest.label, before, after: enabled },
          ipAddress: actor?.ipAddress,
          userAgent: actor?.userAgent,
        },
        tx,
      );
      return updated;
    });

    // Drop TTL to force the next ensureFresh() to actually refresh.
    this.cacheExpiresAt = 0;
    await this.ensureFresh();
    return {
      key: row.key,
      label: row.label,
      description: row.description,
      enabled: this.effectiveEnabled(row.key, row),
      domain: row.domain,
      rolloutPct: row.rolloutPct,
      isCore: isCoreFeature(row.key),
    };
  }

  /** Re-read the table now, ignoring the TTL. */
  async forceRefresh(): Promise<void> {
    this.cacheExpiresAt = 0;
    await this.ensureFresh();
  }

  /** Test-only: force cache reset. */
  _resetCacheForTests(): void {
    this.cache.clear();
    this.cacheExpiresAt = 0;
    this.refreshing = null;
  }
}
