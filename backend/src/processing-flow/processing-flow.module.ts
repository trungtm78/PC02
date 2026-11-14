import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { UnitScopeService } from '../auth/services/unit-scope.service';
import { TeamsModule } from '../teams/teams.module';
import { WorkingCalendarService } from './calendar/working-calendar.service';
import { CaseAdapter } from './gateway/case.adapter';
import { IncidentAdapter } from './gateway/incident.adapter';
import { PetitionAdapter } from './gateway/petition.adapter';
import { RecordGateway } from './gateway/record-gateway';

/**
 * Processing flow and deadlines per information type. For now the read-only gateway to the three record kinds and the
 * working calendar deadlines are counted on (the calculation engine itself is pure: `engine/`). No route, no feature
 * flag.
 */
@Module({
  // UnitScopeService resolves the scope a request would carry; it needs the team tree. The calendar audits its writes.
  imports: [TeamsModule, AuditModule],
  providers: [UnitScopeService, PetitionAdapter, IncidentAdapter, CaseAdapter, RecordGateway, WorkingCalendarService],
  exports: [RecordGateway, WorkingCalendarService],
})
export class ProcessingFlowModule {}
