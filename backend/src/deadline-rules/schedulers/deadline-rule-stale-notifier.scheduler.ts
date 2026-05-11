import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DeadlineRulesService } from '../deadline-rules.service';

/**
 * Stale-review cron — notifies approvers when submitted versions sit >24h
 * without action. Runs daily at 09:00 (during work hours so push is timely).
 */
@Injectable()
export class DeadlineRuleStaleNotifierScheduler {
  private readonly logger = new Logger(DeadlineRuleStaleNotifierScheduler.name);

  constructor(private readonly service: DeadlineRulesService) {}

  @Cron('0 9 * * *', { name: 'deadline-rule-stale-notifier' })
  async run(): Promise<void> {
    this.logger.log('DeadlineRuleStaleNotifier: running');
    try {
      const result = await this.service.notifyStaleSubmissions(24);
      if (result.notified.length > 0) {
        this.logger.log(`DeadlineRuleStaleNotifier: notified for ${result.notified.length} stale submission(s)`);
      }
    } catch (err) {
      this.logger.error(`DeadlineRuleStaleNotifier failed: ${String(err)}`);
    }
  }
}
