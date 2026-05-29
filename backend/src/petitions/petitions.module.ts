import { Module } from '@nestjs/common';
import { PetitionsService } from './petitions.service';
import { PetitionsJourneyService } from './petitions-journey.service';
import { PetitionsController } from './petitions.controller';
import { PetitionsBulkController } from './bulk/petitions.bulk.controller';
import { PetitionsBulkService } from './bulk/petitions.bulk.service';
import { DocumentExportService } from './document-export.service';
import { BatchExportService } from './batch-export.service';
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
  providers: [
    PetitionsService,
    PetitionsJourneyService,
    DocumentExportService,
    BatchExportService,
    PetitionsBulkService,
  ],
  controllers: [PetitionsController, PetitionsBulkController],
  exports: [PetitionsService],
})
export class PetitionsModule {}
