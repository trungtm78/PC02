import { Module } from '@nestjs/common';
import { ClockController } from './clock.controller';
import { ReportsController } from './reports.controller';
import { DynamicReportsRegistryService } from './reports.service';
import { PeriodSchedulerService } from './schedule/period-scheduler.service';
import { SchedulePreviewController } from './schedule/schedule-preview.controller';
import { TemplatesController } from './template/templates.controller';
import { TemplateService } from './template/template.service';
import { ReportConfigController } from './config/report-config.controller';
import { ReportConfigService } from './config/report-config.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CalendarEventsModule } from '../calendar-events/calendar-events.module';

@Module({
  imports: [PrismaModule, AuthModule, CalendarEventsModule],
  controllers: [
    ClockController,
    ReportsController,
    TemplatesController,
    SchedulePreviewController,
    ReportConfigController,
  ],
  providers: [
    DynamicReportsRegistryService,
    PeriodSchedulerService,
    TemplateService,
    ReportConfigService,
  ],
})
export class DynamicReportsModule {}
