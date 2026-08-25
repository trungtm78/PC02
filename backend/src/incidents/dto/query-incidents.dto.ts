import {
  IsBoolean,
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { IncidentStatus, LoaiNguonTin } from '@prisma/client';
import { IsCatalogValue } from '../../common/validators/is-catalog-value.validator';

export class QueryIncidentsDto {
  // Tìm kiếm tổng hợp: mã, tên, tên ĐTV. Cap 200 ký tự (tránh heavy ILIKE/JSONB scan — đồng bộ QueryCasesDto).
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  // Lọc theo trạng thái
  @IsOptional()
  @IsEnum(IncidentStatus)
  status?: IncidentStatus;

  // Lọc theo điều tra viên (AC-01)
  @IsOptional()
  @IsString()
  investigatorId?: string;

  // Lọc theo đơn vị
  @IsOptional()
  @IsString()
  unitId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;

  // Lọc theo quá hạn
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  overdue?: boolean;

  // Lọc theo quận/huyện
  @IsOptional()
  @IsString()
  districtId?: string;

  // Lọc theo phường/xã
  @IsOptional()
  @IsString()
  wardId?: string;

  // v0.36.0.0: Lọc theo phường công tác (Team.wardId — cross-ward view cho PC02/ADMIN)
  @IsOptional()
  @IsString()
  wardTeamId?: string;

  // BCA phase filter (server-side resolve via PHASE_STATUSES)
  @IsOptional()
  @IsString()
  phase?: string; // "tiep-nhan" | "xac-minh" | "ket-qua" | "tam-dinh-chi"

  // New filters for VuViec workflow
  @IsOptional()
  @IsCatalogValue('LOAI_NGUON_TIN')
  loaiDonVu?: LoaiNguonTin;

  @IsOptional()
  @IsString()
  benVu?: string;

  /**
   * Bộ lọc "Người tố giác/báo tin" — tra theo CCCD hoặc SĐT.
   *
   * Schema Incident KHÔNG có cột TÊN người tố giác (chỉ `cmndNguoiToGiac`,
   * `sdtNguoiToGiac`, `diaChiNguoiToGiac`), nên không thể tra theo tên.
   * Trước đây FE gửi param này mà DTO không có → forbidNonWhitelisted trả 400.
   */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  reporter?: string;

  /** Bộ lọc "Đơn vị" (text tự do). Trước đây FE gửi `unit` không có trong DTO → 400. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  donViGiaiQuyet?: string;

  @IsOptional()
  @IsString()
  tinhTrangHoSo?: string;

  @IsOptional()
  @IsString()
  tinhTrangThoiHieu?: string;

  @IsOptional()
  @IsString()
  canBoNhapId?: string;

  @IsOptional()
  @IsDateString()
  fromDateRange?: string; // Ngày đề xuất từ

  @IsOptional()
  @IsDateString()
  toDateRange?: string; // Ngày đề xuất đến

  @IsOptional()
  @IsString()
  // KHONG dat mac dinh o day: moi module co truong mac dinh rieng, quyet dinh o
  // service qua buildListOrderBy. Dat mac dinh o DAY se de len mac dinh do.
  sortBy?: string;

  @IsOptional()
  @Transform(({ value }) => (value === 'asc' ? 'asc' : 'desc'))
  sortOrder?: 'asc' | 'desc' = 'desc';

  // ── Bộ lọc theo kiểu hệ cũ (25/08/2026) ─────────────────────────────────────
  // Cán bộ quen bảng lọc của hệ cũ; ba ô dưới đây là phần hệ mới còn thiếu.

  /** Mã hồ sơ. Nhận CẢ HAI dạng: `26-11171` (hệ cũ hiện) và `2026-11171` (hệ mới lưu). */
  @IsOptional()
  @IsString()
  stt?: string;

  /** STT cũ hơn (`stt_cu` của hệ cũ) — cột đã có chỉ mục. */
  @IsOptional()
  @IsString()
  sttCu?: string;

  // "Cán bộ nhập" đã có sẵn ở `canBoNhapId` phía trên — không thêm ô thứ hai cùng nghĩa.
}
