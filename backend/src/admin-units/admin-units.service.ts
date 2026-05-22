import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * AdminUnitsService — read-only browser API for Tỉnh/Phường (v0.34.0.0).
 *
 * Snapshot pattern: existing Directory queries unchanged. This module exposes
 * ergonomic endpoints for admin UI (tree, search, picker reverse lookup,
 * dataset version metadata) without modifying the underlying schema semantics.
 *
 * Design decisions from /autoplan:
 * - UC2: read-only (no CRUD/sync endpoints — dataset bumps via dev PR review)
 * - Phase 2 D1: searchWards supports Cmd+K global search grouped by province
 * - Phase 2 D3: getWardById returns ward + province metadata for SingleWardPicker
 *   reverse lookup (cold-cache safe, no layout shift)
 */
@Injectable()
export class AdminUnitsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * All active provinces sorted by name.
   * Cached aggressively on frontend (1h) — list rarely changes.
   */
  async getProvinces() {
    return this.prisma.directory.findMany({
      where: { type: 'PROVINCE', isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        officialCode: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Active wards of a province, optionally filtered by name search.
   * @param provinceId DB id of parent province (NOT province code)
   * @param q optional case-insensitive name substring
   */
  async getWardsByProvince(provinceId: string, q?: string) {
    return this.prisma.directory.findMany({
      where: {
        type: 'WARD',
        isActive: true,
        parentId: provinceId,
        ...(q && q.trim().length > 0
          ? { name: { contains: q.trim(), mode: 'insensitive' as const } }
          : {}),
      },
      select: {
        id: true,
        code: true,
        name: true,
        officialCode: true,
      },
      orderBy: { name: 'asc' },
      take: 1000, // safety cap (current max ~575 wards/province)
    });
  }

  /**
   * Single ward with province metadata, for SingleWardPicker reverse lookup
   * (when value=wardId is set but provinces/wards not loaded yet).
   * Phase 2 D3 fix: no layout shift, pre-rendered labels.
   */
  async getWardById(id: string) {
    // /codex post-impl fix #5: use _count instead of loading teams[].id (perf)
    const ward = await this.prisma.directory.findFirst({
      where: { id, type: 'WARD' },
      select: {
        id: true,
        code: true,
        name: true,
        officialCode: true,
        isActive: true,
        abolishedAt: true,
        sourceVersion: true,
        legalBasis: true,
        importedAt: true,
        parentId: true,
        _count: {
          select: { teams: { where: { isActive: true } } },
        },
      },
    });
    if (!ward) {
      throw new NotFoundException(`Phường không tồn tại (id: ${id})`);
    }
    const province = ward.parentId
      ? await this.prisma.directory.findUnique({
          where: { id: ward.parentId },
          select: { id: true, code: true, name: true, officialCode: true },
        })
      : null;
    const { _count, ...wardFields } = ward;
    return {
      ...wardFields,
      province,
      linkedTeamsCount: _count.teams,
    };
  }

  /**
   * Global Cmd+K search across all provinces.
   * Returns top N results grouped by province (most relevant first).
   * Phase 2 D1 fix: search-first hierarchy.
   */
  async searchWards(q: string, limit = 50) {
    const query = q.trim();
    if (query.length === 0) return [];

    const wards = await this.prisma.directory.findMany({
      where: {
        type: 'WARD',
        isActive: true,
        name: { contains: query, mode: 'insensitive' as const },
      },
      select: {
        id: true,
        code: true,
        name: true,
        officialCode: true,
        parentId: true,
      },
      orderBy: { name: 'asc' },
      take: limit,
    });

    // Batch-load parent provinces (avoid N+1)
    const parentIds = Array.from(new Set(wards.map((w) => w.parentId).filter(Boolean) as string[]));
    const provinces = await this.prisma.directory.findMany({
      where: { id: { in: parentIds } },
      select: { id: true, code: true, name: true },
    });
    const provinceById = new Map(provinces.map((p) => [p.id, p]));

    return wards.map((w) => ({
      id: w.id,
      code: w.code,
      name: w.name,
      officialCode: w.officialCode,
      province: w.parentId ? provinceById.get(w.parentId) ?? null : null,
    }));
  }

  /**
   * Current active dataset metadata for admin UI top bar.
   * Returns null if no dataset imported yet (fresh DB).
   */
  async getCurrentDatasetVersion() {
    return this.prisma.adminUnitDatasetImport.findFirst({
      where: { status: 'ACTIVE' },
      select: {
        version: true,
        checksum: true,
        addedProvinces: true,
        addedWards: true,
        updatedWards: true,
        abolishedWards: true,
        importedAt: true,
        completedAt: true,
      },
    });
  }
}
