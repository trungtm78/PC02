import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { IsNgayThat } from '../../common/validators/is-ngay-that.validator';
import { Type } from 'class-transformer';
import { TheTimKiem } from '../../common/tim-kiem/the-tim-kiem.decorator';

/**
 * v0.29: Query DTO cho GET /audit-logs với class-validator clamps.
 * Defense in depth: AuditService.findAll cũng clamp lại (safety net).
 */
export class QueryAuditLogsDto {
  /**
   * Thẻ của ô tìm dạng thẻ: `khoá~giá trị`, lặp được (`?tk=nguoiThucHien~an&tk=thaoTac~CASE_CREATED`).
   * Khoá và giá trị kiểm ở `common/tim-kiem/dieu-kien.ts` (khoá lạ → 400).
   */
  @TheTimKiem()
  tk?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  action?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  userId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  subjectId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsNgayThat()
  dateFrom?: string;

  @IsOptional()
  @IsNgayThat()
  dateTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
