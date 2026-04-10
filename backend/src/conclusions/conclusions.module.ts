import { Module } from '@nestjs/common';
import { ConclusionsController } from './conclusions.controller';
import { ConclusionsService } from './conclusions.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, AuthModule, AuditModule],
  controllers: [ConclusionsController],
  providers: [ConclusionsService],
})
export class ConclusionsModule {}
