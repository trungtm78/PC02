import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { LOAI_TAO_NHANH_DUOC } from '../directory.service';

/**
 * Tạo nhanh một mục danh mục từ ô tìm trên form.
 *
 * KHÔNG nhận `code`: mã do máy chủ sinh. Cho người dùng đặt mã là mở đường cho hai lỗi — mã
 * không khớp `^[A-Z0-9_-]+$` (tên tiếng Việt không thành mã được) và mã đụng nhau khi hai
 * người tạo cùng lúc.
 */
export class QuickCreateDirectoryDto {
  @IsIn(LOAI_TAO_NHANH_DUOC)
  type!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1, { message: 'Tên đơn vị không được để trống' })
  // 500 như cột `donViGiaiQuyet`: đo dữ liệu cũ, giá trị dài nhất là 329 ký tự. Giới hạn ngắn
  // hơn dữ liệu thật chỉ khiến cán bộ gõ xong không lưu được mà không hiểu vì sao.
  @MaxLength(500)
  name!: string;
}
