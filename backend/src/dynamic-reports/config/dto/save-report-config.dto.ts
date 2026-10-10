import { Transform, Type, plainToInstance } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { IsNgayThat } from '../../../common/validators/is-ngay-that.validator';

const FIELD_TYPES = ['NUM', 'TEXT', 'DATE', 'TIME'] as const;
const AGGREGATE_TYPES = ['SUM', 'AVG', 'MIN', 'MAX', 'COUNT', 'NONE'] as const;
const BLANK_POLICIES = ['ZERO', 'IGNORE'] as const;
const FIELD_SOURCES = ['TOKEN', 'WEB'] as const;
const PERIOD_TYPES = [
  'DAILY',
  'WEEKLY',
  'MONTHLY',
  'QUARTERLY',
  'SEMI_ANNUAL',
  'YEARLY',
  'ONE_TIME',
] as const;
const ROLE_TYPES = ['MANAGER', 'VIEWER'] as const;
const REPORTING_UNITS = ['TEAM', 'USER'] as const;

export class ReportFieldConfigDto {
  @IsString() @IsNotEmpty() sheetKey!: string;
  @IsString() @IsNotEmpty() address!: string;
  @IsString() @IsNotEmpty() fieldKey!: string;
  @IsString() @IsNotEmpty() label!: string;
  @IsIn(FIELD_TYPES) type!: (typeof FIELD_TYPES)[number];
  @IsOptional() @IsString() format?: string;
  @IsIn(AGGREGATE_TYPES) aggregate!: (typeof AGGREGATE_TYPES)[number];
  @IsOptional()
  @IsIn(BLANK_POLICIES)
  blankPolicy?: (typeof BLANK_POLICIES)[number];
  @IsOptional() @IsBoolean() required?: boolean;
  @IsOptional() @IsInt() scale?: number;
  @IsOptional() @IsInt() maxLength?: number;
  @IsOptional() @IsString() helpText?: string;
  @IsIn(FIELD_SOURCES) source!: (typeof FIELD_SOURCES)[number];
}

export class ReportScheduleConfigDto {
  @IsIn(PERIOD_TYPES) periodType!: (typeof PERIOD_TYPES)[number];
  @IsOptional() @IsInt() @Min(1) @Max(31) periodStartDay?: number;
  @IsObject() dueRule!: Record<string, unknown>;
  @IsObject() openRule!: Record<string, unknown>;
  @IsOptional() @IsBoolean() shiftNonWorking?: boolean;
  @IsOptional() @IsString() oneTimeDate?: string;
  @IsOptional() @IsString() timezone?: string;
}

export class ReportRoleConfigDto {
  @IsString() @IsNotEmpty() userId!: string;
  @IsIn(ROLE_TYPES) role!: (typeof ROLE_TYPES)[number];
  @IsOptional() @IsString() teamScopeId?: string;
}

export class ReportTargetConfigDto {
  @IsString() @IsNotEmpty() teamId!: string;
  @IsArray() @IsString({ each: true }) editorUserIds!: string[];
}

/**
 * S09/S10 publish/save-draft payload (spec §6.1 PR4 bước 4/4). Multipart
 * body: this DTO's fields travel as a JSON string in the `config` field
 * (same convention as `PreviewTemplateDto.selectedSheets`), the template
 * file travels as the `file` part — the wizard still holds the exact same
 * File object it uploaded back in S02, so no re-fetch is needed.
 */
export class SaveReportConfigDto {
  @IsString() @IsNotEmpty() code!: string;
  @IsString() @IsNotEmpty() name!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional()
  @IsIn(REPORTING_UNITS)
  reportingUnit?: (typeof REPORTING_UNITS)[number];

  @IsArray() @IsString({ each: true }) selectedSheets!: string[];
  @IsIn(['1900', '1904']) dateSystem!: '1900' | '1904';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReportFieldConfigDto)
  fields!: ReportFieldConfigDto[];

  @ValidateNested()
  @Type(() => ReportScheduleConfigDto)
  schedule!: ReportScheduleConfigDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReportRoleConfigDto)
  roles!: ReportRoleConfigDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReportTargetConfigDto)
  targets!: ReportTargetConfigDto[];

  @IsNgayThat() effectiveFrom!: string;
  @IsBoolean() publish!: boolean;
  @IsString() @IsNotEmpty() idempotencyKey!: string;
}

/**
 * Multipart wrapper DTO — the controller's actual `@Body()` shape.
 *
 * `@Transform` here does double duty (parse the JSON string AND
 * instantiate the nested class via `plainToInstance`) because a
 * `@Transform` on a property fully replaces class-transformer's handling
 * of it — a sibling `@Type(() => SaveReportConfigDto)` would never run,
 * leaving `@ValidateNested()` a plain object with no validation metadata
 * to recurse into (observed directly: class-validator's "unknownValue"
 * error on the nested value).
 */
export class SaveReportConfigRequestDto {
  @Transform(({ value }: { value: unknown }) => {
    const raw = typeof value === 'string' ? safeJsonParse(value) : value;
    return plainToInstance(SaveReportConfigDto, raw);
  })
  @ValidateNested()
  config!: SaveReportConfigDto;
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
