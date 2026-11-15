import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsObject, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { MAX_STEPS } from '../flow-steps';

/**
 * Shapes only. What a flow may BE (a name, a record kind that exists, steps that can be stored, a revision that is
 * current) is judged by the service, which answers with a code the screen translates; the bounds here only keep an
 * oversized or mistyped body out.
 */
const MAX_TEXT = 4_000;
const MAX_ID = 200;
const MAX_BINDINGS = 5_000;

export class CreateFlowDto {
  @IsOptional() @IsString() @MaxLength(MAX_TEXT) name?: string;
  @IsString() @MaxLength(MAX_ID) recordKind!: string;
  @IsOptional() @IsString() @MaxLength(MAX_TEXT) description?: string | null;
  @IsOptional() @IsBoolean() isDefault?: boolean;
  @IsOptional() @IsString() @MaxLength(MAX_ID) copyFromFlowId?: string | null;
  @IsOptional() @IsString() @MaxLength(MAX_ID) templateKey?: string | null;
}

/** Only what is sent is changed; `description: null` clears it. `expectedRevision`: the revision the edit was made from. */
export class UpdateFlowDto {
  @IsOptional() @IsString() @MaxLength(MAX_TEXT) name?: string;
  @IsOptional() @IsString() @MaxLength(MAX_TEXT) description?: string | null;
  @IsOptional() @IsBoolean() isDefault?: boolean;
  @IsInt() @Min(1) expectedRevision!: number;
}

/** ALL the bindings of the flow: what is not listed is removed. */
export class SetBindingsDto {
  @IsArray() @ArrayMaxSize(MAX_BINDINGS) @IsString({ each: true }) @MaxLength(MAX_ID, { each: true }) directoryIds!: string[];
  @IsArray() @ArrayMaxSize(MAX_BINDINGS) @IsString({ each: true }) @MaxLength(MAX_ID, { each: true }) deadlineGroups!: string[];
  @IsInt() @Min(1) expectedRevision!: number;
}

/** A write that carries nothing but the revision it was decided on (archive, restore, publish). */
export class ExpectedRevisionDto {
  @IsInt() @Min(1) expectedRevision!: number;
}

/**
 * ALL the steps of a draft, in order. The steps themselves are not described here: the service reads them
 * (`normaliseSteps`) and answers `STEPS_INVALID` with the place of every problem, which a class validator cannot say
 * in codes.
 */
export class ReplaceStepsDto {
  @IsArray() @ArrayMaxSize(MAX_STEPS) steps!: unknown[];
  @IsInt() @Min(1) expectedRevision!: number;
}

/** Steps as in `ReplaceStepsDto`, the dates of an imagined record, and the facts that pick a variant. */
export class PreviewScheduleDto {
  @IsString() @MaxLength(MAX_ID) recordKind!: string;
  @IsArray() @ArrayMaxSize(MAX_STEPS) steps!: unknown[];
  @IsOptional() @IsObject() anchors?: Record<string, unknown>;
  @IsOptional() @IsObject() conditions?: Record<string, unknown>;
}
