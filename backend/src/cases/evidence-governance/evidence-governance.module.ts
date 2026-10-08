import { Module } from '@nestjs/common';
import { CaseGovernanceFoundationModule } from '../governance/case-governance-foundation.module';
import { CaseEvidenceGovernanceService } from './evidence-governance.service';
import { CaseEvidenceGovernanceController } from './evidence-governance.controller';
import { CaseFieldPolicyModule } from '../governance/case-field-policy.module';
@Module({
  imports: [CaseGovernanceFoundationModule, CaseFieldPolicyModule],
  providers: [CaseEvidenceGovernanceService],
  controllers: [CaseEvidenceGovernanceController],
  exports: [CaseEvidenceGovernanceService],
})
export class CaseEvidenceGovernanceModule {}
