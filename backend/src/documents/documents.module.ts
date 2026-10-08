import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { AuditModule } from '../audit/audit.module';
import { CatalogModule } from '../catalog/catalog.module';
import { CaseGovernanceFoundationModule } from '../cases/governance/case-governance-foundation.module';
import { CaseEvidenceGovernanceModule } from '../cases/evidence-governance/evidence-governance.module';

@Module({
  imports: [
    AuditModule,
    CatalogModule,
    CaseGovernanceFoundationModule,
    CaseEvidenceGovernanceModule,
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
