import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { CaseGovernanceFoundationModule } from '../cases/governance/case-governance-foundation.module';
import { CaseFieldPolicyModule } from '../cases/governance/case-field-policy.module';
import { CaseAuditPolicyService } from './case-audit-policy.service';

@Module({
  imports: [CaseGovernanceFoundationModule, CaseFieldPolicyModule],
  providers: [AuditService, CaseAuditPolicyService],
  controllers: [AuditController],
  exports: [AuditService],
})
export class AuditModule {}
