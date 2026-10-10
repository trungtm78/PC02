import { Module } from '@nestjs/common';
import { ClockController } from './clock.controller';
import { ReportsController } from './reports.controller';
import { DynamicReportsRegistryService } from './reports.service';
import { PeriodSchedulerService } from './schedule/period-scheduler.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CalendarEventsModule } from '../calendar-events/calendar-events.module';

@Module({
  imports: [PrismaModule, AuthModule, CalendarEventsModule],
  controllers: [ClockController, ReportsController],
  providers: [DynamicReportsRegistryService, PeriodSchedulerService],
})
export class DynamicReportsModule {}
