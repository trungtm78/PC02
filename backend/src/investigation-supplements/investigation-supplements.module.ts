import { Module } from '@nestjs/common';
import { InvestigationSupplementsController } from './investigation-supplements.controller';
import { InvestigationSupplementsService } from './investigation-supplements.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, AuthModule, AuditModule],
  controllers: [InvestigationSupplementsController],
  providers: [InvestigationSupplementsService],
  exports: [InvestigationSupplementsService],
})
export class InvestigationSupplementsModule {}
