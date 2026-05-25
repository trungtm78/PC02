import { Module } from '@nestjs/common';
import { DelegationsController } from './delegations.controller';
import { DelegationsService } from './delegations.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { DocumentNumbersModule } from '../document-numbers/document-numbers.module';

@Module({
  imports: [PrismaModule, AuthModule, AuditModule, DocumentNumbersModule],
  controllers: [DelegationsController],
  providers: [DelegationsService],
})
export class DelegationsModule {}
