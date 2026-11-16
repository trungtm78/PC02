import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { CaseChildAccessModule } from '../case-child-access/case-child-access.module';
import { DocumentNumbersModule } from '../document-numbers/document-numbers.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';
import { WardAlertsController } from './ward-alerts.controller';
import { WardAssignmentCommandService } from './ward-assignment-command.service';
import { WardAssignmentQueryService } from './ward-assignment-query.service';
import { WardAssignmentsController, WardInvestigatorsController } from './ward-assignments.controller';
import { WardInvestigatorsService } from './ward-investigators.service';
import { WardDocsModule } from './ward-docs.module';
import { WardMatchingService } from './ward-matching.service';
import { WardNotifier } from './ward-notifier';
import { WardRemindersScheduler } from './ward-reminders.scheduler';
import { WardReviewService } from './ward-review.service';
import { WardStatsService } from './ward-stats.service';

@Module({
  imports: [PrismaModule, AuthModule, AuditModule, DocumentNumbersModule, NotificationsModule, CaseChildAccessModule, WardDocsModule],
  // WardAlertsController first: its `GET stats` must be matched before `GET :id`.
  controllers: [WardAlertsController, WardAssignmentsController, WardInvestigatorsController],
  providers: [WardAssignmentCommandService, WardAssignmentQueryService, WardInvestigatorsService, WardReviewService, WardMatchingService, WardStatsService, WardNotifier, WardRemindersScheduler],
  exports: [WardAssignmentQueryService, WardNotifier],
})
export class WardAssignmentsModule {}
