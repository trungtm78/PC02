import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsIn,
  IsDateString,
  IsBoolean,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { PetitionStatus } from './create-petition.dto';
import { PETITION_STATUS_GROUP_KEYS } from '../petitions.constants';

export class QueryPetitionsDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(PetitionStatus)
  status?: PetitionStatus;

  /**
   * Nhóm trạng thái cho drill-down thẻ thống kê (vd 'dang-xu-ly' = DANG_XU_LY +
   * CHO_PHE_DUYET). Thắng `status` khi cả hai cùng có.
   *
   * `@IsIn` chứ không phải `@IsString`: chặn key rác ngay ở cổng, fail-fast 400 thay vì
   * để lọt xuống service.
   */
  @IsOptional()
  @IsIn(PETITION_STATUS_GROUP_KEYS)
  statusGroup?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  senderName?: string;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
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

  @IsOptional()
  @IsString()
  // KHONG dat mac dinh o day: moi module co truong mac dinh rieng, quyet dinh o
  // service qua buildListOrderBy. Dat mac dinh o DAY se de len mac dinh do.
  sortBy?: string;

  @IsOptional()
  @Transform(({ value }) => (value === 'asc' ? 'asc' : 'desc'))
  sortOrder?: 'asc' | 'desc' = 'desc';

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  overdue?: boolean;

  // v0.36.0.0: Lọc theo phường công tác (Team.wardId — cross-ward view PC02/ADMIN)
  @IsOptional()
  @IsString()
  wardTeamId?: string;
}
