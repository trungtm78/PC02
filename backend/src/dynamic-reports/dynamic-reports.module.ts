import { Module } from '@nestjs/common';
import { ClockController } from './clock.controller';
import { ReportsController } from './reports.controller';
import { DynamicReportsRegistryService } from './reports.service';
import { PeriodSchedulerService } from './schedule/period-scheduler.service';
import { ReminderSchedulerService } from './schedule/reminder-scheduler.service';
import { SchedulePreviewController } from './schedule/schedule-preview.controller';
import { TemplatesController } from './template/templates.controller';
import { TemplateService } from './template/template.service';
import { VersionFieldsCacheService } from './template/version-fields-cache';
import { ReportConfigController } from './config/report-config.controller';
import { ReportConfigService } from './config/report-config.service';
import { SubmissionController } from './submission/submission.controller';
import { SubmissionService } from './submission/submission.service';
import { AggregateController } from './aggregate/aggregate.controller';
import { ExportController } from './aggregate/export.controller';
import { AggregateService } from './aggregate/aggregate.service';
import { StatusQueryController } from './status/status-query.controller';
import { StatusQueryService } from './status/status-query.service';
import { GridController } from './grid/grid.controller';
import { GridAccessService } from './grid/grid-access.service';
import { GridModelService } from './grid/grid-model.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CalendarEventsModule } from '../calendar-events/calendar-events.module';
import { TeamsModule } from '../teams/teams.module';

@Module({
  imports: [PrismaModule, AuthModule, CalendarEventsModule, TeamsModule],
  controllers: [
    ClockController,
    ReportsController,
    TemplatesController,
    SchedulePreviewController,
    ReportConfigController,
    SubmissionController,
    AggregateController,
    ExportController,
    StatusQueryController,
    GridController,
  ],
  providers: [
    GridAccessService,
    GridModelService,
    DynamicReportsRegistryService,
    PeriodSchedulerService,
    ReminderSchedulerService,
    TemplateService,
    VersionFieldsCacheService,
    ReportConfigService,
    SubmissionService,
    AggregateService,
    StatusQueryService,
  ],
})
export class DynamicReportsModule {}
