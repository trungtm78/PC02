import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { WardNotifier } from './ward-notifier';

const SWITCH = 'ward-assignments';

/**
 * The 07:00 trigger of the deadline reminders of ward assignment requests (Viet Nam time). A job of its own beside
 * the three branches of `scheduler/deadline.scheduler.ts`: it shares no promise, no query and no failure with them,
 * so a fault here cannot cost them a reminder. Nothing runs while the feature is switched off. What is told and when
 * is `WardNotifier.remindDeadlines`; a run that fails is caught and logged, the next day's run tells what is due.
 */
@Injectable()
export class WardRemindersScheduler {
  private readonly logger = new Logger(WardRemindersScheduler.name);

  constructor(
    private readonly notifier: WardNotifier,
    @Optional() private readonly flags?: FeatureFlagsService,
  ) {}

  @Cron('0 7 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async run(now: Date = new Date()): Promise<void> {
    try {
      if (this.flags && !(await this.flags.isEnabled(SWITCH))) return;
      const result = await this.notifier.remindDeadlines(now);
      this.logger.log(`Ward deadline reminders: ${result.told} told, ${result.skipped} skipped, ${result.failed} failed`);
    } catch (error) {
      this.logger.error('Ward deadline reminders failed', error);
    }
  }
}
