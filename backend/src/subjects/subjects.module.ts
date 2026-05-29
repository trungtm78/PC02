import { Module } from '@nestjs/common';
import { SubjectsController } from './subjects.controller';
import { SubjectsService } from './subjects.service';
import { SubjectsBulkController } from './bulk/subjects.bulk.controller';
import { SubjectsBulkService } from './bulk/subjects.bulk.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [SubjectsController, SubjectsBulkController],
  providers: [SubjectsService, SubjectsBulkService],
  exports: [SubjectsService],
})
export class SubjectsModule {}
