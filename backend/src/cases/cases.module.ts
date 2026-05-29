import { Module } from '@nestjs/common';
import { CasesService } from './cases.service';
import { CasesJourneyService } from './cases-journey.service';
import { CasesController } from './cases.controller';
import { CasesBulkController } from './bulk/cases.bulk.controller';
import { CasesBulkService } from './bulk/cases.bulk.service';
import { AuditModule } from '../audit/audit.module';
import { SettingsModule } from '../settings/settings.module';
import { DocumentNumbersModule } from '../document-numbers/document-numbers.module';

@Module({
  imports: [AuditModule, SettingsModule, DocumentNumbersModule], // v0.31.0.2: SettingsModule; v0.42: DocumentNumbersModule
  providers: [CasesService, CasesJourneyService, CasesBulkService],
  controllers: [CasesController, CasesBulkController],
  exports: [CasesService, CasesJourneyService],
})
export class CasesModule {}
