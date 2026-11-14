import { Module } from '@nestjs/common';
import { UnitScopeService } from '../auth/services/unit-scope.service';
import { TeamsModule } from '../teams/teams.module';
import { CaseAdapter } from './gateway/case.adapter';
import { IncidentAdapter } from './gateway/incident.adapter';
import { PetitionAdapter } from './gateway/petition.adapter';
import { RecordGateway } from './gateway/record-gateway';

/**
 * Processing flow and deadlines per information type. For now only the read-only gateway to the three record kinds:
 * no route, no table, no feature flag.
 */
@Module({
  // UnitScopeService resolves the scope a request would carry; it needs the team tree.
  imports: [TeamsModule],
  providers: [UnitScopeService, PetitionAdapter, IncidentAdapter, CaseAdapter, RecordGateway],
  exports: [RecordGateway],
})
export class ProcessingFlowModule {}
