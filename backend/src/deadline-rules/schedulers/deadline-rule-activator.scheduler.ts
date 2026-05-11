import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DeadlineRulesService } from '../deadline-rules.service';

/**
 * Activator cron — promotes 'approved' versions to 'active' when their
 * effectiveFrom date is reached. Runs every day at 00:01.
 *
 * Multi-day catch-up safe: DeadlineRulesService.activateDueRules processes
 * versions in effectiveFrom ASC order, so if the server was down for 3 days
 * and 3 versions for the same key all became due, they activate sequentially
 * — each supersedes the previous, leaving the latest as the active rule.
 */
@Injectable()
export class DeadlineRuleActivatorScheduler {
  private readonly logger = new Logger(DeadlineRuleActivatorScheduler.name);

  constructor(private readonly service: DeadlineRulesService) {}

  @Cron('1 0 * * *', { name: 'deadline-rule-activator' })
  async run(): Promise<void> {
    this.logger.log('DeadlineRuleActivator: running');
    try {
      const result = await this.service.activateDueRules();
      if (result.activated.length > 0) {
        this.logger.log(`DeadlineRuleActivator: activated ${result.activated.length} version(s): ${result.activated.join(', ')}`);
      } else {
        this.logger.log('DeadlineRuleActivator: no versions due');
      }
    } catch (err) {
      this.logger.error(`DeadlineRuleActivator failed: ${String(err)}`);
    }
  }
}
