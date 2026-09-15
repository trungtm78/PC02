import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import {
  DO_DAI_GIA_TRI_TOI_DA,
  SO_THE_TOI_DA,
} from '../../common/tim-kiem/dieu-kien';

/** Một mục `khoá~giá trị`: khoá dài nhất cỡ vài chục ký tự + dấu `~` + giá trị. */
const DO_DAI_MUC_THE_TOI_DA = DO_DAI_GIA_TRI_TOI_DA + 50;

export class ExportPetitionsQueryDto {
  /**
   * Thẻ của ô tìm dạng thẻ — lượt xuất áp CÙNG thẻ với danh sách. Thiếu khoá này thì màn lọc bằng thẻ
   * còn vài đơn mà tệp xuất ra là mọi đơn khớp ngày/đơn vị.
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

  /** Ô tìm cũ (cờ thẻ tắt) — máy chủ quy về thẻ "tất cả các cột". */
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  ids?: string; // comma-separated petition ids

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
