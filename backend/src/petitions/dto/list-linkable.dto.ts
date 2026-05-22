/**
 * v0.37.1 PR-PICK — Query DTO for /petitions/linkable
 *
 * Returns Petitions that are:
 * - Not soft-deleted (deletedAt: null)
 * - Not yet linked to any Case (linkedCaseId: null)
 * - Within the user's DataScope
 *
 * Used by CaseFormPage Petition picker when caseProvenance=FROM_PETITION.
 */

import { IsOptional, IsString, MaxLength, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class ListLinkableDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;
}
