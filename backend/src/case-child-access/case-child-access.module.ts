import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CaseGovernanceFoundationModule } from '../cases/governance/case-governance-foundation.module';
import { CaseChildAccessService } from './case-child-access.service';
import { CaseSourceCreationService } from './case-source-creation.service';
import { CaseFieldPolicyModule } from '../cases/governance/case-field-policy.module';
import { CaseGraphPolicyInterceptor } from './case-graph.interceptor';
@Module({
  imports: [
    PrismaModule,
    CaseGovernanceFoundationModule,
    CaseFieldPolicyModule,
  ],
  providers: [
    CaseChildAccessService,
    CaseSourceCreationService,
    CaseGraphPolicyInterceptor,
  ],
  exports: [
    CaseChildAccessService,
    CaseSourceCreationService,
    CaseGraphPolicyInterceptor,
  ],
})
export class CaseChildAccessModule {}
