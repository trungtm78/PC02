import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DocumentNumbersModule } from '../document-numbers/document-numbers.module';
import { DocxMergeService } from '../petitions/docx-merge.service';
import { XlsxTemplateLoaderService } from './xlsx-loader.service';
import { DocumentTemplatesController } from './document-templates.controller';
import { DocumentTemplatesService } from './document-templates.service';
import { DynamicExportService } from './dynamic-export.service';

/**
 * Module template chứng từ:
 *  - XlsxTemplateLoader: loader 6 mẫu xlsx báo cáo Phụ lục (giữ nguyên).
 *  - DocumentTemplatesController/Service: quản lý template ĐỘNG (.docx lưu DB) cho mọi thực thể.
 *  - DynamicExportService: render+xuất chứng từ động (cases/incidents/petitions inject service này).
 *  DocxMergeService provide tại đây (stateless, file-import — tránh circular với PetitionsModule).
 */
@Module({
  imports: [PrismaModule, DocumentNumbersModule],
  controllers: [DocumentTemplatesController],
  providers: [
    XlsxTemplateLoaderService,
    DocumentTemplatesService,
    DocxMergeService,
    DynamicExportService,
  ],
  exports: [
    XlsxTemplateLoaderService,
    DocumentTemplatesService,
    DynamicExportService,
  ],
})
export class DocumentTemplatesModule {}
