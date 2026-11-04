import { PrismaClient, type OcrJob } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Client } from 'pg';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import type { PrismaService } from '../../prisma/prisma.service';
import type { PolicyOutcome, Validation } from '../../llm/call-policy';
import type { GatewayContext } from '../../llm/llm-gateway.service';
import type { LlmRequest, LlmResult } from '../../llm/llm.types';
import { HttpStatus } from '@nestjs/common';
import { sampleBundle } from '../evidence/evidence.fixture';
import { OcrImportError } from '../ocr-import-error';
import type { PipelineGateway } from '../pipeline';
import { OcrSessionsService } from '../sessions/ocr-sessions.service';
import { ImageStorageService } from '../storage/image-storage.service';
import { OcrReadExecutor } from './ocr-read-executor';

/**
 * Runs one queued reading end to end on REAL PostgreSQL with a scripted provider: stored scans in, immutable
 * transcript revisions and a published analysis out. Runs only with `PETITION_SUGGEST_DATABASE_URL`.
 */
const url = process.env.PETITION_SUGGEST_DATABASE_URL;
const run = url ? describe : describe.skip;

if (process.env.PETITION_SUGGEST_DATABASE_REQUIRED === '1') {
  it('the scratch database is mandatory (PETITION_SUGGEST_DATABASE_URL)', () => {
    expect(url).toBeTruthy();
  });
}

const codeOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
    return null;
  } catch (error) {
    return (
      (error as { getResponse?: () => { code?: string } }).getResponse?.()
        .code ?? 'unknown'
    );
  }
};

interface Recorded {
  request: LlmRequest;
  context: GatewayContext;
}

run('OcrReadExecutor on PostgreSQL', () => {
  let db: PrismaClient;
  let sessions: OcrSessionsService;
  let storage: ImageStorageService;
  let root: string;
  let calls: Recorded[];
  /** Runs inside the analysis call: lets a test change the session while the provider is "thinking". */
  let duringAnalysis: (() => Promise<void>) | null;
  /** Runs inside the first page-reading call. */
  let duringReading: (() => Promise<void>) | null;
  const tag = `exe-${randomUUID().slice(0, 8)}`;
  const alice = { id: `${tag}-alice` };

  const fakeGateway = (): PipelineGateway => ({
    async call<T>(
      request: LlmRequest,
      validate: (json: unknown) => Validation<T>,
      context: GatewayContext,
    ): Promise<PolicyOutcome<T>> {
      calls.push({ request, context });
      const isPage = (request.images?.length ?? 0) > 0;
      if (isPage && duringReading) {
        const hook = duringReading;
        duringReading = null;
        await hook();
      }
      if (!isPage && duringAnalysis) await duringAnalysis();
      const json = isPage
        ? {
            pageKind: 'COMPLAINT',
            printedPageNumber: null,
            transcript: 'ĐƠN TỐ CÁO\nNguyễn Thị Hương',
            unreadable: [],
          }
        : sampleBundle();
      const checked = validate(json);
      if (!checked.ok) throw new Error(`invalid: ${checked.issues.join(',')}`);
      const result: LlmResult = {
        json,
        usage: { inputTokens: 1, outputTokens: 1 },
        latencyMs: 1,
        model: 'm',
        providerKind: 'ANTHROPIC',
      };
      return { result, value: checked.value, attempts: [] };
    },
  });

  /** A real JPEG carrying orientation and GPS, stored as an original the way an upload would. */
  const addScan = async (sessionId: string, shade: number) => {
    const bytes = await sharp({
      create: {
        width: 300,
        height: 200,
        channels: 3,
        background: { r: shade, g: 20, b: 20 },
      },
    })
      .withMetadata({ orientation: 6 })
      .withExif({
        IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '10/1 46/1 30/1' },
      })
      .jpeg()
      .toBuffer();
    const stored = await storage.saveOriginal(sessionId, bytes);
    return sessions.addPage(sessionId, stored, alice);
  };

  const jobFor = async (
    sessionId: string,
    kind: 'READ' | 'ANALYSE',
  ): Promise<OcrJob> =>
    db.ocrJob.create({
      data: {
        sessionId,
        kind,
        inputFingerprint: await sessions.currentFingerprint(sessionId),
        createdById: alice.id,
        state: 'RUNNING',
        attempts: 1,
      },
    });

  const wipe = async () => {
    await db.ocrSession.deleteMany({
      where: { createdById: { startsWith: tag } },
    });
  };

  beforeAll(async () => {
    const parsed = new URL(url!);
    if (
      parsed.hostname !== '127.0.0.1' ||
      parsed.pathname !== '/pc02_goiy_scope_test'
    ) {
      throw new Error(
        'Refused: PETITION_SUGGEST_DATABASE_URL must point to 127.0.0.1/pc02_goiy_scope_test',
      );
    }
    const client = new Client({ connectionString: url! });
    await client.connect();
    try {
      for (const migration of [
        '20261103203000_ocr_sessions',
        '20261103213000_ocr_jobs',
      ]) {
        const sql = fs.readFileSync(
          path.join(
            __dirname,
            `../../../prisma/migrations/${migration}/migration.sql`,
          ),
          'utf-8',
        );
        const marker = '-- Rules Prisma cannot express';
        expect(sql).toContain(marker);
        await client.query(sql.slice(sql.indexOf(marker)));
      }
    } finally {
      await client.end();
    }
    db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: url! }),
    });
    await wipe();
  });

  let executor: OcrReadExecutor;
  const sendPolicy = { assertForUser: jest.fn(() => Promise.resolve()) };
  beforeEach(() => {
    calls = [];
    sendPolicy.assertForUser.mockReset();
    sendPolicy.assertForUser.mockResolvedValue(undefined);
    duringAnalysis = null;
    duringReading = null;
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-exec-'));
    sessions = new OcrSessionsService(db as unknown as PrismaService);
    storage = new ImageStorageService({ rootDir: root });
    executor = new OcrReadExecutor(
      db as unknown as PrismaService,
      sessions,
      storage,
      fakeGateway(),
      sendPolicy as never,
    );
  });
  afterEach(async () => {
    await wipe();
    fs.rmSync(root, { recursive: true, force: true });
  });
  afterAll(async () => {
    await wipe();
    await db.$disconnect();
  });

  describe('READ', () => {
    it('reads every page from the stored scans, keeps each reading as a revision, and publishes the analysis', async () => {
      const s = await sessions.createSession('PETITION', alice);
      await addScan(s.id, 200);
      await addScan(s.id, 100);

      await executor.execute(await jobFor(s.id, 'READ'));

      const transcripts = await sessions.latestTranscripts(s.id, alice);
      expect(Object.values(transcripts)).toHaveLength(2);
      expect(
        Object.values(transcripts).every((t) => t.source === 'MODEL'),
      ).toBe(true);
      const analysis = await sessions.currentAnalysis(s.id, alice);
      expect(analysis).not.toBeNull();
      expect(analysis!.entity).toBe('PETITION');
      // two page readings and one analysis, all grouped under the session in the lineage
      expect(calls).toHaveLength(3);
      expect(calls.every((c) => c.context.sessionRef === s.id)).toBe(true);
      expect(calls.every((c) => c.context.userId === alice.id)).toBe(true);
    });

    it('records which step the job is on while it works, so the screen can say what it waits for', async () => {
      const s = await sessions.createSession('PETITION', alice);
      await addScan(s.id, 200);
      const job = await jobFor(s.id, 'READ');
      const seen: Array<string | null> = [];
      const stageNow = async () =>
        (await db.ocrJob.findUniqueOrThrow({ where: { id: job.id } })).stage;
      duringReading = async () => {
        seen.push(await stageNow());
      };
      duringAnalysis = async () => {
        seen.push(await stageNow());
      };

      await executor.execute(job);

      expect(seen).toEqual(['READING_PAGES', 'ANALYSING']);
    });

    it('an analysis-only job goes straight to the analysing step', async () => {
      const s = await sessions.createSession('PETITION', alice);
      await addScan(s.id, 200);
      await executor.execute(await jobFor(s.id, 'READ'));
      const job = await jobFor(s.id, 'ANALYSE');
      let seen: string | null = null;
      duringAnalysis = async () => {
        seen = (await db.ocrJob.findUniqueOrThrow({ where: { id: job.id } }))
          .stage;
      };

      await executor.execute(job);

      expect(seen).toBe('ANALYSING');
    });

    it('sends the provider a rotated copy without EXIF, and keeps that copy next to the original', async () => {
      const s = await sessions.createSession('PETITION', alice);
      await addScan(s.id, 200);

      await executor.execute(await jobFor(s.id, 'READ'));

      const sent = calls.find((c) => (c.request.images?.length ?? 0) > 0)!
        .request.images![0];
      expect(sent.mediaType).toBe('image/jpeg');
      const meta = await sharp(
        Buffer.from(sent.dataBase64, 'base64'),
      ).metadata();
      expect(meta.exif).toBeUndefined();
      expect([meta.width, meta.height]).toEqual([200, 300]);
      const page = (
        await db.ocrPage.findMany({ where: { sessionId: s.id } })
      )[0];
      expect(page.derivedPath).toBeTruthy();
      expect(page.derivedTransforms).toContain('strip-metadata');
      expect(fs.existsSync(path.join(root, page.derivedPath!))).toBe(true);
    });

    it('sends a PDF page as it is stored: a single-page PDF, with its own media type, never run through the image tools', async () => {
      const s = await sessions.createSession('PETITION', alice);
      const doc = await PDFDocument.create();
      doc.addPage([200, 200]);
      const stored = await storage.savePdfPage(
        s.id,
        Buffer.from(await doc.save()),
      );
      await sessions.addPage(s.id, stored, alice);
      const derive = jest.spyOn(storage, 'deriveForProvider');

      await executor.execute(await jobFor(s.id, 'READ'));

      const sent = calls.find((c) => (c.request.images?.length ?? 0) > 0)!
        .request.images![0];
      expect(sent.mediaType).toBe('application/pdf');
      expect(
        Buffer.from(sent.dataBase64, 'base64').subarray(0, 5).toString(),
      ).toBe('%PDF-');
      expect(derive).not.toHaveBeenCalled();
    });

    it('reuses the stored derived copy on the next reading instead of deriving again', async () => {
      const s = await sessions.createSession('PETITION', alice);
      await addScan(s.id, 200);
      await executor.execute(await jobFor(s.id, 'READ'));
      const derive = jest.spyOn(storage, 'deriveForProvider');
      await executor.execute(await jobFor(s.id, 'READ'));
      expect(derive).not.toHaveBeenCalled();
    });

    it('a correction made while the pages were being read is kept, and the stale reading is refused', async () => {
      const s = await sessions.createSession('PETITION', alice);
      const { page } = await addScan(s.id, 200);
      duringReading = async () => {
        await sessions.saveTranscript(
          s.id,
          page.id,
          { text: 'cán bộ đã sửa', source: 'OFFICER' },
          alice,
        );
      };

      expect(await codeOf(executor.execute(await jobFor(s.id, 'READ')))).toBe(
        'OCR_INPUT_CHANGED',
      );
      expect(
        (await sessions.latestTranscripts(s.id, alice))[page.id].text,
      ).toBe('cán bộ đã sửa');
      expect(await sessions.currentAnalysis(s.id, alice)).toBeNull();
    });

    it('sends nothing when the user may no longer send, even though the job was queued while they could', async () => {
      const s = await sessions.createSession('PETITION', alice);
      await addScan(s.id, 200);
      const job = await jobFor(s.id, 'READ');
      sendPolicy.assertForUser.mockRejectedValue(
        new OcrImportError('OCR_FORBIDDEN', HttpStatus.FORBIDDEN),
      );

      expect(await codeOf(executor.execute(job))).toBe('OCR_FORBIDDEN');
      expect(sendPolicy.assertForUser).toHaveBeenCalledWith(alice.id);
      expect(calls).toHaveLength(0);
    });

    it('a session with no pages cannot be read', async () => {
      const s = await sessions.createSession('PETITION', alice);
      expect(await codeOf(executor.execute(await jobFor(s.id, 'READ')))).toBe(
        'OCR_NO_PAGES',
      );
    });

    it('a cancelled session is not read', async () => {
      const s = await sessions.createSession('PETITION', alice);
      await addScan(s.id, 200);
      const job = await jobFor(s.id, 'READ');
      await sessions.cancel(s.id, alice);
      expect(await codeOf(executor.execute(job))).toBe('OCR_SESSION_CLOSED');
      expect(calls).toHaveLength(0);
    });
  });

  describe('ANALYSE', () => {
    it("analyses the officer's corrected text without reading any page again", async () => {
      const s = await sessions.createSession('INCIDENT', alice);
      const { page } = await addScan(s.id, 200);
      await sessions.saveTranscript(
        s.id,
        page.id,
        { text: 'Bản đã sửa bởi cán bộ', source: 'OFFICER' },
        alice,
      );

      await executor.execute(await jobFor(s.id, 'ANALYSE'));

      expect(calls).toHaveLength(1);
      expect(calls[0].request.userText).toContain('Bản đã sửa bởi cán bộ');
      expect(calls[0].request.images ?? []).toHaveLength(0);
      expect((await sessions.currentAnalysis(s.id, alice))?.entity).toBe(
        'INCIDENT',
      );
    });

    it('refuses to analyse a page that has no text yet', async () => {
      const s = await sessions.createSession('PETITION', alice);
      await addScan(s.id, 200);
      expect(
        await codeOf(executor.execute(await jobFor(s.id, 'ANALYSE'))),
      ).toBe('OCR_TRANSCRIPT_MISSING');
      expect(calls).toHaveLength(0);
    });
  });

  describe('a change made while the provider was working', () => {
    it('keeps the late analysis as history but does not make it the current one', async () => {
      const s = await sessions.createSession('PETITION', alice);
      const { page } = await addScan(s.id, 200);
      await sessions.saveTranscript(
        s.id,
        page.id,
        { text: 'bản đầu', source: 'OFFICER' },
        alice,
      );
      duringAnalysis = async () => {
        await sessions.saveTranscript(
          s.id,
          page.id,
          { text: 'cán bộ sửa lại ngay lúc đó', source: 'OFFICER' },
          alice,
        );
      };

      await executor.execute(await jobFor(s.id, 'ANALYSE'));

      expect(await sessions.currentAnalysis(s.id, alice)).toBeNull();
      const stored = await db.ocrAnalysis.findMany({
        where: { sessionId: s.id },
      });
      expect(stored).toHaveLength(1);
      expect(stored[0].isCurrent).toBe(false);
    });
  });
});
