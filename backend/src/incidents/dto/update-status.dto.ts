import { IsEnum, IsOptional, IsString } from 'class-validator';
import { IncidentStatus } from '@prisma/client';

export class UpdateStatusDto {
  @IsEnum(IncidentStatus, { message: 'Trạng thái không hợp lệ' })
  status: IncidentStatus;

  @IsOptional()
  @IsString()
  note?: string;
}
