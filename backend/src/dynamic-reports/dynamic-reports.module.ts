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
import { ReportAdminController } from './config/report-admin.controller';
import { ReportConfigService } from './config/report-config.service';
import { ReportDetailService } from './config/report-detail.service';
import { ReportLifecycleService } from './config/report-lifecycle.service';
import { AuditModule } from '../audit/audit.module';
import { SubmissionController } from './submission/submission.controller';
import { SubmissionService } from './submission/submission.service';
import { AggregateController } from './aggregate/aggregate.controller';
import { ExportController } from './aggregate/export.controller';
import { AggregateService } from './aggregate/aggregate.service';
import { FormulaEvaluationService } from './aggregate/formula-evaluation.service';
import { StatusQueryController } from './status/status-query.controller';
import { StatusQueryService } from './status/status-query.service';
import { GridController } from './grid/grid.controller';
import { GridAccessService } from './grid/grid-access.service';
import { GridModelService } from './grid/grid-model.service';
import { TemplateExportService } from './export/template-export.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CalendarEventsModule } from '../calendar-events/calendar-events.module';
import { TeamsModule } from '../teams/teams.module';

@Module({
  imports: [PrismaModule, AuthModule, CalendarEventsModule, TeamsModule, AuditModule],
  controllers: [
    ClockController,
    ReportsController,
    TemplatesController,
    SchedulePreviewController,
    ReportConfigController,
    ReportAdminController,
    SubmissionController,
    AggregateController,
    ExportController,
    StatusQueryController,
    GridController,
  ],
  providers: [
    GridAccessService,
    GridModelService,
    TemplateExportService,
    DynamicReportsRegistryService,
    PeriodSchedulerService,
    ReminderSchedulerService,
    TemplateService,
    VersionFieldsCacheService,
    ReportConfigService,
    ReportDetailService,
    ReportLifecycleService,
    SubmissionService,
    AggregateService,
    FormulaEvaluationService,
    StatusQueryService,
  ],
})
export class DynamicReportsModule {}
