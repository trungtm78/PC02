import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ProcessingFlowModule } from '../processing-flow/processing-flow.module';
import { XlsxImportsController } from './xlsx-imports.controller';
import { XlsxImportsService } from './xlsx-imports.service';
import { XlsxParserService } from './xlsx-parser.service';
import { UploadStorageService } from './upload-storage.service';
import { XlsxImportCommitService } from './commit.service';

@Module({
  imports: [PrismaModule, AuthModule, ProcessingFlowModule],
  controllers: [XlsxImportsController],
  providers: [XlsxImportsService, XlsxParserService, UploadStorageService, XlsxImportCommitService],
  exports: [XlsxImportsService, XlsxImportCommitService],
})
export class XlsxImportsModule {}
