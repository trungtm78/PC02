import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * D4 — tạo vai trò mới.
 *
 * Tên vai trò là WIRE FORMAT: `ROLE_NAMES` so khớp bằng chuỗi ở guard, ở seed
 * phân quyền và ở nhiều nhánh nghiệp vụ. Vì thế tên bị ép về UPPER_SNAKE_CASE —
 * cho phép `Điều tra viên` sẽ tạo ra một vai trò không guard nào nhận ra, và
 * người tạo chỉ biết điều đó khi có người không vào được màn hình.
 */
export class CreateRoleDto {
  @IsString()
  @MinLength(3, { message: 'Tên vai trò phải có ít nhất 3 ký tự' })
  @MaxLength(50, { message: 'Tên vai trò tối đa 50 ký tự' })
  @Matches(/^[A-Z][A-Z0-9_]*$/, {
    message:
      'Tên vai trò chỉ gồm chữ IN HOA, số và dấu gạch dưới, bắt đầu bằng chữ (ví dụ: TRUONG_PHONG)',
  })
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Mô tả tối đa 255 ký tự' })
  description?: string;

  /**
   * Sao chép quyền từ một vai trò sẵn có.
   *
   * Vai trò tạo ra mà chưa có quyền nào thì người mang nó đăng nhập vào một hệ
   * thống trống rỗng — đúng về mặt fail-closed, nhưng gần như luôn là điều
   * người tạo không định. Sao chép rồi bớt đi dễ kiểm hơn là nhớ cấp từ đầu.
   */
  @IsOptional()
  @IsString()
  copyPermissionsFromRoleId?: string;
}
