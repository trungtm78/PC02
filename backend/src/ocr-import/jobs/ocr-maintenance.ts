import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression, Interval } from '@nestjs/schedule';
import { OcrSessionsService } from '../sessions/ocr-sessions.service';
import { ImageStorageService } from '../storage/image-storage.service';
import { OcrJobRunner } from './ocr-job-runner';

/** Scheduled housekeeping of the scan-intake module. */
@Injectable()
export class OcrMaintenance {
  private readonly logger = new Logger(OcrMaintenance.name);

  constructor(
    private readonly sessions: OcrSessionsService,
    private readonly storage: ImageStorageService,
  ) {}

  /** Deletes unbound sessions past their expiry, then their image files. A bound session is never touched. */
  async purge(now: Date): Promise<{ sessions: number; files: number }> {
    const { files, sessions } = await this.sessions.purgeExpired(now);
    // Database first: a file left behind by a crash between the two steps is harmless, a row pointing at a missing
    // file would not be.
    const removed =
      files.length > 0 ? await this.storage.deleteFiles(files) : 0;
    return { sessions, files: removed };
  }

  @Cron(CronExpression.EVERY_HOUR, { name: 'ocr-purge-expired' })
  async run(): Promise<void> {
    try {
      const result = await this.purge(new Date());
      if (result.sessions > 0) {
        this.logger.log(
          `purged ${result.sessions} expired session(s), ${result.files} file(s)`,
        );
      }
    } catch (error) {
      this.logger.error(`purge failed: ${(error as Error).name}`);
    }
  }
}

/** Polls the job queue every two seconds. The runner itself decides whether the feature is on. */
@Injectable()
export class OcrJobScheduler {
  constructor(private readonly runner: OcrJobRunner) {}

  @Interval('ocr-job-pump', 2000)
  async tick(): Promise<void> {
    await this.runner.pump();
  }
}
