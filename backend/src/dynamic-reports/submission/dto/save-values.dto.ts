import { IsObject, IsString } from 'class-validator';

/**
 * S11-S14 save payload (spec §6.1 PR6). `values` is `{fieldKey: raw}` —
 * the raw string the user typed (or null for "left blank"), never a
 * pre-typed `{t,v}` pair: `SubmissionService.save` runs every value
 * through `engine/values.ts#validateFieldValue` itself, the same
 * authoritative validation the DTO layer must never shadow or duplicate.
 */
export class SaveValuesDto {
  @IsObject()
  values!: Record<string, string | null>;

  @IsString()
  expectedRevision!: string;
}

/** S29 submit payload — no value patch, see `SubmissionService.submit`. */
export class SubmitDto {
  @IsString()
  expectedRevision!: string;
}
