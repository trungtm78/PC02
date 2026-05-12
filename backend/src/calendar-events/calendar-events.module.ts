import { Module } from '@nestjs/common';
import { CalendarEventsController } from './calendar-events.controller';
import { CalendarEventsService } from './calendar-events.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { TeamsModule } from '../teams/teams.module';
import { UnitScopeService } from '../auth/services/unit-scope.service';

@Module({
  imports: [PrismaModule, AuthModule, TeamsModule],
  controllers: [CalendarEventsController],
  providers: [CalendarEventsService, UnitScopeService],
  exports: [CalendarEventsService],
})
export class CalendarEventsModule {}
