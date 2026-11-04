import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SettingsModule } from '../settings/settings.module';
import { LlmAdminController } from './llm-admin.controller';
import { LlmGatewayService } from './llm-gateway.service';
import { LlmKeyService } from './llm-key.service';
import { LlmProvidersService } from './llm-providers.service';
import { LlmProviderFactory } from './provider-factory';

@Module({
  imports: [PrismaModule, AuthModule, AuditModule, SettingsModule],
  controllers: [LlmAdminController],
  providers: [
    LlmKeyService,
    LlmProviderFactory,
    LlmProvidersService,
    LlmGatewayService,
  ],
  exports: [LlmProvidersService, LlmKeyService, LlmGatewayService],
})
export class LlmModule {}
