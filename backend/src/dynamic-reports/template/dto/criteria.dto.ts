import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { CRITERIA_LIMITS } from '../criteria-workbook';

const COLUMN = /^[A-Z]{1,3}$/;
const ITEM_KEY = /^[a-z0-9][a-z0-9._-]{0,79}$/;

/** A multipart text part that carries JSON; a parse failure is left as text so validation refuses it. */
function fromJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/** Where the author picked the criteria in the uploaded file. */
export class CriteriaSelectionDto {
  @IsString() @IsNotEmpty() @MaxLength(100) sheet!: string;
  @Matches(COLUMN) column!: string;

  /** 1-based rows picked in that column; absent = the whole column. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => fromJson(value))
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(CRITERIA_LIMITS.MAX_SCAN_ROWS)
  @IsInt({ each: true })
  @Min(1, { each: true })
  rows?: number[];

  @IsOptional() @Matches(COLUMN) codeColumn?: string;
  @IsOptional() @Matches(COLUMN) unitColumn?: string;
  @IsOptional() @IsIn(['NONE', 'INDENT', 'NUMBERING']) hierarchy?: 'NONE' | 'INDENT' | 'NUMBERING';
}

export class CriterionDraftDto {
  @IsOptional() @Matches(ITEM_KEY) itemKey?: string;
  @IsOptional() @IsString() @MaxLength(CRITERIA_LIMITS.MAX_SHORT_LENGTH) code?: string;
  @IsString() @IsNotEmpty() @MaxLength(CRITERIA_LIMITS.MAX_NAME_LENGTH) name!: string;
  @IsOptional() @IsString() @MaxLength(CRITERIA_LIMITS.MAX_SHORT_LENGTH) unit?: string;
  @IsOptional() @Matches(ITEM_KEY) parentItemKey?: string;
  @IsOptional() @IsIn(['FILE', 'MANUAL']) origin?: 'FILE' | 'MANUAL';
  @IsOptional() @IsInt() @Min(1) sourceRow?: number;
}

/** The list the author ended with (picked from the file, edited, plus hand-typed ones), in row order. */
export class BuildCriteriaWorkbookDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(CRITERIA_LIMITS.MAX_CRITERIA)
  @ValidateNested({ each: true })
  @Type(() => CriterionDraftDto)
  criteria!: CriterionDraftDto[];
}
