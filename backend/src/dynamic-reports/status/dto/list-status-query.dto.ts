import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

const SUBMISSION_STATES = [
  'NOT_STARTED',
  'DRAFT',
  'SUBMITTED',
  'RETURNED',
  'APPROVED',
] as const;

function toBoolean(value: unknown): boolean | undefined {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

/** S19 (spec §6.1 PR8) — every filter is optional; an absent query param means "don't filter on this". */
export class ListStatusQueryDto {
  @IsOptional()
  @IsString()
  reportId?: string;

  @IsOptional()
  @IsString()
  periodId?: string;

  @IsOptional()
  @IsString()
  teamId?: string;

  @IsOptional()
  @IsIn(SUBMISSION_STATES)
  state?: (typeof SUBMISSION_STATES)[number];

  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  overdue?: boolean;

  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  reopened?: boolean;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  page?: number;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  pageSize?: number;
}

/** S19 "Xuất" — same filters as `ListStatusQueryDto`, no pagination, plus the output format. */
export class ExportStatusQueryDto {
  @IsOptional()
  @IsString()
  reportId?: string;

  @IsOptional()
  @IsString()
  periodId?: string;

  @IsOptional()
  @IsString()
  teamId?: string;

  @IsOptional()
  @IsIn(SUBMISSION_STATES)
  state?: (typeof SUBMISSION_STATES)[number];

  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  overdue?: boolean;

  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  reopened?: boolean;

  @IsOptional()
  @IsIn(['csv', 'xlsx'])
  format?: 'csv' | 'xlsx';
}

/** S20 ma trận — `reportId` bắt buộc (ma trận luôn soi đúng MỘT báo cáo). */
export class StatusMatrixQueryDto {
  @IsNotEmpty()
  @IsString()
  reportId!: string;
}
