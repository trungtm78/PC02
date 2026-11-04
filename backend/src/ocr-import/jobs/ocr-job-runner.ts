import { Injectable, Logger, Optional } from '@nestjs/common';
import type { OcrJob } from '@prisma/client';
import { hostname } from 'node:os';
import { FeatureFlagsService } from '../../feature-flags/feature-flags.service';
import { classifyJobFailure } from './classify-job-failure';
import { OcrJobQueue } from './ocr-job-queue';
import { OcrReadExecutor } from './ocr-read-executor';

export interface RunnerOptions {
  /** Jobs this server runs at once; also the server-wide cap handed to the queue. */
  maxRunning: number;
  workerId: string;
  /** How often a running job tells the queue it is alive. */
  heartbeatMs?: number;
}

export const OCR_FEATURE_FLAG = 'ocr_import';
const DEFAULT_MAX_RUNNING = 4;
/** A job running longer than this is taken to belong to a worker that died. */
const STUCK_AFTER_MS = 10 * 60_000;
const HEARTBEAT_MS = 60_000;
const RECOVER_EVERY_MS = 60_000;

const defaultOptions = (): RunnerOptions => ({
  maxRunning:
    Number.parseInt(process.env.OCR_MAX_PARALLEL ?? '', 10) ||
    DEFAULT_MAX_RUNNING,
  workerId: `${hostname()}-${process.pid}`,
});

/**
 * Pulls work from the queue and runs it, at most `maxRunning` jobs at a time on this server.
 *
 * It does nothing while the `ocr_import` feature flag is off, and `OCR_RUNNER=off` switches it off for one process
 * (for instance an instance that should only serve the API). Jobs left running by a dead worker are returned to the
 * queue about once a minute.
 */
@Injectable()
export class OcrJobRunner {
  private readonly logger = new Logger(OcrJobRunner.name);
  private readonly options: RunnerOptions;
  private readonly inFlight = new Set<Promise<void>>();
  private lastRecovery = 0;

  constructor(
    private readonly queue: OcrJobQueue,
    private readonly executor: OcrReadExecutor,
    private readonly flags: FeatureFlagsService,
    @Optional() options?: RunnerOptions,
  ) {
    this.options = options ?? defaultOptions();
  }

  /** Starts as many queued jobs as there is room for. Returns how many it started. */
  async pump(): Promise<number> {
    if (process.env.OCR_RUNNER === 'off') return 0;
    try {
      if (!(await this.flags.isEnabled(OCR_FEATURE_FLAG))) return 0;
      await this.recoverIfDue();
      let started = 0;
      while (this.inFlight.size < this.options.maxRunning) {
        const job = await this.queue.claim(this.options.workerId, {
          maxRunning: this.options.maxRunning,
        });
        if (!job) break;
        this.start(job);
        started += 1;
      }
      return started;
    } catch (error) {
      this.logger.error(`pump failed: ${(error as Error).name}`);
      return 0;
    }
  }

  /** Resolves when everything started so far has finished. */
  async idle(): Promise<void> {
    while (this.inFlight.size > 0) await Promise.all([...this.inFlight]);
  }

  private start(job: OcrJob): void {
    const task = this.process(job).finally(() => this.inFlight.delete(task));
    this.inFlight.add(task);
  }

  private async process(job: OcrJob): Promise<void> {
    // This attempt, as the queue knows it: a worker that lost the job cannot finish or fail it any more.
    const token = {
      workerId: job.claimedBy ?? this.options.workerId,
      attempt: job.attempts,
    };
    // A long reading is not a stranded one: keep telling the queue it is alive.
    const beat = setInterval(() => {
      this.queue.heartbeat(job.id, token).catch(() => undefined);
    }, this.options.heartbeatMs ?? HEARTBEAT_MS);
    try {
      await this.executor.execute(job);
      await this.queue.complete(job.id, token);
    } catch (error) {
      const failure = classifyJobFailure(error);
      // The code only: an error message can carry what was read from a scan.
      this.logger.warn(`job ${job.id} failed: ${failure.code}`);
      try {
        await this.queue.fail(
          job.id,
          failure.code,
          { retryable: failure.retryable },
          token,
        );
      } catch (recordError) {
        this.logger.error(
          `job ${job.id}: could not record failure: ${(recordError as Error).name}`,
        );
      }
    } finally {
      clearInterval(beat);
    }
  }

  private async recoverIfDue(): Promise<void> {
    const now = Date.now();
    if (now - this.lastRecovery < RECOVER_EVERY_MS) return;
    this.lastRecovery = now;
    const { requeued, failed } = await this.queue.recoverStuck(
      new Date(now),
      STUCK_AFTER_MS,
    );
    if (requeued + failed > 0) {
      this.logger.warn(
        `recovered stuck jobs: ${requeued} requeued, ${failed} failed`,
      );
    }
  }
}
