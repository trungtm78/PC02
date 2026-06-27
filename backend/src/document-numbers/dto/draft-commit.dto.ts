import { IsString, IsOptional, IsIn } from 'class-validator';

const ALLOWED_DOCUMENT_TYPES = ['CASE', 'INCIDENT', 'PETITION', 'PROPOSAL', 'DELEGATION', 'EVIDENCE', 'UTDT'] as const;

export class DraftNumberDto {
  @IsString()
  @IsIn(ALLOWED_DOCUMENT_TYPES)
  documentType: string;
}

export class CommitNumberDto {
  @IsString()
  @IsIn(ALLOWED_DOCUMENT_TYPES)
  documentType: string;

  @IsOptional()
  @IsString()
  documentId?: string;

  @IsOptional()
  @IsString()
  draftPreview?: string;
}
