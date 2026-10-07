import { CaseGraphAccessModule } from '../reports/graph-access/case-graph-access.module';
import { Module } from '@nestjs/common';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CalendarEventsModule } from '../calendar-events/calendar-events.module';

@Module({
  imports: [
    CaseGraphAccessModule,
    PrismaModule,
    AuthModule,
    CalendarEventsModule,
  ],
  controllers: [CalendarController],
  providers: [CalendarService],
})
export class CalendarModule {}
