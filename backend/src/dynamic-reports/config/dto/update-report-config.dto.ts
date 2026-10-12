import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  ReportRoleConfigDto,
  ReportScheduleConfigDto,
  ReportTargetConfigDto,
} from './save-report-config.dto';

/**
 * "Sửa cấu hình" — what can change on a report after it exists, without a new template: its name and description,
 * its schedule, who manages it, and which teams submit through whom. Every part is optional (send only what
 * changed); `expectedConfigVersion` is the revision the screen was looking at, so two people editing at once cannot
 * silently overwrite each other (409).
 *
 * Roles and targets are the WHOLE list as it should be afterwards, not a delta: the screen shows a list, the person
 * edits the list, the list is what is sent.
 */
export class UpdateReportConfigDto {
  @IsInt() @Min(0) expectedConfigVersion!: number;

  @IsOptional() @IsString() @IsNotEmpty() name?: string;

  /** An empty string clears the description. */
  @IsOptional() @IsString() description?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ReportScheduleConfigDto)
  schedule?: ReportScheduleConfigDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReportRoleConfigDto)
  roles?: ReportRoleConfigDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReportTargetConfigDto)
  targets?: ReportTargetConfigDto[];
}
