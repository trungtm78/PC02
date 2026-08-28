import { IsObject } from 'class-validator';

/**
 * Cả cục lựa chọn in chứng từ của MỘT thực thể.
 *
 * Chỉ kiểm "là object" ở tầng này; nội dung bên trong do `chuanHoaLuaChon` lo, vì luật lọc mã
 * mẫu và kẹp chế độ phức tạp hơn thứ decorator diễn đạt được, và phải dùng chung với đường đọc.
 */
export class LuuLuaChonDto {
  @IsObject()
  luaChon!: Record<string, unknown>;
}
