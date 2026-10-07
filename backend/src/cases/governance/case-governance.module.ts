import { Module } from '@nestjs/common';
import { CaseGovernanceController } from './case-governance.controller';
import { CaseGovernanceFoundationModule } from './case-governance-foundation.module';
import { CaseEvidenceGovernanceModule } from '../evidence-governance/evidence-governance.module';
import { DocumentNumbersModule } from '../../document-numbers/document-numbers.module';
import { LegalWorkflowService } from './legal-workflow.service';
import { CaseConfigurationService } from './case-configuration.service';
import { CaseFieldPolicyModule } from './case-field-policy.module';
import { CaseOperationsService } from './case-operations.service';
import { CaseOutboxWorker } from './case-outbox.worker';
import {
  CaseLegalWorkflowController,
  CaseConfigurationController,
  CaseFieldSchemaController,
} from './legal-workflow.controller';
import { CaseOperationsController } from './case-operations.controller';
import { CasePrincipalAccessService } from './case-principal-access.service';
import { CasePrincipalAccessController } from './case-principal-access.controller';
import { CaseGlobalCapabilitiesController } from './case-global-capabilities.controller';
@Module({
  imports: [
    DocumentNumbersModule,
    CaseGovernanceFoundationModule,
    CaseEvidenceGovernanceModule,
    CaseFieldPolicyModule,
  ],
  providers: [
    CasePrincipalAccessService,
    LegalWorkflowService,
    CaseConfigurationService,
    CaseOperationsService,
    CaseOutboxWorker,
  ],
  controllers: [
    CaseGlobalCapabilitiesController,
    CasePrincipalAccessController,
    CaseGovernanceController,
    CaseLegalWorkflowController,
    CaseConfigurationController,
    CaseFieldSchemaController,
    CaseOperationsController,
  ],
  exports: [
    CaseGovernanceFoundationModule,
    LegalWorkflowService,
    CaseFieldPolicyModule,
    CaseOperationsService,
  ],
})
export class CaseGovernanceModule {}
