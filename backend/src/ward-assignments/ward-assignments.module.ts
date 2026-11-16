import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { DocumentNumbersModule } from '../document-numbers/document-numbers.module';
import { PrismaModule } from '../prisma/prisma.module';
import { WardAssignmentCommandService } from './ward-assignment-command.service';
import { WardAssignmentQueryService } from './ward-assignment-query.service';
import { WardAssignmentsController, WardInvestigatorsController } from './ward-assignments.controller';
import { WardInvestigatorsService } from './ward-investigators.service';

@Module({
  imports: [PrismaModule, AuthModule, AuditModule, DocumentNumbersModule],
  controllers: [WardAssignmentsController, WardInvestigatorsController],
  providers: [WardAssignmentCommandService, WardAssignmentQueryService, WardInvestigatorsService],
  exports: [WardAssignmentQueryService],
})
export class WardAssignmentsModule {}
