import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { FeatureFlagsService } from './feature-flags.service';
import { FeatureFlagsController } from './feature-flags.controller';
import { FeatureFlagGuard } from './guards/feature-flag.guard';
import { AuditModule } from '../audit/audit.module';

@Global()
@Module({
  // AuditModule is imported, not assumed. It was left out and AuditService was
  // injected @Optional() as a hedge against a circular graph — but sibling
  // modules do not share providers, so the hedge meant the dependency was
  // ALWAYS undefined and every flag change committed with no audit trail at
  // all. There is no cycle: AuditModule pulls in nothing from here.
  imports: [AuditModule],
  providers: [
    FeatureFlagsService,
    {
      provide: APP_GUARD,
      useClass: FeatureFlagGuard,
    },
  ],
  controllers: [FeatureFlagsController],
  exports: [FeatureFlagsService],
})
export class FeatureFlagsModule {}
