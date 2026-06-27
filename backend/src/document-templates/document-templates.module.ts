import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DocxTemplateLoaderService } from './docx-loader.service';
import { XlsxTemplateLoaderService } from './xlsx-loader.service';
import { DocumentTemplatesController } from './document-templates.controller';
import { DocumentTemplatesService } from './document-templates.service';

/**
 * Module template chứng từ:
 *  - DocxTemplateLoader/XlsxTemplateLoader: loader 7 mẫu đơn thư hardcode (giữ nguyên).
 *  - DocumentTemplatesController/Service: quản lý template ĐỘNG (.docx lưu DB) cho vụ việc/vụ án.
 */
@Module({
  imports: [PrismaModule],
  controllers: [DocumentTemplatesController],
  providers: [DocxTemplateLoaderService, XlsxTemplateLoaderService, DocumentTemplatesService],
  exports: [DocxTemplateLoaderService, XlsxTemplateLoaderService, DocumentTemplatesService],
})
export class DocumentTemplatesModule {}
