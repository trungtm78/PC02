/**
 * v0.37.1.1 PROV-004 — Query DTO for /incidents/linkable
 *
 * Returns Incidents that are:
 * - Not soft-deleted (deletedAt: null)
 * - Not yet linked to any Case (linkedCaseId: null)
 * - Within the user's DataScope
 *
 * Used by CaseFormPage Incident picker when caseProvenance=FROM_INCIDENT.
 * Mirror of petitions/dto/list-linkable.dto.ts (PR-PICK).
 */

import { IsOptional, IsString, MaxLength, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class ListLinkableIncidentDto {
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
