import { Transform, Type, plainToInstance } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ReportFieldConfigDto, ReportRuleConfigDto } from './save-report-config.dto';

/**
 * "Cập nhật mẫu" — a new version of an existing report: a new template file, the cells marked on it, and the
 * rules checked against them. Everything else about the report (schedule, managers, teams) is untouched; those
 * have their own edit. Same multipart convention as `SaveReportConfigRequestDto`: this travels as the JSON
 * string `config`, the file as `file`.
 */
export class SaveReportVersionDto {
  @IsArray() @IsString({ each: true }) selectedSheets!: string[];
  @IsIn(['1900', '1904']) dateSystem!: '1900' | '1904';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReportFieldConfigDto)
  fields!: ReportFieldConfigDto[];

  /** Passed through like in the first publish; a published version stores what the FILE says instead (OV3). */
  @IsObject() layout!: Record<string, unknown>;
  @IsArray() formulas!: Record<string, unknown>[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReportRuleConfigDto)
  rules?: ReportRuleConfigDto[];

  /** true: publish and apply (D09); false: keep as a draft the author can come back to. */
  @IsBoolean() publish!: boolean;
  @IsString() @IsNotEmpty() idempotencyKey!: string;
}

export class SaveReportVersionRequestDto {
  @Transform(({ value }: { value: unknown }) => {
    let raw: unknown = value;
    if (typeof value === 'string') {
      try {
        raw = JSON.parse(value);
      } catch {
        raw = value;
      }
    }
    return plainToInstance(SaveReportVersionDto, raw);
  })
  @ValidateNested()
  config!: SaveReportVersionDto;
}
