import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { UnitScopeService } from '../auth/services/unit-scope.service';
import { TeamsModule } from '../teams/teams.module';
import { WorkingCalendarController } from './calendar/working-calendar.controller';
import { WorkingCalendarService } from './calendar/working-calendar.service';
import { ProcessingFlowsController } from './config/processing-flows.controller';
import { ProcessingFlowsService } from './config/processing-flows.service';
import { CaseAdapter } from './gateway/case.adapter';
import { IncidentAdapter } from './gateway/incident.adapter';
import { PetitionAdapter } from './gateway/petition.adapter';
import { RecordGateway } from './gateway/record-gateway';

/**
 * Processing flow and deadlines per information type: the read-only gateway to the three record kinds, the working
 * calendar deadlines are counted on, and the configuration of flows (the calculation engine itself is pure:
 * `engine/`). The routes are the configuration only, behind the `processing_flow` switch; nothing is stored per record
 * yet.
 */
@Module({
  // UnitScopeService resolves the scope a request would carry; it needs the team tree. The services audit their writes.
  // AuthModule: the guards of the routes.
  imports: [TeamsModule, AuditModule, AuthModule],
  controllers: [ProcessingFlowsController, WorkingCalendarController],
  providers: [UnitScopeService, PetitionAdapter, IncidentAdapter, CaseAdapter, RecordGateway, WorkingCalendarService, ProcessingFlowsService],
  exports: [RecordGateway, WorkingCalendarService, ProcessingFlowsService],
})
export class ProcessingFlowModule {}
