import { PartialType } from '@nestjs/mapped-types';
import { CreateDelegationDto } from './create-delegation.dto';

/**
 * DTO sửa ủy thác — kiểm như DTO tạo, mọi trường tuỳ chọn. Trước 17/09/2026 lệnh sửa nhận
 * `Partial<CreateDelegationDto>`: kiểu TypeScript biến mất lúc chạy nên ValidationPipe không kiểm gì.
 */
export class UpdateDelegationDto extends PartialType(CreateDelegationDto) {}
