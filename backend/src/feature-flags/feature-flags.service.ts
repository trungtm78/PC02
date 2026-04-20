import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FEATURE_REGISTRY } from './feature-registry';

export interface FeatureFlagDto {
  key: string;
  label: string;
  description: string | null;
  enabled: boolean;
  domain: string | null;
  rolloutPct: number;
}

// Happy-path cache window — after this we try a refresh.
const CACHE_TTL_MS = Number(
  process.env['FEATURE_FLAG_CACHE_TTL_MS'] ?? 30_000,
);
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

  constructor(private readonly prisma: PrismaService) {
    const envList = process.env['ENABLED_FEATURES'];
    this.buildWhitelist =
      envList && envList.trim().length > 0
        ? new Set(envList.split(',').map((s) => s.trim()).filter(Boolean))
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
  async isEnabled(key: string): Promise<boolean> {
    if (this.buildWhitelist && !this.buildWhitelist.has(key)) {
      return false;
    }
    await this.ensureFresh();
    const flag = this.cache.get(key);
    if (!flag) return true; // default-allow unseeded features
    return flag.enabled;
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
      if (row) {
        result.push(row);
      } else {
        // Default-allow synthetic entry — mirrors isEnabled() semantics.
        result.push({
          key: manifest.key,
          label: manifest.label,
          description: manifest.description ?? null,
          enabled: true,
          domain: manifest.domain,
          rolloutPct: 100,
        });
      }
    }
    return result;
  }

  async setEnabled(key: string, enabled: boolean): Promise<FeatureFlagDto> {
    const row = await this.prisma.featureFlag.update({
      where: { key },
      data: { enabled },
    });
    // Drop TTL to force the next ensureFresh() to actually refresh.
    this.cacheExpiresAt = 0;
    await this.ensureFresh();
    return {
      key: row.key,
      label: row.label,
      description: row.description,
      enabled: row.enabled,
      domain: row.domain,
      rolloutPct: row.rolloutPct,
    };
  }

  /** Test-only: force cache reset. */
  _resetCacheForTests(): void {
    this.cache.clear();
    this.cacheExpiresAt = 0;
    this.refreshing = null;
  }
}
