import { IsIn } from 'class-validator';
import { TRANG_THAI_MAU, type TrangThaiMau } from '../document-template.constants';

/**
 * Đổi trạng thái vòng đời mẫu chứng từ.
 *
 * `@IsIn` lấy thẳng từ bảng trạng thái, không chép tay danh sách: chép tay là hai bảng sẽ lệch
 * nhau ngay lần thêm trạng thái đầu tiên.
 */
export class DoiTrangThaiDto {
  @IsIn(TRANG_THAI_MAU as unknown as string[])
  status!: TrangThaiMau;
}
