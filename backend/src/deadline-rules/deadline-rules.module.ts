import { Module } from '@nestjs/common';
import { DeadlineRulesService } from './deadline-rules.service';
import { DeadlineRulesController } from './deadline-rules.controller';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DeadlineRuleActivatorScheduler } from './schedulers/deadline-rule-activator.scheduler';
import { DeadlineRuleStaleNotifierScheduler } from './schedulers/deadline-rule-stale-notifier.scheduler';

@Module({
  imports: [AuditModule, NotificationsModule],
  controllers: [DeadlineRulesController],
  providers: [
    DeadlineRulesService,
    DeadlineRuleActivatorScheduler,
    DeadlineRuleStaleNotifierScheduler,
  ],
  exports: [DeadlineRulesService],
})
export class DeadlineRulesModule {}
