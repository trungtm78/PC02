import { Module } from '@nestjs/common';
import { CaseGovernanceService } from './case-governance.service';
@Module({
  providers: [CaseGovernanceService],
  exports: [CaseGovernanceService],
})
export class CaseGovernanceFoundationModule {}
