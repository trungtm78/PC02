import { CaseChildAccessModule } from '../case-child-access/case-child-access.module';
import { CaseEvidenceGovernanceModule } from '../cases/evidence-governance/evidence-governance.module';
import { Module } from '@nestjs/common';
import { PetitionsService } from './petitions.service';
import { PetitionsJourneyService } from './petitions-journey.service';
import { PetitionsController } from './petitions.controller';
import { PetitionsBulkController } from './bulk/petitions.bulk.controller';
import { PetitionsBulkService } from './bulk/petitions.bulk.service';
import { AuditModule } from '../audit/audit.module';
import { SettingsModule } from '../settings/settings.module';
import { DeadlineRulesModule } from '../deadline-rules/deadline-rules.module';
import { DocumentNumbersModule } from '../document-numbers/document-numbers.module';
import { DocumentTemplatesModule } from '../document-templates/document-templates.module';

@Module({
  imports: [
    CaseChildAccessModule,
    CaseEvidenceGovernanceModule,
    AuditModule,
    SettingsModule,
    DeadlineRulesModule,
    DocumentNumbersModule,
    DocumentTemplatesModule,
  ],
  providers: [PetitionsService, PetitionsJourneyService, PetitionsBulkService],
  controllers: [PetitionsController, PetitionsBulkController],
  exports: [PetitionsService],
})
export class PetitionsModule {}
