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
import { ALERT_LEVELS, type AlertLevel } from '../ward-alerts';

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

export class ReturnDto {
  @IsNgayThat() expectedUpdatedAt!: string;
  @IsOptional() @IsString() @MaxLength(100) reasonCode?: string | null;
  @IsOptional() @IsString() @MaxLength(5000) reasonText?: string | null;
  @IsString({ each: true }) @ArrayMaxSize(50) requirements!: string[];
}

export class ApproveDto {
  @IsNgayThat() expectedUpdatedAt!: string;
  @IsString() @MaxLength(100) assignedInvestigatorId!: string;
  @IsOptional() @IsString() @MaxLength(100) followUpUserId?: string | null;
  @IsOptional() @IsString() @MaxLength(100) followUpTeamId?: string | null;
  @IsOptional() @IsString({ each: true }) @ArrayMaxSize(50) requirements?: string[];
  @IsOptional() @IsString() @MaxLength(5000) pc02Note?: string | null;
}

export class ReasonDto {
  @IsNgayThat() expectedUpdatedAt!: string;
  @IsString() @MaxLength(2000) reason!: string;
}

export class FollowUpDto {
  @IsNgayThat() expectedUpdatedAt!: string;
  @IsOptional() @IsNgayThat() receivedOn?: string | null;
  @IsOptional() @IsString() @MaxLength(20000) resultText?: string | null;
  @IsOptional() @IsString() @MaxLength(5000) pc02Note?: string | null;
}

export class ExtendDto {
  @IsNgayThat() expectedUpdatedAt!: string;
  @IsNgayThat() newDueOn!: string;
  @IsString() @MaxLength(2000) reason!: string;
}

export class CompleteDto {
  @IsNgayThat() expectedUpdatedAt!: string;
  @IsNgayThat() completedOn!: string;
}

export class DeleteWithDataDto {
  @IsNgayThat() expectedUpdatedAt!: string;
  @IsString() @MaxLength(100) confirmCode!: string;
}

export class ExpectedStampDto {
  @IsNgayThat() expectedUpdatedAt!: string;
}

export class ListWardAssignmentsQuery {
  @IsOptional() @IsString() @MaxLength(200) q?: string;
  @IsOptional() @IsIn(['DRAFT', 'SUBMITTED', 'RETURNED', 'APPROVED']) status?: 'DRAFT' | 'SUBMITTED' | 'RETURNED' | 'APPROVED';
  @IsOptional() @Transform(({ value }) => value === true || value === 'true') @IsBoolean() archived?: boolean;
  // Filters of lane D (the statistics open the list with them): the deadline alert, the unit, the crime, the kinds.
  @IsOptional() @IsIn([...ALERT_LEVELS]) alert?: AlertLevel;
  @IsOptional() @IsString() @MaxLength(100) teamId?: string;
  @IsOptional() @IsString() @MaxLength(100) crimeId?: string;
  @IsOptional() @IsIn(['INCIDENT', 'CASE']) caseType?: 'INCIDENT' | 'CASE';
  @IsOptional() @IsIn(['NEW', 'REASSIGN']) kind?: 'NEW' | 'REASSIGN';
  @IsOptional() @Transform(({ value }) => value === true || value === 'true') @IsBoolean() submitted?: boolean;
  /** First submitted within [from, to] (calendar days; checked by the service). */
  @IsOptional() @IsString() @MaxLength(10) from?: string;
  @IsOptional() @IsString() @MaxLength(10) to?: string;
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
