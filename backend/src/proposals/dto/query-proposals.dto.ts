import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import {
  DO_DAI_GIA_TRI_TOI_DA,
  SO_THE_TOI_DA,
} from '../../common/tim-kiem/dieu-kien';

/** Một mục `khoá~giá trị`: khoá dài nhất cỡ vài chục ký tự + dấu `~` + giá trị. */
const DO_DAI_MUC_THE_TOI_DA = DO_DAI_GIA_TRI_TOI_DA + 50;

export class QueryProposalsDto {
  /**
   * Thẻ của ô tìm dạng thẻ: `khoá~giá trị`, lặp được (`?tk=donViVks~quan 12&tk=trangThai~DA_GUI`). Khoá
   * và giá trị kiểm ở `common/tim-kiem/dieu-kien.ts` (khoá lạ → 400).
   */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? undefined : Array.isArray(value) ? value : [value],
  )
  @IsArray()
  @ArrayMaxSize(SO_THE_TOI_DA)
  @IsString({ each: true })
  @MaxLength(DO_DAI_MUC_THE_TOI_DA, { each: true })
  tk?: string[];

  /** Ô tìm cũ — quy về thẻ "tất cả các cột", máy chủ tự cắt độ dài. */
  @IsOptional()
  @IsString()
  search?: string;

  /** Tham số cũ của xuất Excel — quy về thẻ Đơn vị VKS. */
  @IsOptional()
  @IsString()
  unit?: string;

  /** Mã `ProposalStatus` — lạ → 400 ở service. */
  @IsOptional()
  @IsString()
  status?: string;

  /** `yyyy-mm-dd` theo ngày Việt Nam, lọc ngày tạo. */
  @IsOptional()
  @IsString()
  fromDate?: string;

  /** `yyyy-mm-dd`, gồm trọn ngày này. */
  @IsOptional()
  @IsString()
  toDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  @Type(() => Number)
  limit?: number = 20;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  offset?: number = 0;
}
