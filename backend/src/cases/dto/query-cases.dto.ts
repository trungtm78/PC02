import {
  IsBoolean,
  IsOptional,
  IsString,
  IsEnum,
  IsIn,
  IsInt,
  IsDateString,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { CaseStatus, CapDoToiPham, CaseType, LoaiUyThac } from '@prisma/client';
import { IsCatalogValue } from '../../common/validators/is-catalog-value.validator';
import { CASE_STATUS_GROUP_KEYS } from '../cases.constants';

export type TrangThaiPhanHoi = 'DA_PHAN_HOI' | 'KHONG_THUC_HIEN_DUOC' | 'QUA_HAN' | 'CHUA_PHAN_HOI';
export { CaseType, LoaiUyThac };

export class QueryCasesDto {
  // Search: cap at 200 chars để tránh heavy JSONB scan / ILIKE on UTDT metadata.path
  // (review finding: unbounded search drives multiple OR ILIKE + JSON containment).
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsEnum(CaseStatus)
  status?: CaseStatus;

  /**
   * Nhóm trạng thái cho drill-down thẻ thống kê (vd 'dang-dieu-tra' gộp 6 trạng thái).
   * Thắng `status` khi cả hai cùng có. `@IsIn` để chặn key rác ngay ở cổng.
   */
  @IsOptional()
  @IsIn(CASE_STATUS_GROUP_KEYS)
  statusGroup?: string;

  /** Tội danh — bộ lọc nâng cao. Trước đây FE gửi mà DTO không có → 400. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  charges?: string;

  @IsOptional()
  @IsString()
  investigatorId?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  fromDate?: string;

  @IsOptional()
  @IsString()
  toDate?: string;

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

  // Lọc theo quận/huyện (thông qua subjects)
  @IsOptional()
  @IsString()
  districtId?: string;

  // Lọc theo phường/xã (thông qua subjects)
  @IsOptional()
  @IsString()
  wardId?: string;

  // v0.36.0.0: Lọc theo phường công tác (Team.wardId — cross-ward view cho PC02/ADMIN)
  @IsOptional()
  @IsString()
  wardTeamId?: string;

  // Lọc theo mức độ tội phạm (BLHS Điều 9)
  @IsOptional()
  @IsCatalogValue('CAP_DO_TOI_PHAM')
  capDoToiPham?: CapDoToiPham;

  // v0.44 — UTDT filters
  @IsOptional()
  @IsCatalogValue('CASE_TYPE')
  caseType?: CaseType;

  @IsOptional()
  @IsString()
  donViGiao?: string;

  @IsOptional()
  @IsCatalogValue('LOAI_UY_THAC')
  loaiUyThac?: LoaiUyThac;

  @IsOptional()
  @IsIn(['DA_PHAN_HOI', 'KHONG_THUC_HIEN_DUOC', 'QUA_HAN', 'CHUA_PHAN_HOI'])
  trangThaiPhanHoi?: TrangThaiPhanHoi;

  // v0.44.3 — UTDT date range + investigator name search. @IsDateString → date sai format = 400.
  @IsOptional()
  @IsDateString()
  ngayTiepNhanFrom?: string;

  @IsOptional()
  @IsDateString()
  ngayTiepNhanTo?: string;

  @IsOptional()
  @IsString()
  investigatorName?: string;

  // Sort
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @IsOptional()
  @Transform(({ value }) => value === 'asc' ? 'asc' : 'desc')
  sortOrder?: 'asc' | 'desc' = 'desc';
}
