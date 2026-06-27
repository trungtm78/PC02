import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';
import { DOCUMENT_TYPES } from '../../document-templates/docx-loader.service';

/**
 * Body cho POST /petitions/:id/export-documents.
 * Validate shape ở ValidationPipe; dedupe + default mode làm ở
 * validateExportDocumentsRequest (service) — xem petition-export-documents.validate.ts.
 */
export class ExportDocumentsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @IsIn(DOCUMENT_TYPES as unknown as readonly string[], { each: true })
  docTypes!: string[];

  @IsOptional()
  @IsIn(['merged', 'zip'])
  mode?: 'merged' | 'zip';
}
