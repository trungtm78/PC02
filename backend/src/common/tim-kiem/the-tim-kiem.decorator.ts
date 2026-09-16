import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { DO_DAI_GIA_TRI_TOI_DA, SO_THE_TOI_DA } from './dieu-kien';

/**
 * Một mục `khoá~giá trị`: khoá dài nhất cỡ vài chục ký tự + dấu `~` + giá trị.
 *
 * Trước 16/09/2026 hằng số này được tự tính lại ở 13 nơi (12 DTO + reports.controller). Cùng một
 * công thức chép 13 lần thì sửa một nơi là 12 nơi kia lặng lẽ lệch, và giới hạn đầu vào của chỗ ấy
 * khác hẳn mà không ai biết — đúng lớp lỗi "khe hở giữa bộ nạp và bộ đọc" kho mã này đã mắc.
 */
export const DO_DAI_MUC_THE_TOI_DA = DO_DAI_GIA_TRI_TOI_DA + 50;

/**
 * Khai trường `tk` của ô tìm dạng thẻ trên DTO tham số truy vấn.
 *
 * Thay cho khối 8 dòng decorator từng chép tay ở 12 DTO. Nhận `?tk=khoá~giá trị` lặp nhiều lần;
 * một giá trị đơn trên URL được đưa về mảng một phần tử. Giới hạn ở đây chỉ chặn yêu cầu QUÁ CỠ
 * trước khi chạm CSDL — còn khoá có hợp lệ hay không thì `common/tim-kiem/dieu-kien.ts` quyết
 * (khoá lạ → 400), vì chỉ nơi ấy mới biết khai của từng thực thể.
 */
export function TheTimKiem(): PropertyDecorator {
  return applyDecorators(
    IsOptional(),
    Transform(({ value }: { value: unknown }) =>
      value === undefined ? undefined : Array.isArray(value) ? value : [value],
    ),
    IsArray(),
    ArrayMaxSize(SO_THE_TOI_DA),
    IsString({ each: true }),
    MaxLength(DO_DAI_MUC_THE_TOI_DA, { each: true }),
  );
}
