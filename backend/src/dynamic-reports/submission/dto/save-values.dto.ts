import { IsObject, IsOptional, IsString } from 'class-validator';

/**
 * S11-S14 save payload (spec §6.1 PR6). `values` is `{fieldKey: raw}` —
 * the raw string the user typed (or null for "left blank"), never a
 * pre-typed `{t,v}` pair: `SubmissionService.save` runs every value
 * through `engine/values.ts#validateFieldValue` itself, the same
 * authoritative validation the DTO layer must never shadow or duplicate.
 *
 * `idempotencyKey` is optional (S26, PR6 slice 7): the frontend generates
 * one per autosave attempt and reuses it across retries of the SAME patch
 * after a network error, so a request that actually reached the server but
 * whose response was lost never double-applies on retry. Omitted entirely,
 * `save` behaves exactly as before this slice.
 */
export class SaveValuesDto {
  @IsObject()
  values!: Record<string, string | null>;

  @IsString()
  expectedRevision!: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

/** S29 submit payload — no value patch, see `SubmissionService.submit`. */
export class SubmitDto {
  @IsString()
  expectedRevision!: string;
}

/**
 * S35 (PR6 slice 8) — the second call of the import flow. `values` is
 * exactly what `previewExcelImport` returned, re-sent unchanged; the
 * server re-validates every one of them again before committing (defense
 * in depth, never trusts an echoed payload).
 */
export class ApplyExcelImportDto {
  @IsObject()
  values!: Record<string, string | null>;

  @IsString()
  expectedRevision!: string;
}
