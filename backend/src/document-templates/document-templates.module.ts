import { Module } from '@nestjs/common';
import { DocxTemplateLoaderService } from './docx-loader.service';
import { XlsxTemplateLoaderService } from './xlsx-loader.service';

@Module({
  providers: [DocxTemplateLoaderService, XlsxTemplateLoaderService],
  exports: [DocxTemplateLoaderService, XlsxTemplateLoaderService],
})
export class DocumentTemplatesModule {}
