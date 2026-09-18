import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Tham số chọn cột của các điểm cuối `export/danh-sach`: khoá cột đang hiện trên bảng, cách nhau bởi
 * dấu phẩy, theo thứ tự hiển thị. Ghép vào DTO danh sách của từng loại bằng `IntersectionType`, để tệp
 * xuất nhận ĐÚNG bộ tham số lọc của bảng cộng thêm mỗi `cot`.
 */
export class CotXuatDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  cot?: string;
}

/** `"stt,ngayDeXuat"` → `['stt','ngayDeXuat']`; rỗng → undefined (xuất mọi cột khai). */
export function tachCotXuat(cot: string | undefined): string[] | undefined {
  const ds = (cot ?? '')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
  return ds.length ? ds : undefined;
}
