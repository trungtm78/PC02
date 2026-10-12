import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { GRID_ENGINE_VERSION } from '../engine/grid-types';
import type { GridModel } from '../engine/grid-types';
import {
  GridTooLargeWorkerError,
  TemplateParseTimeoutError,
  buildGridInWorker,
} from '../template/parse-in-worker';
import { RunnerBusyError } from '../template/bounded-runner';

export interface GridPayload {
  model: GridModel;
  /** Strong validator: changes when the template file or the extraction rules change. */
  etag: string;
}

/** Why a grid could not be served; the client falls back to the list form on any of them. */
export type GridUnavailableReason = 'TOO_LARGE' | 'TIMEOUT' | 'BUSY' | 'FAILED';

/** In-process cache budget. A model is a few hundred KB; this holds the working set of live reports. */
export const GRID_CACHE_MAX_BYTES = 64 * 1024 * 1024;
export const GRID_CACHE_MAX_ENTRIES = 200;

interface VersionMeta {
  id: string;
  sha256: string;
  selectedSheets: unknown;
}

/**
 * Serves the render-ready GridModel of a published report version.
 *
 * Lookup order: process memory → `dyn_report_version_grids` → build from the
 * uploaded file in a bounded worker. A version's file is write-once, so a
 * model is valid for as long as its (engine version, file sha256) pair is;
 * either changing means rebuild. The table is a derived cache — it can be
 * dropped at any time.
 *
 * Concurrency: N simultaneous cold requests for one version trigger ONE
 * build (single-flight); builds across versions queue in the worker runner,
 * which refuses overflow instead of exhausting memory (review OV9).
 */
@Injectable()
export class GridModelService {
  private readonly logger = new Logger(GridModelService.name);
  /** Insertion-ordered: the first key is the least recently used. */
  private readonly memory = new Map<string, { payload: GridPayload; bytes: number }>();
  private memoryBytes = 0;
  private readonly inflight = new Map<string, Promise<GridPayload>>();

  constructor(private readonly prisma: PrismaService) {}

  async getForVersion(versionId: string): Promise<GridPayload> {
    const meta = await this.prisma.dynReportVersion.findUnique({
      where: { id: versionId },
      select: { id: true, sha256: true, selectedSheets: true },
    });
    if (!meta) throw new NotFoundException('Không tìm thấy phiên bản mẫu này.');

    const key = this.keyOf(meta);
    const hit = this.remember(key);
    if (hit) return hit;

    const row = await this.prisma.dynReportVersionGrid.findUnique({ where: { versionId } });
    if (
      row &&
      row.gridEngineVersion === GRID_ENGINE_VERSION &&
      row.sourceSha256 === meta.sha256
    ) {
      return this.store(key, meta, row.model as unknown as GridModel);
    }

    let pending = this.inflight.get(key);
    if (!pending) {
      pending = this.build(key, meta).finally(() => this.inflight.delete(key));
      this.inflight.set(key, pending);
    }
    return pending;
  }

  /** Builds (or rebuilds) and persists a model without serving it — the backfill uses this. */
  async ensureBuilt(versionId: string): Promise<'cached' | 'built'> {
    const meta = await this.prisma.dynReportVersion.findUnique({
      where: { id: versionId },
      select: { id: true, sha256: true, selectedSheets: true },
    });
    if (!meta) throw new NotFoundException('Không tìm thấy phiên bản mẫu này.');
    const row = await this.prisma.dynReportVersionGrid.findUnique({ where: { versionId } });
    if (
      row &&
      row.gridEngineVersion === GRID_ENGINE_VERSION &&
      row.sourceSha256 === meta.sha256
    ) {
      return 'cached';
    }
    await this.build(this.keyOf(meta), meta);
    return 'built';
  }

  private keyOf(meta: VersionMeta): string {
    return `${meta.id}:${GRID_ENGINE_VERSION}:${meta.sha256}`;
  }

  private etagOf(meta: VersionMeta): string {
    return `"g${GRID_ENGINE_VERSION}-${meta.sha256.slice(0, 16)}-${meta.id}"`;
  }

  private remember(key: string): GridPayload | null {
    const entry = this.memory.get(key);
    if (!entry) return null;
    this.memory.delete(key); // refresh recency
    this.memory.set(key, entry);
    return entry.payload;
  }

  private store(key: string, meta: VersionMeta, model: GridModel): GridPayload {
    const payload: GridPayload = { model, etag: this.etagOf(meta) };
    const bytes = JSON.stringify(model).length;
    const existing = this.memory.get(key);
    if (existing) {
      this.memoryBytes -= existing.bytes;
      this.memory.delete(key);
    }
    this.memory.set(key, { payload, bytes });
    this.memoryBytes += bytes;
    while (
      this.memory.size > 1 &&
      (this.memoryBytes > GRID_CACHE_MAX_BYTES || this.memory.size > GRID_CACHE_MAX_ENTRIES)
    ) {
      const oldest = this.memory.keys().next().value as string;
      this.memoryBytes -= (this.memory.get(oldest) as { bytes: number }).bytes;
      this.memory.delete(oldest);
    }
    return payload;
  }

  private async build(key: string, meta: VersionMeta): Promise<GridPayload> {
    const file = await this.prisma.dynReportVersion.findUnique({
      where: { id: meta.id },
      select: { fileBytes: true },
    });
    if (!file) throw new NotFoundException('Không tìm thấy phiên bản mẫu này.');

    const sheets = Array.isArray(meta.selectedSheets) ? (meta.selectedSheets as string[]) : [];
    let model: GridModel;
    try {
      model = await buildGridInWorker(Buffer.from(file.fileBytes), sheets);
    } catch (err) {
      throw this.unavailable(meta.id, err);
    }

    const json = model as unknown as Prisma.InputJsonValue;
    await this.prisma.dynReportVersionGrid.upsert({
      where: { versionId: meta.id },
      create: {
        versionId: meta.id,
        gridEngineVersion: GRID_ENGINE_VERSION,
        sourceSha256: meta.sha256,
        model: json,
      },
      update: {
        gridEngineVersion: GRID_ENGINE_VERSION,
        sourceSha256: meta.sha256,
        model: json,
        builtAt: new Date(),
      },
    });
    return this.store(key, meta, model);
  }

  private unavailable(versionId: string, err: unknown): Error {
    let reason: GridUnavailableReason = 'FAILED';
    if (err instanceof GridTooLargeWorkerError) reason = 'TOO_LARGE';
    else if (err instanceof TemplateParseTimeoutError) reason = 'TIMEOUT';
    else if (err instanceof RunnerBusyError) reason = 'BUSY';
    this.logger.warn(
      `grid build for version ${versionId} failed (${reason}): ${err instanceof Error ? err.message : String(err)}`,
    );
    const message =
      reason === 'BUSY'
        ? 'Hệ thống đang dựng nhiều mẫu cùng lúc, thử lại sau ít giây.'
        : 'Chưa dựng được lưới cho mẫu này — dùng dạng danh sách.';
    if (reason === 'BUSY') {
      return new ServiceUnavailableException({ code: 'GRID_BUSY', message, reason });
    }
    return new UnprocessableEntityException({ code: 'GRID_UNAVAILABLE', message, reason });
  }

  /** Test-only. */
  _resetForTests(): void {
    this.memory.clear();
    this.memoryBytes = 0;
    this.inflight.clear();
  }
}
