import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsString,
  MaxLength,
} from 'class-validator';

export const OCR_ENTITIES = ['PETITION', 'INCIDENT', 'CASE'] as const;
export type OcrEntityName = (typeof OCR_ENTITIES)[number];

/** A transcript is a few pages of text; this bound only stops an absurd request. */
export const MAX_TRANSCRIPT_CHARS = 200_000;
export const MAX_PAGE_IDS = 100;

export class OpenSessionDto {
  @IsIn(OCR_ENTITIES)
  entity!: OcrEntityName;
}

export class StartRereadDto {
  @IsIn(OCR_ENTITIES)
  entity!: OcrEntityName;

  @IsString()
  @MaxLength(64)
  recordId!: string;
}

export class ReorderPagesDto {
  @IsArray()
  @ArrayMaxSize(MAX_PAGE_IDS)
  @IsString({ each: true })
  pageIds!: string[];
}

export class SaveTranscriptDto {
  @IsString()
  @MaxLength(MAX_TRANSCRIPT_CHARS)
  text!: string;
}

export class RequestReadDto {
  /** READ: read the scans, then analyse. ANALYSE: analyse the text as it stands (after a correction). */
  @IsIn(['READ', 'ANALYSE'])
  mode!: 'READ' | 'ANALYSE';
}
