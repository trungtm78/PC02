import { HttpStatus, Injectable } from '@nestjs/common';
import type { OcrJob, OcrJobKind, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OcrImportError } from '../ocr-import-error';
import {
  OcrSessionsService,
  type Actor,
} from '../sessions/ocr-sessions.service';

export interface ClaimOptions {
  /** Server-wide cap on jobs running at once, so reading scans can never starve the rest of the API. */
  maxRunning: number;
  /** Restricts the queue to jobs created by users whose id starts with this tag. Tests only. */
  scopeTag?: string;
}

export interface EnqueuedJob {
  id: string;
  /** True when an identical job (same session, kind and input state) was already queued or running. */
  deduplicated: boolean;
}

/** First retry waits this long; each further retry doubles it. */
const BACKOFF_BASE_MS = 30_000;
/** One number for the whole server: claims take this transaction-scoped lock so the running cap cannot be overshot. */
const CLAIM_LOCK_KEY = 727_001;

const likeFor = (scopeTag: string | undefined): string =>
  scopeTag ? `${scopeTag.replace(/[\\%_]/g, '\\$&')}%` : '%';

/**
 * The background work queue, kept in the database: it survives a restart, needs no Redis, and works with several
 * instances. Workers claim with `FOR UPDATE SKIP LOCKED`, so two of them never receive the same job.
 *
 * A job is queued for an exact input state of a session (its fingerprint): asking again for the same state while the
 * work is still queued or running returns the same job instead of paying for a second reading.
 */
@Injectable()
export class OcrJobQueue {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: OcrSessionsService,
  ) {}

  async enqueue(
    sessionId: string,
    kind: OcrJobKind,
    actor: Actor,
  ): Promise<EnqueuedJob> {
    const session = await this.sessions.getSession(sessionId, actor);
    if (session.status !== 'OPEN') {
      throw new OcrImportError('OCR_SESSION_CLOSED', HttpStatus.CONFLICT);
    }
    const inputFingerprint = await this.sessions.currentFingerprint(sessionId);
    const findActive = () =>
      this.prisma.ocrJob.findFirst({
        where: {
          sessionId,
          kind,
          inputFingerprint,
          state: { in: ['QUEUED', 'RUNNING'] },
        },
      });

    const existing = await findActive();
    if (existing) return { id: existing.id, deduplicated: true };
    try {
      const created = await this.prisma.ocrJob.create({
        data: { sessionId, kind, inputFingerprint, createdById: actor.id },
      });
      return { id: created.id, deduplicated: false };
    } catch (error) {
      // Two requests raced: the database refused the second, which is the same job as the first.
      const winner = await findActive();
      if (winner) return { id: winner.id, deduplicated: true };
      throw error;
    }
  }

  /** The oldest due job, now marked as running by this worker; or null when there is nothing to do or the cap is reached. */
  async claim(workerId: string, options: ClaimOptions): Promise<OcrJob | null> {
    const pattern = likeFor(options.scopeTag);
    // The clock is the application's, not now(): the columns are timestamp-without-zone holding UTC, and comparing
    // them with the database's now() would shift by the server's time zone.
    const nowUtc = new Date();
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CLAIM_LOCK_KEY})`;
      const running = await tx.$queryRaw<{ n: number }[]>`
        SELECT count(*)::int AS n FROM ocr_jobs
        WHERE state = 'RUNNING' AND "createdById" LIKE ${pattern}`;
      if ((running[0]?.n ?? 0) >= options.maxRunning) return null;

      const due = await tx.$queryRaw<{ id: string }[]>`
        SELECT j.id FROM ocr_jobs j
        WHERE j.state = 'QUEUED' AND j."runAfter" <= ${nowUtc} AND j."createdById" LIKE ${pattern}
          AND EXISTS (SELECT 1 FROM ocr_sessions s WHERE s.id = j."sessionId" AND s.status = 'OPEN')
        ORDER BY j."runAfter", j."createdAt", j.id
        FOR UPDATE OF j SKIP LOCKED
        LIMIT 1`;
      if (due.length === 0) return null;
      return tx.ocrJob.update({
        where: { id: due[0].id },
        data: {
          state: 'RUNNING',
          attempts: { increment: 1 },
          claimedBy: workerId,
          claimedAt: new Date(),
        },
      });
    });
  }

  async complete(jobId: string): Promise<void> {
    await this.prisma.ocrJob.updateMany({
      where: { id: jobId, state: 'RUNNING' },
      data: { state: 'SUCCEEDED', finishedAt: new Date(), lastErrorCode: null },
    });
  }

  /** A retryable failure goes back to the queue after a growing delay, until the attempts run out. */
  async fail(
    jobId: string,
    errorCode: string,
    options: { retryable: boolean },
  ): Promise<void> {
    const job = await this.prisma.ocrJob.findUnique({ where: { id: jobId } });
    if (!job || job.state !== 'RUNNING') return;
    const giveUp = !options.retryable || job.attempts >= job.maxAttempts;
    const data: Prisma.OcrJobUpdateManyMutationInput = giveUp
      ? { state: 'FAILED', finishedAt: new Date(), lastErrorCode: errorCode }
      : {
          state: 'QUEUED',
          lastErrorCode: errorCode,
          claimedBy: null,
          claimedAt: null,
          runAfter: new Date(
            Date.now() + BACKOFF_BASE_MS * 2 ** (job.attempts - 1),
          ),
        };
    await this.prisma.ocrJob.updateMany({
      where: { id: jobId, state: 'RUNNING' },
      data,
    });
  }

  /**
   * Jobs left running by a worker that died (a deploy, a crash). Those with attempts left go back to the queue; the
   * rest are failed with the code STUCK.
   */
  async recoverStuck(
    now: Date,
    maxAgeMs: number,
    scopeTag?: string,
  ): Promise<{ requeued: number; failed: number }> {
    const cutoff = new Date(now.getTime() - maxAgeMs);
    const pattern = likeFor(scopeTag);
    return this.prisma.$transaction(async (tx) => {
      const failed = await tx.$executeRaw`
        UPDATE ocr_jobs SET state = 'FAILED', "finishedAt" = ${now}, "lastErrorCode" = 'STUCK'
        WHERE state = 'RUNNING' AND "claimedAt" < ${cutoff} AND attempts >= "maxAttempts"
          AND "createdById" LIKE ${pattern}`;
      const requeued = await tx.$executeRaw`
        UPDATE ocr_jobs SET state = 'QUEUED', "claimedBy" = NULL, "claimedAt" = NULL, "runAfter" = ${now}
        WHERE state = 'RUNNING' AND "claimedAt" < ${cutoff} AND attempts < "maxAttempts"
          AND "createdById" LIKE ${pattern}`;
      return { requeued, failed };
    });
  }

  /** A job is visible only to the owner of its session. */
  async getJob(jobId: string, actor: Actor): Promise<OcrJob> {
    const job = await this.prisma.ocrJob.findUnique({ where: { id: jobId } });
    if (!job) {
      throw new OcrImportError('OCR_SESSION_NOT_FOUND', HttpStatus.NOT_FOUND);
    }
    await this.sessions.getSession(job.sessionId, actor);
    return job;
  }

  async latestJob(sessionId: string, actor: Actor): Promise<OcrJob | null> {
    await this.sessions.getSession(sessionId, actor);
    return this.prisma.ocrJob.findFirst({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
