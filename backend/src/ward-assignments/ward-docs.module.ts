import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { DocumentNumbersModule } from '../document-numbers/document-numbers.module';
import { DocumentTemplatesModule } from '../document-templates/document-templates.module';
import { DocumentsModule } from '../documents/documents.module';
import { PrismaModule } from '../prisma/prisma.module';
import { WardDocsController } from './ward-docs.controller';
import { WardFilesService } from './ward-files.service';
import { WardSlipService } from './ward-slip.service';

/** The result files and the request slips of the ward assignment requests (imported by `WardAssignmentsModule`). */
@Module({
  imports: [PrismaModule, AuthModule, AuditModule, DocumentNumbersModule, DocumentTemplatesModule, DocumentsModule],
  controllers: [WardDocsController],
  providers: [WardFilesService, WardSlipService],
})
export class WardDocsModule {}
