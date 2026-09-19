import { IsOptional, IsString } from 'class-validator';
import { TheTimKiem } from '../../common/tim-kiem/the-tim-kiem.decorator';
import { IsNgayThat } from '../../common/validators/is-ngay-that.validator';

export class ExportPetitionsQueryDto {
  /**
   * Thẻ của ô tìm dạng thẻ — lượt xuất áp CÙNG thẻ với danh sách. Thiếu khoá này thì màn lọc bằng thẻ
   * còn vài đơn mà tệp xuất ra là mọi đơn khớp ngày/đơn vị.
   */
  @TheTimKiem()
  tk?: string[];

  /** Ô tìm cũ (cờ thẻ tắt) — máy chủ quy về thẻ "tất cả các cột". */
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  ids?: string; // comma-separated petition ids

  @IsOptional()
  @IsNgayThat()
  fromDate?: string;

  @IsOptional()
  @IsNgayThat()
  toDate?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
