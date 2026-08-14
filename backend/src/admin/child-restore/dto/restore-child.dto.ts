import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Lý do khôi phục là bắt buộc: khôi phục một hồ sơ đã bị xoá là đảo ngược một
 * quyết định của người khác, và dòng nhật ký chỉ có giá trị khi nó nói vì sao.
 */
export class RestoreChildDto {
  @IsString()
  @MinLength(10, { message: 'Lý do khôi phục phải có ít nhất 10 ký tự' })
  @MaxLength(1000, { message: 'Lý do tối đa 1000 ký tự' })
  reason!: string;
}
