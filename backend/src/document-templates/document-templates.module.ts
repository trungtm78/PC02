import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DocumentNumbersModule } from '../document-numbers/document-numbers.module';
import { DocxMergeService } from '../petitions/docx-merge.service';
import { DocxTemplateLoaderService } from './docx-loader.service';
import { XlsxTemplateLoaderService } from './xlsx-loader.service';
import { DocumentTemplatesController } from './document-templates.controller';
import { DocumentTemplatesService } from './document-templates.service';
import { DynamicExportService } from './dynamic-export.service';

/**
 * Module template chứng từ:
 *  - DocxTemplateLoader/XlsxTemplateLoader: loader 7 mẫu đơn thư hardcode (giữ nguyên).
 *  - DocumentTemplatesController/Service: quản lý template ĐỘNG (.docx lưu DB) cho vụ việc/vụ án.
 *  - DynamicExportService: render+xuất chứng từ động (cases/incidents inject service này).
 *  DocxMergeService provide tại đây (stateless, file-import — tránh circular với PetitionsModule).
 */
@Module({
  imports: [PrismaModule, DocumentNumbersModule],
  controllers: [DocumentTemplatesController],
  providers: [
    DocxTemplateLoaderService,
    XlsxTemplateLoaderService,
    DocumentTemplatesService,
    DocxMergeService,
    DynamicExportService,
  ],
  exports: [
    DocxTemplateLoaderService,
    XlsxTemplateLoaderService,
    DocumentTemplatesService,
    DynamicExportService,
  ],
})
export class DocumentTemplatesModule {}
