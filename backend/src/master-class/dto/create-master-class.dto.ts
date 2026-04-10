import { IsString, IsNotEmpty, IsOptional, IsInt, IsBoolean, MaxLength, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { MASTER_CLASS_TYPE_CODES } from '../../common/constants/master-class-types';

export class CreateMasterClassDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(MASTER_CLASS_TYPE_CODES, { message: 'Type không hợp lệ' })
  type: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  order?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
