import { Type } from 'class-transformer';
import type { WardMatchSource } from '@prisma/client';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min, ValidateIf } from 'class-validator';

/** Shapes only; the rules are the services'. */

export class WardStatsQueryDto {
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) from?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) to?: string;
  @IsOptional() @IsString() @MaxLength(100) teamId?: string;
  @IsOptional() @IsString() @MaxLength(100) crimeId?: string;
  @IsOptional() @IsIn(['INCIDENT', 'CASE']) caseType?: 'INCIDENT' | 'CASE';
}

export class WardMatchPreviewQuery {
  @IsIn(['WARD_ASSIGNMENT', 'PETITION', 'CASE', 'INCIDENT']) source!: WardMatchSource;
  @IsString() @MaxLength(100) recordId!: string;
}

export class WardMatchConclusionDto {
  @Type(() => Number) @IsInt() @Min(1) subjectPosition!: number;
  @IsIn(['WARD_ASSIGNMENT', 'PETITION', 'INCIDENT', 'CASE']) otherSource!: 'WARD_ASSIGNMENT' | 'PETITION' | 'INCIDENT' | 'CASE';
  @IsString() @MaxLength(100) otherRecordId!: string;
  /** "Cùng người" (true) or "khác người" (false). */
  @ValidateIf((o: WardMatchConclusionDto) => o.sameperson === undefined) @IsBoolean() samePerson?: boolean;
  /** The spelling of the contract of 16/11/2026, accepted as well. */
  @IsOptional() @IsBoolean() sameperson?: boolean;
}
