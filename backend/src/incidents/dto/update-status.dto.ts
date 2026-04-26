import { IsEnum, IsOptional, IsString, IsDateString } from 'class-validator';
import { IncidentStatus, LyDoKhongKhoiTo } from '@prisma/client';

export class UpdateStatusDto {
  @IsEnum(IncidentStatus, { message: 'Trạng thái không hợp lệ' })
  status: IncidentStatus;

  @IsOptional()
  @IsString()
  note?: string;

  // Bắt buộc khi status = KHONG_KHOI_TO (Điều 157 BLTTHS 2015)
  @IsOptional()
  @IsEnum(LyDoKhongKhoiTo, {
    message: 'lyDoKhongKhoiTo phải là một trong 7 căn cứ theo Điều 157 BLTTHS 2015',
  })
  lyDoKhongKhoiTo?: LyDoKhongKhoiTo;

  @IsOptional()
  @IsDateString({}, { message: 'expectedUpdatedAt không đúng định dạng ISO 8601' })
  expectedUpdatedAt?: string;
}
