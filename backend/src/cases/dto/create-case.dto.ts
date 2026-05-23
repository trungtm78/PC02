import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  IsDateString,
  IsObject,
  IsISO8601,
  IsNotEmpty,
  ValidateIf,
  Min,
  MaxLength,
} from 'class-validator';
import { CaseStatus, CapDoToiPham, CaseProvenance } from '@prisma/client';

export { CaseStatus, CapDoToiPham, CaseProvenance };

export class CreateCaseDto {
  @IsString()
  @MaxLength(500)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  crime?: string;

  @IsOptional()
  @IsEnum(CaseStatus)
  status?: CaseStatus;

  @IsOptional()
  @IsString()
  investigatorId?: string;

  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  unit?: string;

  // FK Team (Case.assignedTeamId) — paired with `unit` text label.
  // Forms pre-fill both so DataScope team-filter matches the user's primary team.
  @IsOptional()
  @IsString()
  assignedTeamId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  subjectsCount?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  // Mức độ tội phạm (BLHS 2015 Điều 9) — dùng cho KPI-4
  @IsOptional()
  @IsEnum(CapDoToiPham, {
    message: 'capDoToiPham phải là IT_NGHIEM_TRONG, NGHIEM_TRONG, RAT_NGHIEM_TRONG hoặc DAC_BIET_NGHIEM_TRONG',
  })
  capDoToiPham?: CapDoToiPham;

  // Ngày quyết định khởi tố vụ án
  @IsOptional()
  @IsDateString()
  ngayKhoiTo?: string;

  // v0.37.2 — Provenance model (Deploy-2 Contract: REQUIRED)
  // BLTTHS Đ.143 source classification — required for every Case.
  // Legacy `metadata.petitionType` payloads now return 400 from @IsEnum validation.
  @IsEnum(CaseProvenance, {
    message: 'caseProvenance bắt buộc — chọn FROM_PETITION / FROM_INCIDENT / DIRECT_DISCOVERY / TRANSFERRED / OTHER_LEGAL_SOURCE (BLTTHS Đ.143)',
  })
  caseProvenance: CaseProvenance;

  // Required when caseProvenance === FROM_PETITION
  @ValidateIf((o) => o.caseProvenance === CaseProvenance.FROM_PETITION)
  @IsString()
  @IsNotEmpty({ message: 'linkedPetitionId required when caseProvenance is FROM_PETITION' })
  linkedPetitionId?: string;

  // Required when caseProvenance === FROM_INCIDENT
  @ValidateIf((o) => o.caseProvenance === CaseProvenance.FROM_INCIDENT)
  @IsString()
  @IsNotEmpty({ message: 'linkedIncidentId required when caseProvenance is FROM_INCIDENT' })
  linkedIncidentId?: string;

  // Required when caseProvenance === FROM_PETITION (for optimistic lock on Petition.updatedAt)
  @ValidateIf((o) => o.caseProvenance === CaseProvenance.FROM_PETITION)
  @IsISO8601()
  expectedPetitionUpdatedAt?: string;

  // Required when caseProvenance === FROM_INCIDENT
  @ValidateIf((o) => o.caseProvenance === CaseProvenance.FROM_INCIDENT)
  @IsISO8601()
  expectedIncidentUpdatedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  sourceDocumentNote?: string;
}
