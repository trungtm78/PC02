import { PartialType } from '@nestjs/mapped-types';
import { CreateExchangeDto } from './create-exchange.dto';

/**
 * DTO sửa trao đổi — kiểm như DTO tạo, mọi trường tuỳ chọn. Trước 17/09/2026 lệnh sửa nhận
 * `Partial<CreateExchangeDto>`: kiểu TypeScript biến mất lúc chạy nên ValidationPipe không kiểm gì.
 */
export class UpdateExchangeDto extends PartialType(CreateExchangeDto) {}
