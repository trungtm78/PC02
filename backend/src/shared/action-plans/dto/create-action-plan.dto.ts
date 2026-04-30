import { IsString, IsDateString, IsOptional, IsEnum } from 'class-validator';
import { TienDoKhacPhuc } from '@prisma/client';

export class CreateActionPlanDto {
  @IsDateString()
  ngayLap: string;

  @IsString()
  bienPhap: string;

  @IsOptional()
  @IsDateString()
  thoiHan?: string;

  @IsOptional()
  @IsEnum(TienDoKhacPhuc)
  tienDo?: TienDoKhacPhuc;

  @IsOptional()
  @IsString()
  ketQua?: string;
}
