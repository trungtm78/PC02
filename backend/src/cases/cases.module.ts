import { Module } from '@nestjs/common';
import { CasesService } from './cases.service';
import { CasesJourneyService } from './cases-journey.service';
import { CasesController } from './cases.controller';
import { CasesBulkController } from './bulk/cases.bulk.controller';
import { CasesBulkService } from './bulk/cases.bulk.service';
import { AuditModule } from '../audit/audit.module';
import { SettingsModule } from '../settings/settings.module';
import { DocumentNumbersModule } from '../document-numbers/document-numbers.module';
import { DocumentTemplatesModule } from '../document-templates/document-templates.module';

@Module({
  imports: [AuditModule, SettingsModule, DocumentNumbersModule, DocumentTemplatesModule], // v0.69: DocumentTemplatesModule (xuất chứng từ động)
  providers: [CasesService, CasesJourneyService, CasesBulkService],
  controllers: [CasesController, CasesBulkController],
  exports: [CasesService, CasesJourneyService],
})
export class CasesModule {}
