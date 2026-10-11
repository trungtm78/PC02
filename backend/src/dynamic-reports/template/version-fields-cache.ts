import { Injectable } from '@nestjs/common';
import type { DynReportField, DynReportValidationRule, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Perf (X04 benchmark, PR10, dynamic-reports, round 4): `loadEditorAssignment`
 * / `loadAssignmentForManager` used to `include` a version's `fields`/`rules`
 * on every single call — with 50 concurrent autosaves against one period,
 * that's 50 re-fetches + 50 re-hydrations of the SAME 5,000 `DynReportField`
 * rows (every assignment in a period shares one `versionId`), competing for
 * CPU/IO while each call is holding the submission's `FOR UPDATE` lock.
 *
 * Caching per `versionId` forever (no TTL, no invalidation) is safe because
 * `DynReportVersion`/`DynReportField`/`DynReportValidationRule` are
 * write-once: confirmed via `grep -rn "dynReportField\.\(update\|delete\)"
 * backend/src` returning zero results — only `create`/`createMany` ever
 * touch these tables, never `update`/`delete`. Unlike `FeatureFlagsService`
 * (TTL 30s — flags toggle at runtime), there is no "stale cache" case here
 * to guard against. The only reason this cache ever needs to empty is a
 * process restart (deploy), which happens for free since this is in-memory
 * and the backend runs as a single instance (no horizontal scaling).
 */
@Injectable()
export class VersionFieldsCacheService {
  private readonly cache = new Map<
    string,
    { fields: DynReportField[]; rules: DynReportValidationRule[] }
  >();

  async getOrLoad(
    client: Prisma.TransactionClient | PrismaService,
    versionId: string,
  ): Promise<{ fields: DynReportField[]; rules: DynReportValidationRule[] }> {
    const cached = this.cache.get(versionId);
    if (cached) return cached;
    const [fields, rules] = await Promise.all([
      client.dynReportField.findMany({ where: { versionId } }),
      client.dynReportValidationRule.findMany({ where: { versionId } }),
    ]);
    const data = { fields, rules };
    this.cache.set(versionId, data);
    return data;
  }

  /** Test-only. */
  _resetForTests(): void {
    this.cache.clear();
  }
}
