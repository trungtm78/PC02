import { Module } from '@nestjs/common';
import { CaseGovernanceFoundationModule } from './case-governance-foundation.module';
import { CaseFieldSchemaService } from './case-field-schema.service';
@Module({
  imports: [CaseGovernanceFoundationModule],
  providers: [CaseFieldSchemaService],
  exports: [CaseFieldSchemaService],
})
export class CaseFieldPolicyModule {}
