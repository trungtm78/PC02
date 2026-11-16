import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { IsNgayThat } from '../../common/validators/is-ngay-that.validator';

/**
 * Shapes only. Every rule (who may, in which state, what must be filled in) is the service's, which answers with a
 * code the screen translates.
 */

export class WardSubjectDto {
  @IsString() @MaxLength(200) fullName!: string;
  @IsOptional() @IsInt() birthYear?: number | null;
  @IsOptional() @IsString() @MaxLength(50) idNumber?: string | null;
  @IsOptional() @IsString() @MaxLength(500) address?: string | null;
}

export class WardAssignmentContentDto {
  @IsIn(['INCIDENT', 'CASE']) caseType!: 'INCIDENT' | 'CASE';
  @IsIn(['NEW', 'REASSIGN']) kind!: 'NEW' | 'REASSIGN';
  @IsOptional() @IsString() @MaxLength(100) previousAssignmentId?: string | null;
  @IsOptional() @IsString() @MaxLength(2000) reassignReason?: string | null;
  @IsOptional() @IsString() @MaxLength(100) crimeId?: string | null;
  @IsOptional() @IsString() @MaxLength(500) crimeOther?: string | null;
  @IsString() @MaxLength(500) summary!: string;
  @IsString() @MaxLength(20000) content!: string;
  /** `YYYY-MM-DD`. */
  @IsOptional() @IsNgayThat() discoveredOn?: string | null;
  @IsOptional() @IsString() @MaxLength(500) place?: string | null;
  @IsBoolean() subjectsUnknown!: boolean;
  @ValidateNested({ each: true }) @Type(() => WardSubjectDto) @ArrayMaxSize(100) subjects!: WardSubjectDto[];
  @IsOptional() @IsString() @MaxLength(100) proposedInvestigatorId?: string | null;
  @IsString() @MaxLength(200) entryOfficerName!: string;
  @IsOptional() @IsString() @MaxLength(50) entryOfficerPhone?: string | null;
  @IsOptional() @IsString() @MaxLength(5000) unitNote?: string | null;
}

export class CreateWardAssignmentDto extends WardAssignmentContentDto {
  /** The ward unit; a ward officer's own when left out. */
  @IsOptional() @IsString() @MaxLength(100) assignedTeamId?: string | null;
}

export class UpdateWardAssignmentDto extends WardAssignmentContentDto {
  /** The request as the form last read it. */
  @IsNgayThat() expectedUpdatedAt!: string;
}

export class ExpectedStampDto {
  @IsNgayThat() expectedUpdatedAt!: string;
}

export class ListWardAssignmentsQuery {
  @IsOptional() @IsString() @MaxLength(200) q?: string;
  @IsOptional() @IsIn(['DRAFT', 'SUBMITTED', 'RETURNED', 'APPROVED']) status?: 'DRAFT' | 'SUBMITTED' | 'RETURNED' | 'APPROVED';
  @IsOptional() @Transform(({ value }) => value === true || value === 'true') @IsBoolean() archived?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) pageSize?: number;
}

export class ListWardInvestigatorsQuery {
  @IsString() @MaxLength(100) teamId!: string;
  @IsOptional() @Transform(({ value }) => value === true || value === 'true') @IsBoolean() includeStopped?: boolean;
}

export class CreateWardInvestigatorDto {
  @IsString() @MaxLength(100) teamId!: string;
  @IsString() @MaxLength(200) fullName!: string;
  @IsOptional() @IsString() @MaxLength(100) rank?: string | null;
  @IsOptional() @IsString() @MaxLength(200) position?: string | null;
  @IsOptional() @IsString() @MaxLength(100) grade?: string | null;
}

export class UpdateWardInvestigatorDto {
  /** Absent: unchanged. Present: a name (null is refused, a name cannot be emptied). */
  @ValidateIf((o: UpdateWardInvestigatorDto) => o.fullName !== undefined) @IsString() @MaxLength(200) fullName?: string;
  @IsOptional() @IsString() @MaxLength(100) rank?: string | null;
  @IsOptional() @IsString() @MaxLength(200) position?: string | null;
  @IsOptional() @IsString() @MaxLength(100) grade?: string | null;
  @IsNgayThat() expectedUpdatedAt!: string;
}
