import { IsString, IsOptional, IsEnum } from 'class-validator';
import { TienDoKhacPhuc } from '@prisma/client';
import { IsNgayThat } from '../../../common/validators/is-ngay-that.validator';

export class CreateActionPlanDto {
  @IsNgayThat()
  ngayLap: string;

  @IsString()
  bienPhap: string;

  @IsOptional()
  @IsNgayThat()
  thoiHan?: string;

  @IsOptional()
  @IsEnum(TienDoKhacPhuc)
  tienDo?: TienDoKhacPhuc;

  @IsOptional()
  @IsString()
  ketQua?: string;
}
