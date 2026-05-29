import { Module } from '@nestjs/common';
import { DocxTemplateLoaderService } from './docx-loader.service';

@Module({
  providers: [DocxTemplateLoaderService],
  exports: [DocxTemplateLoaderService],
})
export class DocumentTemplatesModule {}
