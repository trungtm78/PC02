import { Module } from '@nestjs/common';
import { IncidentsService } from './incidents.service';
import { IncidentsJourneyService } from './incidents-journey.service';
import { IncidentsController } from './incidents.controller';
import { AuditModule } from '../audit/audit.module';
import { SettingsModule } from '../settings/settings.module';
import { DeadlineRulesModule } from '../deadline-rules/deadline-rules.module';
import { DocumentNumbersModule } from '../document-numbers/document-numbers.module';

@Module({
  imports: [AuditModule, SettingsModule, DeadlineRulesModule, DocumentNumbersModule],
  controllers: [IncidentsController],
  providers: [IncidentsService, IncidentsJourneyService],
  exports: [IncidentsService],
})
export class IncidentsModule {}
