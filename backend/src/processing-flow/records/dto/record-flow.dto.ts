import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

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
