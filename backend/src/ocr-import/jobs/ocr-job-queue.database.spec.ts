import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Client } from 'pg';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { PrismaService } from '../../prisma/prisma.service';
import { OcrSessionsService } from '../sessions/ocr-sessions.service';
import { OcrJobQueue } from './ocr-job-queue';

/**
 * The background job queue on REAL PostgreSQL: claiming with FOR UPDATE SKIP LOCKED, the global cap, retries with
 * backoff and recovery of jobs stranded by a restart. Runs only with `PETITION_SUGGEST_DATABASE_URL`
 * (127.0.0.1/pc02_goiy_scope_test); CI makes a missing database a failure.
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

run('OcrJobQueue on PostgreSQL', () => {
  let db: PrismaClient;
  let sessions: OcrSessionsService;
  let queue: OcrJobQueue;
  const tag = `job-${randomUUID().slice(0, 8)}`;
  const alice = { id: `${tag}-alice` };
  const bob = { id: `${tag}-bob` };
  let counter = 0;

  /** A session with one page, so it has a real, changing input fingerprint. */
  const newSession = async (owner = alice) => {
    const s = await sessions.createSession('PETITION', owner);
    counter += 1;
    const page = await sessions.addPage(
      s.id,
      {
        sha256: `${tag}-${counter}`.padEnd(64, '0').slice(0, 64),
        mimeType: 'image/png',
        sizeBytes: 10,
        originalPath: `x/${counter}.png`,
      },
      owner,
    );
    return { session: s, pageId: page.page.id };
  };

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

  beforeEach(() => {
    sessions = new OcrSessionsService(db as unknown as PrismaService);
    queue = new OcrJobQueue(db as unknown as PrismaService, sessions);
  });
  afterEach(wipe);
  afterAll(async () => {
    await wipe();
    await db.$disconnect();
  });

  const claimable = () =>
    db.ocrJob.findMany({
      where: { createdById: { startsWith: tag }, state: 'QUEUED' },
    });

  describe('enqueue', () => {
    it('queues a job for the exact input state, and asking again for the same state returns the same job', async () => {
      const { session } = await newSession();
      const first = await queue.enqueue(session.id, 'READ', alice);
      const again = await queue.enqueue(session.id, 'READ', alice);
      expect(first.deduplicated).toBe(false);
      expect(again).toMatchObject({ id: first.id, deduplicated: true });
      expect(await db.ocrJob.count({ where: { sessionId: session.id } })).toBe(
        1,
      );
      expect(
        (await db.ocrJob.findUniqueOrThrow({ where: { id: first.id } }))
          .inputFingerprint,
      ).toBe(await sessions.currentFingerprint(session.id));
    });

    it('a changed input state is a new job, and a different kind is a different job', async () => {
      const { session, pageId } = await newSession();
      const a = await queue.enqueue(session.id, 'READ', alice);
      await sessions.saveTranscript(
        session.id,
        pageId,
        { text: 't', source: 'OFFICER' },
        alice,
      );
      const b = await queue.enqueue(session.id, 'READ', alice);
      const c = await queue.enqueue(session.id, 'ANALYSE', alice);
      expect(new Set([a.id, b.id, c.id]).size).toBe(3);
    });

    it('only the session owner can queue work, and a closed session takes none', async () => {
      const { session } = await newSession();
      expect(await codeOf(queue.enqueue(session.id, 'READ', bob))).toBe(
        'OCR_SESSION_NOT_FOUND',
      );
      await sessions.cancel(session.id, alice);
      expect(await codeOf(queue.enqueue(session.id, 'READ', alice))).toBe(
        'OCR_SESSION_CLOSED',
      );
    });
  });

  describe('claim', () => {
    it('hands out the oldest queued job and marks it running with one attempt', async () => {
      const one = await newSession();
      const two = await newSession();
      const a = await queue.enqueue(one.session.id, 'READ', alice);
      await queue.enqueue(two.session.id, 'READ', alice);
      const job = await queue.claim('worker-1', { maxRunning: 5 });
      expect(job).toMatchObject({
        id: a.id,
        state: 'RUNNING',
        attempts: 1,
        claimedBy: 'worker-1',
      });
    });

    it('returns nothing when the queue is empty or the job is not due yet', async () => {
      expect(
        await queue.claim('w', { maxRunning: 5, scopeTag: tag }),
      ).toBeNull();
      const { session } = await newSession();
      const queued = await queue.enqueue(session.id, 'READ', alice);
      await db.ocrJob.update({
        where: { id: queued.id },
        data: { runAfter: new Date(Date.now() + 60_000) },
      });
      expect(
        await queue.claim('w', { maxRunning: 5, scopeTag: tag }),
      ).toBeNull();
    });

    it('never runs more jobs at once than the server-wide cap', async () => {
      const a = await newSession();
      const b = await newSession();
      await queue.enqueue(a.session.id, 'READ', alice);
      await queue.enqueue(b.session.id, 'READ', alice);
      expect(
        await queue.claim('w1', { maxRunning: 1, scopeTag: tag }),
      ).not.toBeNull();
      expect(
        await queue.claim('w2', { maxRunning: 1, scopeTag: tag }),
      ).toBeNull();
      expect(
        await queue.claim('w2', { maxRunning: 2, scopeTag: tag }),
      ).not.toBeNull();
    });

    it('several workers claiming at the same moment never receive the same job', async () => {
      const made: string[] = [];
      for (let i = 0; i < 5; i += 1) {
        const s = await newSession();
        made.push((await queue.enqueue(s.session.id, 'READ', alice)).id);
      }
      const claimed = await Promise.all(
        Array.from({ length: 8 }, (_, i) =>
          queue.claim(`w${i}`, { maxRunning: 50, scopeTag: tag }),
        ),
      );
      const ids = claimed.filter((j) => j !== null).map((j) => j.id);
      expect(ids).toHaveLength(5);
      expect(new Set(ids).size).toBe(5);
      expect([...ids].sort()).toEqual([...made].sort());
      expect(await claimable()).toHaveLength(0);
    });
  });

  describe('finishing', () => {
    const tokenOf = (job: { claimedBy: string | null; attempts: number }) => ({
      workerId: job.claimedBy!,
      attempt: job.attempts,
    });
    const claimOne = async () => {
      const { session } = await newSession();
      const q = await queue.enqueue(session.id, 'READ', alice);
      const job = await queue.claim('w', { maxRunning: 50, scopeTag: tag });
      expect(job?.id).toBe(q.id);
      return job!;
    };
    const reclaim = async () => {
      const job = await queue.claim('w', { maxRunning: 50, scopeTag: tag });
      return job!;
    };

    it('complete marks it succeeded', async () => {
      const job = await claimOne();
      await queue.complete(job.id, tokenOf(job));
      expect(
        await db.ocrJob.findUniqueOrThrow({ where: { id: job.id } }),
      ).toMatchObject({ state: 'SUCCEEDED' });
    });

    it('a retryable failure requeues it later, with growing delay, until the attempts run out', async () => {
      let job = await claimOne();
      await queue.fail(job.id, 'RATE_LIMIT', { retryable: true }, tokenOf(job));
      let row = await db.ocrJob.findUniqueOrThrow({ where: { id: job.id } });
      expect(row).toMatchObject({
        state: 'QUEUED',
        attempts: 1,
        lastErrorCode: 'RATE_LIMIT',
      });
      const firstDelay = row.runAfter.getTime() - Date.now();
      expect(firstDelay).toBeGreaterThan(0);

      await db.ocrJob.update({
        where: { id: job.id },
        data: { runAfter: new Date() },
      });
      job = await reclaim();
      await queue.fail(job.id, 'RATE_LIMIT', { retryable: true }, tokenOf(job));
      row = await db.ocrJob.findUniqueOrThrow({ where: { id: job.id } });
      expect(row.runAfter.getTime() - Date.now()).toBeGreaterThan(firstDelay);

      await db.ocrJob.update({
        where: { id: job.id },
        data: { runAfter: new Date() },
      });
      job = await reclaim();
      await queue.fail(job.id, 'RATE_LIMIT', { retryable: true }, tokenOf(job));
      expect(
        await db.ocrJob.findUniqueOrThrow({ where: { id: job.id } }),
      ).toMatchObject({
        state: 'FAILED',
        attempts: 3,
      });
    });

    it('a non-retryable failure ends it at once, with its code', async () => {
      const job = await claimOne();
      await queue.fail(
        job.id,
        'LLM_QUOTA_EXCEEDED',
        { retryable: false },
        tokenOf(job),
      );
      expect(
        await db.ocrJob.findUniqueOrThrow({ where: { id: job.id } }),
      ).toMatchObject({
        state: 'FAILED',
        lastErrorCode: 'LLM_QUOTA_EXCEEDED',
      });
    });

    it('a worker that lost its claim cannot finish or fail the attempt that replaced it', async () => {
      const first = await claimOne();
      const staleToken = tokenOf(first);
      // The job was taken back as stranded and claimed again by another worker.
      await db.ocrJob.update({
        where: { id: first.id },
        data: { state: 'QUEUED', claimedBy: null, claimedAt: null, runAfter: new Date() },
      });
      const second = await queue.claim('other', { maxRunning: 50, scopeTag: tag });
      expect(second).toMatchObject({ id: first.id, claimedBy: 'other', attempts: 2 });

      await queue.complete(first.id, staleToken);
      await queue.fail(first.id, 'INTERNAL', { retryable: false }, staleToken);

      expect(
        await db.ocrJob.findUniqueOrThrow({ where: { id: first.id } }),
      ).toMatchObject({ state: 'RUNNING', claimedBy: 'other' });
    });

    it('a heartbeat keeps a long job from being taken back, and only its owner can send one', async () => {
      const job = await claimOne();
      await db.ocrJob.update({
        where: { id: job.id },
        data: { claimedAt: new Date(Date.now() - 20 * 60_000) },
      });
      await queue.heartbeat(job.id, { workerId: 'someone-else', attempt: 1 });
      expect(await queue.recoverStuck(new Date(), 10 * 60_000, tag)).toEqual({
        requeued: 1,
        failed: 0,
      });

      const again = await (async () => {
        await db.ocrJob.update({ where: { id: job.id }, data: { runAfter: new Date() } });
        return reclaim();
      })();
      await db.ocrJob.update({
        where: { id: again.id },
        data: { claimedAt: new Date(Date.now() - 20 * 60_000) },
      });
      await queue.heartbeat(again.id, tokenOf(again));
      expect(await queue.recoverStuck(new Date(), 10 * 60_000, tag)).toEqual({
        requeued: 0,
        failed: 0,
      });
    });
  });

  describe('recovering jobs stranded by a restart', () => {
    it('returns a long-running job to the queue, or fails it when it has used all its attempts', async () => {
      const a = await newSession();
      const b = await newSession();
      const ja = await queue.enqueue(a.session.id, 'READ', alice);
      const jb = await queue.enqueue(b.session.id, 'READ', alice);
      const old = new Date(Date.now() - 20 * 60_000);
      await db.ocrJob.update({
        where: { id: ja.id },
        data: {
          state: 'RUNNING',
          attempts: 1,
          claimedAt: old,
          claimedBy: 'dead',
        },
      });
      await db.ocrJob.update({
        where: { id: jb.id },
        data: {
          state: 'RUNNING',
          attempts: 3,
          claimedAt: old,
          claimedBy: 'dead',
        },
      });

      const recovered = await queue.recoverStuck(new Date(), 10 * 60_000, tag);
      expect(recovered).toEqual({ requeued: 1, failed: 1 });
      expect(
        (await db.ocrJob.findUniqueOrThrow({ where: { id: ja.id } })).state,
      ).toBe('QUEUED');
      expect(
        await db.ocrJob.findUniqueOrThrow({ where: { id: jb.id } }),
      ).toMatchObject({
        state: 'FAILED',
        lastErrorCode: 'STUCK',
      });
    });

    it('leaves a job that is still within its time alone', async () => {
      const a = await newSession();
      const ja = await queue.enqueue(a.session.id, 'READ', alice);
      await db.ocrJob.update({
        where: { id: ja.id },
        data: { state: 'RUNNING', attempts: 1, claimedAt: new Date() },
      });
      expect(await queue.recoverStuck(new Date(), 10 * 60_000, tag)).toEqual({
        requeued: 0,
        failed: 0,
      });
    });
  });

  describe('reading a job', () => {
    it('shows a job only to the owner of its session', async () => {
      const { session } = await newSession();
      const q = await queue.enqueue(session.id, 'READ', alice);
      expect((await queue.getJob(q.id, alice)).state).toBe('QUEUED');
      expect(await codeOf(queue.getJob(q.id, bob))).toBe(
        'OCR_SESSION_NOT_FOUND',
      );
      expect((await queue.latestJob(session.id, alice))?.id).toBe(q.id);
    });
  });

  describe('database rules', () => {
    it('two active jobs for the same session, kind and input state are rejected by the database', async () => {
      const { session } = await newSession();
      const fp = await sessions.currentFingerprint(session.id);
      const insert = () =>
        db.ocrJob.create({
          data: {
            sessionId: session.id,
            kind: 'READ',
            inputFingerprint: fp,
            createdById: alice.id,
          },
        });
      await insert();
      await expect(insert()).rejects.toThrow();
    });
  });
});
