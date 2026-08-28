import { IsObject } from 'class-validator';

/**
 * Cả cục bố cục của MỘT bảng.
 *
 * Chỉ kiểm "là object" ở tầng này; nội dung bên trong do `chuanHoaBoCuc` lo, vì luật kẹp biên
 * và bỏ khoá lạ phức tạp hơn thứ decorator diễn đạt được, và phải dùng chung với đường đọc.
 */
export class LuuBoCucDto {
  @IsObject()
  columns!: Record<string, unknown>;
}
