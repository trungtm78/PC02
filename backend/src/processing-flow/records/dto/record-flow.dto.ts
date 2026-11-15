import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, ValidateIf, ValidateNested } from 'class-validator';
import { OPINION_KINDS } from '../../contract/processing-codes';

/**
 * Shapes only: what a step may do is judged by the command service, which answers with a code the screen translates.
 * `idempotencyKey` is the client's key for this one write: the app sends the same key when it retries.
 */
const MAX_ID = 200;
const MAX_KEY = 100;
const MAX_REASON = 2_000;

export class ApplyFlowDto {
  @IsOptional() @IsString() @MaxLength(MAX_ID) flowId?: string;
  @IsOptional() @IsString() @MaxLength(MAX_KEY) idempotencyKey?: string;
}

/** A write that carries the revision of the flow of the record it was decided on. */
export class RevisionCommandDto {
  @IsInt() @Min(1) expectedRevision!: number;
  @IsOptional() @IsString() @MaxLength(MAX_KEY) idempotencyKey?: string;
}

/** Names the person who answers for a party of a step; `null` gives it back to the heads of the unit. */
export class AssignPartyDto extends RevisionCommandDto {
  @ValidateIf((body: AssignPartyDto) => body.userId !== null) @IsString() @MaxLength(MAX_ID) userId!: string | null;
}

export class ReapplyFlowDto extends RevisionCommandDto {
  @IsOptional() @IsString() @MaxLength(MAX_ID) flowId?: string;
}

export class AcceptedDateDto extends RevisionCommandDto {
  /** `YYYY-MM-DD`. */
  @IsString() @MaxLength(10) date!: string;
}

export class ReasonedCommandDto extends RevisionCommandDto {
  @IsOptional() @IsString() @MaxLength(MAX_REASON) reason?: string;
}

export class AdjustDueDto extends RevisionCommandDto {
  /** `YYYY-MM-DD`, the unit's own deadline; `null` takes it back to the regulatory one. */
  @IsOptional() @IsString() @MaxLength(10) date?: string | null;
  @IsOptional() @IsString() @MaxLength(MAX_REASON) reason?: string;
}

export class ExtendStepDto extends RevisionCommandDto {
  @IsString() @MaxLength(MAX_REASON) reason!: string;
}

class DocumentRefDto {
  @IsOptional() @IsString() @MaxLength(200) type?: string;
  @IsOptional() @IsString() @MaxLength(200) number?: string;
  @IsOptional() @IsString() @MaxLength(200) date?: string;
}

/** The fields of a report. Only `doneWork` is required, and that is judged by the service (it answers with a code). */
export class ReportFieldsDto extends RevisionCommandDto {
  @IsString() @MaxLength(20_000) doneWork!: string;
  @IsOptional() @IsString() @MaxLength(20_000) findings?: string | null;
  @IsOptional() @IsString() @MaxLength(20_000) difficulties?: string | null;
  @IsOptional() @IsString() @MaxLength(100) proposalKind?: string | null;
  @IsOptional() @IsString() @MaxLength(20_000) proposalContent?: string | null;
  @IsOptional() @IsString() @MaxLength(20_000) proposalBasis?: string | null;
  @IsOptional() @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => DocumentRefDto) documents?: DocumentRefDto[] | null;
}

export class SubmitReportDto extends ReportFieldsDto {
  @IsIn(['PROGRESS', 'RESULT']) kind!: 'PROGRESS' | 'RESULT';
}

export class OpinionDto extends RevisionCommandDto {
  @IsIn([...OPINION_KINDS]) kind!: (typeof OPINION_KINDS)[number];
  @IsOptional() @IsString() @MaxLength(30) verdict?: string;
  @IsOptional() @IsString() @MaxLength(20_000) content?: string | null;
}

export class DecisionDto extends RevisionCommandDto {
  @IsString() @MaxLength(30) verdict!: string;
  @IsOptional() @IsString() @MaxLength(20_000) content?: string | null;
}
