import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';
import { IsOptional, IsBoolean, IsString, IsNotEmpty } from 'class-validator';

// F1: admin no longer chooses passwords. Reset is triggered by the
// `resetPassword: true` flag — backend generates a new temp password,
// returns it ONCE in the response, sets mustChangePassword=true, increments
// tokenVersion to invalidate any active access token (C3 fix).
//
// workId override: PartialType làm tất cả field thành optional, kể cả workId.
// Override để giữ workId bắt buộc khi edit (forced migration cho user cũ
// chưa có workId — admin phải bổ sung khi edit bất kỳ field nào).
export class UpdateUserDto extends PartialType(CreateUserDto) {
  @IsString()
  @IsNotEmpty({ message: 'Mã cán bộ là bắt buộc' })
  workId!: string;

  @IsBoolean()
  @IsOptional()
  canDispatch?: boolean;

  @IsBoolean()
  @IsOptional()
  resetPassword?: boolean;
}
