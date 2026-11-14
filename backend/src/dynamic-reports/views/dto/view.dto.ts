import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * Shapes only. What a view may BE (a name, at most 120 characters, a selection that is not empty, criteria and teams
 * that exist) is judged by the service, which answers with a code the screen translates; the bounds here only keep an
 * oversized body out.
 */
const MAX_TEXT = 2_000;
const MAX_KEYS = 5_000;

/** What appears in a custom report. `null` (or leaving it out) = every criterion / every team / no typed title. */
export class ViewDefinitionDto {
  @IsOptional() @IsString() @MaxLength(MAX_TEXT) title?: string | null;
  @IsOptional() @IsBoolean() showFilterLine?: boolean;
  @IsOptional() @IsArray() @ArrayMaxSize(MAX_KEYS) @IsString({ each: true }) itemKeys?: string[] | null;
  @IsOptional() @IsArray() @ArrayMaxSize(MAX_KEYS) @IsString({ each: true }) teamIds?: string[] | null;
  @IsOptional() @IsBoolean() teamColumns?: boolean;
}

export class CreateViewDto extends ViewDefinitionDto {
  @IsOptional() @IsString() @MaxLength(MAX_TEXT) name?: string;
}

/** Only what is sent is changed. `expectedRevision`: the revision the edit was made from. */
export class UpdateViewDto extends CreateViewDto {
  @IsInt() @Min(1) expectedRevision!: number;
}

/** The custom report of one period, for the preview and for the export alike. */
export class CustomReportDto {
  @IsOptional() @IsString() @MaxLength(200) viewId?: string | null;

  @IsOptional() @IsObject() @ValidateNested() @Type(() => ViewDefinitionDto) definition?: ViewDefinitionDto | null;

  // `@IsOptional` lets null through; null means "not given", like leaving the field out.
  @Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
  @IsOptional()
  @IsIn(['SUBMITTED', 'APPROVED', 'ALL_SAVED'])
  mode?: 'SUBMITTED' | 'APPROVED' | 'ALL_SAVED';
}
