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
import { FlowApplicationService } from './records/flow-application.service';
import { ProcessingCommandService } from './records/processing-command.service';
import { ProcessingDeadlineService } from './records/processing-deadline.service';
import { ProcessingOutboxService } from './records/processing-outbox.service';
import { ProcessingPauseService } from './records/processing-pause.service';
import { ProcessingResultsService } from './records/processing-results.service';
import { RecordDeadlineWriter } from './records/record-deadline-writer.service';
import { RecordStepAccessService } from './records/record-step-access.service';
import { ProcessingRecordsController } from './records/processing-records.controller';
import { ProcessingTrackingController } from './tracking/processing-tracking.controller';
import { ProcessingTrackingService } from './tracking/processing-tracking.service';
import { RecordListAlertService } from './tracking/record-list-alert.service';

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
  controllers: [ProcessingFlowsController, WorkingCalendarController, ProcessingRecordsController, ProcessingTrackingController],
  providers: [UnitScopeService, PetitionAdapter, IncidentAdapter, CaseAdapter, RecordGateway, WorkingCalendarService, ProcessingFlowsService, FlowApplicationService, ProcessingOutboxService, ProcessingCommandService, ProcessingDeadlineService, ProcessingResultsService, ProcessingPauseService, RecordDeadlineWriter, RecordStepAccessService, ProcessingTrackingService, RecordListAlertService],
  // ProcessingOutboxService: the services that save a petition, an incident or a case write one request in their own
  // transaction (`enqueue`); nothing else of this module is theirs to call.
  // RecordListAlertService: the alert column of the three lists.
  exports: [RecordGateway, WorkingCalendarService, ProcessingFlowsService, ProcessingOutboxService, RecordDeadlineWriter, RecordStepAccessService, RecordListAlertService],
})
export class ProcessingFlowModule {}
