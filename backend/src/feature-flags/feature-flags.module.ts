import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { FeatureFlagsService } from './feature-flags.service';
import { FeatureFlagsController } from './feature-flags.controller';
import { FeatureFlagGuard } from './guards/feature-flag.guard';
import { JwtModule } from '@nestjs/jwt';
import { AuditModule } from '../audit/audit.module';

@Global()
@Module({
  // AuditModule is imported, not assumed. It was left out and AuditService was
  // injected @Optional() as a hedge against a circular graph — but sibling
  // modules do not share providers, so the hedge meant the dependency was
  // ALWAYS undefined and every flag change committed with no audit trail at
  // all. There is no cycle: AuditModule pulls in nothing from here.
  // JwtModule: `FeatureFlagGuard` tự xác thực bearer token thay vì đọc
  // `request.user` (ADR-0018). Đây là module của `@nestjs/jwt`, KHÔNG phải
  // `AuthModule` của dự án — nên không tạo phụ thuộc vòng. Đăng ký rỗng vì mỗi
  // lần verify truyền `publicKey` tường minh.
  imports: [AuditModule, JwtModule.register({})],
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
