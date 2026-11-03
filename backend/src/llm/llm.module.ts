import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { LlmAdminController } from './llm-admin.controller';
import { LlmKeyService } from './llm-key.service';
import { LlmProvidersService } from './llm-providers.service';
import { LlmProviderFactory } from './provider-factory';

@Module({
  imports: [PrismaModule, AuthModule, AuditModule],
  controllers: [LlmAdminController],
  providers: [LlmKeyService, LlmProviderFactory, LlmProvidersService],
  exports: [LlmProvidersService, LlmKeyService],
})
export class LlmModule {}
