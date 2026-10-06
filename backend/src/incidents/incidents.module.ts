import { Module } from '@nestjs/common';
import { IncidentsService } from './incidents.service';
import { IncidentsHandoffService } from './incidents-handoff.service';
import { IncidentsHandoffController } from './incidents-handoff.controller';
import { IncidentsJourneyService } from './incidents-journey.service';
import { IncidentsController } from './incidents.controller';
import { IncidentsBulkController } from './bulk/incidents.bulk.controller';
import { IncidentsBulkService } from './bulk/incidents.bulk.service';
import { AuditModule } from '../audit/audit.module';
import { SettingsModule } from '../settings/settings.module';
import { DeadlineRulesModule } from '../deadline-rules/deadline-rules.module';
import { DocumentNumbersModule } from '../document-numbers/document-numbers.module';
import { DocumentTemplatesModule } from '../document-templates/document-templates.module';

@Module({
  imports: [
    AuditModule,
    SettingsModule,
    DeadlineRulesModule,
    DocumentNumbersModule,
    DocumentTemplatesModule,
  ],
  controllers: [
    IncidentsController,
    IncidentsHandoffController,
    IncidentsBulkController,
  ],
  providers: [
    IncidentsService,
    IncidentsJourneyService,
    IncidentsBulkService,
    IncidentsHandoffService,
  ],
  exports: [IncidentsService],
})
export class IncidentsModule {}
