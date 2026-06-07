import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  IsDateString,
  IsObject,
  IsISO8601,
  IsNotEmpty,
  IsArray,
  ValidateIf,
  ValidateNested,
  ArrayMaxSize,
  Min,
  MaxLength,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { CaseStatus, CapDoToiPham, CaseProvenance, CaseType, LoaiUyThac } from '@prisma/client';
import { CaseStatisticDto } from './case-statistic.dto';

export { CaseStatus, CapDoToiPham, CaseProvenance, CaseType, LoaiUyThac };

// PR 1 v0.38.0.0 — Atomic transaction sub-entity DTOs
// Fix bug data-loss wizard "Khởi tố vụ án mới" (subjects/evidences/documents bị mất khi save)
export class CreateSubjectInlineDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fullName: string;

  @IsDateString()
  dateOfBirth: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  gender?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  idNumber: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  occupationId?: string;

  @IsOptional()
  @IsString()
  nationalityId?: string;

  @IsOptional()
  @IsString()
  wardId?: string;

  // Optional: nhân chứng/bị hại không bắt buộc tội danh. FK → master Crime.
  @IsOptional()
  @IsString()
  crimeId?: string;

  @IsOptional()
  @IsString()
  type?: string; // SubjectType enum value

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateEvidenceInlineDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  code: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  unit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  storageLocation?: string;

  @IsOptional()
  @IsDateString()
  receivedDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  evidenceType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  entryOrder?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  warehouseReceipt?: string;
}

export class CreateCaseDto {
  // BUG-001/002/004 (UAT 2026-05-23): trim + reject empty/whitespace-only.
  // Transform chạy trước validator → IsNotEmpty thấy chuỗi đã trim.
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Tên vụ án bắt buộc' })
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

  // ── Field-parity: số QĐ giai đoạn vụ án ──
  @IsOptional() @IsString() soQuyetDinhKhoiTo?: string;
  @IsOptional() @IsString() soQDNhapVuAn?: string;
  @IsOptional() @IsDateString() ngayNhapVuAn?: string;
  @IsOptional() @IsString() ghiChuNhapHoSo?: string;
  @IsOptional() @IsString() soQDTachVuAn?: string;
  @IsOptional() @IsDateString() ngayTachVuAn?: string;
  @IsOptional() @IsString() soQDTachHanhVi?: string;
  @IsOptional() @IsDateString() ngayTachHanhVi?: string;
  @IsOptional() @IsString() soQDDinhChiVuAn?: string;
  @IsOptional() @IsDateString() ngayDinhChiVuAn?: string;
  @IsOptional() @IsString() chuyenVuAnChoCQK?: string;
  @IsOptional() @IsString() soBanAnCoHieuLuc?: string;
  @IsOptional() @IsDateString() ngayBanAnCoHieuLuc?: string;
  @IsOptional() @IsString() canCuTamDinhChiVuAn?: string;
  @IsOptional() @IsString() canCuPhucHoiVuAn?: string;

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

  // v0.44 — Ủy Thác Điều Tra (UTDT) fields — all optional, only relevant when caseType=UY_THAC_DIEU_TRA
  @IsOptional()
  @IsEnum(CaseType)
  caseType?: CaseType;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @ValidateIf((o: { caseType?: CaseType }) => o.caseType === CaseType.UY_THAC_DIEU_TRA)
  @IsNotEmpty({ message: 'Đơn vị giao là bắt buộc cho ủy thác điều tra' })
  @IsString()
  @MaxLength(200)
  donViGiao?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  soQuyetDinhUyThac?: string;

  @IsOptional()
  @IsDateString()
  ngayTiepNhan?: string;

  @IsOptional()
  @IsDateString()
  thoiHanUyThac?: string;

  @IsOptional()
  @IsEnum(LoaiUyThac)
  loaiUyThac?: LoaiUyThac;

  @IsOptional()
  @IsString()
  ketQuaUyThac?: string;

  @IsOptional()
  @IsDateString()
  ngayTraKetQua?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  loaiThongTin?: string;

  // ─── PR 1 v0.38.0.0 — Atomic sub-entity arrays ──────────────────────────────
  // Fix bug data-loss: subjects/evidences/documentIds được create đồng bộ với Case
  // trong 1 prisma.$transaction. All-or-nothing. Trước đây arrays bị drop khi POST.

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100, { message: 'subjects[] tối đa 100 đối tượng' })
  @ValidateNested({ each: true })
  @Type(() => CreateSubjectInlineDto)
  subjects?: CreateSubjectInlineDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100, { message: 'evidences[] tối đa 100 vật chứng' })
  @ValidateNested({ each: true })
  @Type(() => CreateEvidenceInlineDto)
  evidences?: CreateEvidenceInlineDto[];

  // Thống kê mở rộng (hybrid) — 1-1, lưu bảng case_statistics.
  @IsOptional()
  @ValidateNested()
  @Type(() => CaseStatisticDto)
  statistic?: CaseStatisticDto;

  // Documents đã upload trước qua flow riêng (POST /documents). Truyền IDs để link.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50, { message: 'documentIds[] tối đa 50 file' })
  @IsString({ each: true })
  documentIds?: string[];
}
