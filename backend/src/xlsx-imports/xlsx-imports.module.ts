import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { XlsxImportsController } from './xlsx-imports.controller';
import { XlsxImportsService } from './xlsx-imports.service';
import { XlsxParserService } from './xlsx-parser.service';
import { UploadStorageService } from './upload-storage.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [XlsxImportsController],
  providers: [XlsxImportsService, XlsxParserService, UploadStorageService],
  exports: [XlsxImportsService],
})
export class XlsxImportsModule {}
