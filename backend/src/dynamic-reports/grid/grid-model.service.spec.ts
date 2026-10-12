import { NotFoundException, ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import { GRID_ENGINE_VERSION } from '../engine/grid-types';
import type { GridModel } from '../engine/grid-types';
import { GridModelService, GRID_CACHE_MAX_ENTRIES } from './grid-model.service';
import * as worker from '../template/parse-in-worker';
import { RunnerBusyError } from '../template/bounded-runner';

jest.mock('../template/parse-in-worker', () => {
  const actual = jest.requireActual('../template/parse-in-worker');
  return { ...actual, buildGridInWorker: jest.fn() };
});

const buildGrid = worker.buildGridInWorker as jest.MockedFunction<typeof worker.buildGridInWorker>;

function modelOf(tag: string): GridModel {
  return {
    engineVersion: GRID_ENGINE_VERSION,
    dateSystem: 1900,
    sheetOrder: [tag],
    excludedSheets: [],
    styles: [{}],
    defaultFont: { name: 'Calibri', sizePt: 11 },
    sheets: [],
    warnings: [],
  };
}

interface Row {
  gridEngineVersion: number;
  sourceSha256: string;
  model: GridModel;
}

function makePrisma(opts: { versions?: Record<string, { sha256: string; sheets: string[] }>; rows?: Record<string, Row> } = {}) {
  const versions = opts.versions ?? { v1: { sha256: 'a'.repeat(64), sheets: ['S'] } };
  const rows: Record<string, Row> = { ...(opts.rows ?? {}) };
  const prisma = {
    dynReportVersion: {
      findUnique: jest.fn(async ({ where, select }: { where: { id: string }; select: Record<string, boolean> }) => {
        const v = versions[where.id];
        if (!v) return null;
        if (select.fileBytes) return { fileBytes: Buffer.from('xlsx-bytes') };
        return { id: where.id, sha256: v.sha256, selectedSheets: v.sheets };
      }),
    },
    dynReportVersionGrid: {
      findUnique: jest.fn(async ({ where }: { where: { versionId: string } }) => rows[where.versionId] ?? null),
      upsert: jest.fn(async ({ where, create }: { where: { versionId: string }; create: Row & { versionId: string } }) => {
        rows[where.versionId] = { gridEngineVersion: create.gridEngineVersion, sourceSha256: create.sourceSha256, model: create.model };
        return rows[where.versionId];
      }),
    },
  };
  return { prisma, rows };
}

describe('GridModelService', () => {
  beforeEach(() => buildGrid.mockReset());

  it('builds once from the file, persists it, and serves later reads from memory', async () => {
    buildGrid.mockResolvedValue(modelOf('built'));
    const { prisma, rows } = makePrisma();
    const svc = new GridModelService(prisma as never);

    const first = await svc.getForVersion('v1');
    const second = await svc.getForVersion('v1');

    expect(first.model.sheetOrder).toEqual(['built']);
    expect(second).toBe(first);
    expect(buildGrid).toHaveBeenCalledTimes(1);
    // The file is handed over as a lazy loader (read only once a worker slot is free).
    const [source, sheets] = buildGrid.mock.calls[0];
    expect(typeof source).toBe('function');
    expect(sheets).toEqual(['S']);
    await expect((source as () => Promise<Buffer>)()).resolves.toEqual(Buffer.from('xlsx-bytes'));
    expect(rows['v1']).toMatchObject({ gridEngineVersion: GRID_ENGINE_VERSION, sourceSha256: 'a'.repeat(64) });
    // Memory hit: the second call did not even read the table.
    expect(prisma.dynReportVersionGrid.findUnique).toHaveBeenCalledTimes(1);
  });

  it('single-flight: concurrent cold requests for one version trigger ONE build', async () => {
    let release!: (m: GridModel) => void;
    buildGrid.mockImplementation(() => new Promise<GridModel>((res) => { release = res; }));
    const { prisma } = makePrisma();
    const svc = new GridModelService(prisma as never);

    const calls = Promise.all([svc.getForVersion('v1'), svc.getForVersion('v1'), svc.getForVersion('v1')]);
    await new Promise((r) => setImmediate(r));
    release(modelOf('once'));
    const [a, b, c] = await calls;

    expect(buildGrid).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('serves a persisted model without building when engine version and file hash both match', async () => {
    const { prisma } = makePrisma({
      rows: { v1: { gridEngineVersion: GRID_ENGINE_VERSION, sourceSha256: 'a'.repeat(64), model: modelOf('stored') } },
    });
    const svc = new GridModelService(prisma as never);
    const payload = await svc.getForVersion('v1');
    expect(payload.model.sheetOrder).toEqual(['stored']);
    expect(buildGrid).not.toHaveBeenCalled();
  });

  it('rebuilds when the stored model came from an older engine version', async () => {
    buildGrid.mockResolvedValue(modelOf('fresh'));
    const { prisma, rows } = makePrisma({
      rows: { v1: { gridEngineVersion: GRID_ENGINE_VERSION - 1, sourceSha256: 'a'.repeat(64), model: modelOf('old') } },
    });
    const payload = await new GridModelService(prisma as never).getForVersion('v1');
    expect(payload.model.sheetOrder).toEqual(['fresh']);
    expect(rows['v1'].model.sheetOrder).toEqual(['fresh']);
  });

  it('rebuilds when the stored model was built from a different file', async () => {
    buildGrid.mockResolvedValue(modelOf('fresh'));
    const { prisma } = makePrisma({
      rows: { v1: { gridEngineVersion: GRID_ENGINE_VERSION, sourceSha256: 'b'.repeat(64), model: modelOf('other-file') } },
    });
    const payload = await new GridModelService(prisma as never).getForVersion('v1');
    expect(payload.model.sheetOrder).toEqual(['fresh']);
  });

  it('the ETag changes with the file and with the engine version, and is quoted', async () => {
    buildGrid.mockResolvedValue(modelOf('x'));
    const a = await new GridModelService(makePrisma().prisma as never).getForVersion('v1');
    const b = await new GridModelService(
      makePrisma({ versions: { v1: { sha256: 'c'.repeat(64), sheets: ['S'] } } }).prisma as never,
    ).getForVersion('v1');
    expect(a.etag).toMatch(/^"g\d+-[0-9a-f]{16}-v1"$/);
    expect(a.etag).not.toBe(b.etag);
  });

  it('an unknown version is a 404', async () => {
    const svc = new GridModelService(makePrisma().prisma as never);
    await expect(svc.getForVersion('nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  describe('when the worker cannot build it', () => {
    it.each([
      ['too large', () => new worker.GridTooLargeWorkerError('big'), UnprocessableEntityException, 'TOO_LARGE'],
      ['timeout', () => new worker.TemplateParseTimeoutError(1000), UnprocessableEntityException, 'TIMEOUT'],
      ['anything else', () => new Error('weird'), UnprocessableEntityException, 'FAILED'],
      ['busy', () => new RunnerBusyError(), ServiceUnavailableException, 'BUSY'],
    ])('%s → a clean HTTP error carrying a reason, never a 500', async (_name, make, klass, reason) => {
      buildGrid.mockRejectedValue(make());
      const svc = new GridModelService(makePrisma().prisma as never);
      const err = await svc.getForVersion('v1').catch((e) => e);
      expect(err).toBeInstanceOf(klass);
      expect((err.getResponse() as { reason: string }).reason).toBe(reason);
    });

    it('a build refused as busy never reads the workbook from the database (Codex G1b P1)', async () => {
      buildGrid.mockRejectedValue(new RunnerBusyError()); // refused before the loader is ever called
      const { prisma } = makePrisma();
      await new GridModelService(prisma as never).getForVersion('v1').catch(() => undefined);
      const fileReads = prisma.dynReportVersion.findUnique.mock.calls.filter(
        ([arg]) => (arg as { select: Record<string, boolean> }).select.fileBytes,
      );
      expect(fileReads).toHaveLength(0);
    });

    it('a failed build is not cached: the next request tries again', async () => {
      buildGrid.mockRejectedValueOnce(new Error('transient')).mockResolvedValueOnce(modelOf('ok'));
      const svc = new GridModelService(makePrisma().prisma as never);
      await expect(svc.getForVersion('v1')).rejects.toBeInstanceOf(UnprocessableEntityException);
      await expect(svc.getForVersion('v1')).resolves.toMatchObject({ model: { sheetOrder: ['ok'] } });
    });
  });

  it('memory is bounded: the least recently used entry is evicted first', async () => {
    buildGrid.mockImplementation(async () => modelOf('m'));
    const versions: Record<string, { sha256: string; sheets: string[] }> = {};
    for (let i = 0; i < GRID_CACHE_MAX_ENTRIES + 5; i++) versions[`v${i}`] = { sha256: String(i).padStart(64, '0'), sheets: ['S'] };
    const { prisma } = makePrisma({ versions });
    const svc = new GridModelService(prisma as never);
    for (let i = 0; i < GRID_CACHE_MAX_ENTRIES + 5; i++) await svc.getForVersion(`v${i}`);
    buildGrid.mockClear();
    prisma.dynReportVersionGrid.findUnique.mockClear();

    await svc.getForVersion(`v${GRID_CACHE_MAX_ENTRIES + 4}`); // newest: still in memory
    expect(prisma.dynReportVersionGrid.findUnique).not.toHaveBeenCalled();
    await svc.getForVersion('v0'); // oldest: evicted from memory, re-read from the table
    expect(prisma.dynReportVersionGrid.findUnique).toHaveBeenCalledTimes(1);
    expect(buildGrid).not.toHaveBeenCalled(); // …but not rebuilt, the table still has it
  });

  describe('ensureBuilt (backfill)', () => {
    it('builds a missing model and reports it', async () => {
      buildGrid.mockResolvedValue(modelOf('b'));
      const svc = new GridModelService(makePrisma().prisma as never);
      await expect(svc.ensureBuilt('v1')).resolves.toBe('built');
    });

    it('leaves a current model alone', async () => {
      const { prisma } = makePrisma({
        rows: { v1: { gridEngineVersion: GRID_ENGINE_VERSION, sourceSha256: 'a'.repeat(64), model: modelOf('s') } },
      });
      await expect(new GridModelService(prisma as never).ensureBuilt('v1')).resolves.toBe('cached');
      expect(buildGrid).not.toHaveBeenCalled();
    });

    it('an unknown version is a 404', async () => {
      await expect(new GridModelService(makePrisma().prisma as never).ensureBuilt('zz')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
