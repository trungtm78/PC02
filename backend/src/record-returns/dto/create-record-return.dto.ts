import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { RecordReturnType } from '@prisma/client';

/** Loại hồ sơ được trả — quyết định cột nào trong `record_returns` được set. */
export const RETURN_TARGETS = ['case', 'incident', 'petition'] as const;
export type ReturnTarget = (typeof RETURN_TARGETS)[number];

/**
 * Trả hồ sơ hàng loạt về đơn vị đã chuyển đến.
 *
 * Một yêu cầu chỉ trả một LOẠI hồ sơ. Cho phép trộn vụ án với đơn thư trong
 * cùng một lần bấm nghe tiện, nhưng lý do trả và đơn vị nhận lại thường khác
 * nhau theo loại — gộp lại là mời người dùng gắn nhầm căn cứ cho nửa số hồ sơ.
 */
export class CreateRecordReturnDto {
  @IsIn(RETURN_TARGETS, {
    message: 'Loại hồ sơ phải là case, incident hoặc petition',
  })
  target!: ReturnTarget;

  @IsArray()
  @ArrayNotEmpty({ message: 'Chưa chọn hồ sơ nào để trả' })
  @ArrayMaxSize(200, { message: 'Mỗi lần trả tối đa 200 hồ sơ' })
  @IsString({ each: true })
  ids!: string[];

  @IsEnum(RecordReturnType, { message: 'Lý do trả hồ sơ không hợp lệ' })
  returnType!: RecordReturnType;

  @IsString()
  @MinLength(10, {
    message:
      'Lý do phải có ít nhất 10 ký tự — trả hồ sơ là quyết định tố tụng, phải nêu căn cứ',
  })
  @MaxLength(1000, { message: 'Lý do tối đa 1000 ký tự' })
  reason!: string;

  @IsString()
  @MinLength(2, { message: 'Chưa ghi đơn vị nhận lại hồ sơ' })
  @MaxLength(255)
  toUnit!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  documentNo?: string;
}

export class RevertRecordReturnDto {
  @IsString()
  @MinLength(10, { message: 'Lý do hoàn tác phải có ít nhất 10 ký tự' })
  @MaxLength(1000, { message: 'Lý do tối đa 1000 ký tự' })
  revertReason!: string;
}
