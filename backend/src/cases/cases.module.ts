import { Module } from '@nestjs/common';
import { CasesService } from './cases.service';
import { CaseGovernanceModule } from './governance/case-governance.module';
import { CaseEvidenceGovernanceModule } from './evidence-governance/evidence-governance.module';
import { CasesJourneyService } from './cases-journey.service';
import { CasesController } from './cases.controller';
import { CasesBulkController } from './bulk/cases.bulk.controller';
import { CasesBulkService } from './bulk/cases.bulk.service';
import { AuditModule } from '../audit/audit.module';
import { SettingsModule } from '../settings/settings.module';
import { DocumentNumbersModule } from '../document-numbers/document-numbers.module';
import { DocumentTemplatesModule } from '../document-templates/document-templates.module';
import { CaseChildAccessModule } from '../case-child-access/case-child-access.module';

@Module({
  imports: [
    CaseGovernanceModule,
    CaseEvidenceGovernanceModule,
    AuditModule,
    SettingsModule,
    DocumentNumbersModule,
    DocumentTemplatesModule,
    CaseChildAccessModule,
  ], // v0.69: DocumentTemplatesModule (xuất chứng từ động)
  providers: [CasesService, CasesJourneyService, CasesBulkService],
  controllers: [CasesController, CasesBulkController],
  exports: [CasesService, CasesJourneyService],
})
export class CasesModule {}
