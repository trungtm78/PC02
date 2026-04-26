import { IsString, IsOptional, IsNotEmpty, MaxLength, IsDateString } from 'class-validator';

export class ConvertToIncidentDto {
  @IsString()
  @IsNotEmpty({ message: 'Tên vụ việc là bắt buộc' })
  @MaxLength(500)
  incidentName: string;

  @IsString()
  @IsNotEmpty({ message: 'Loại vụ việc là bắt buộc' })
  @MaxLength(100)
  incidentType: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  assignedToId?: string;

  @IsOptional()
  @IsDateString({}, { message: 'expectedUpdatedAt không đúng định dạng ISO 8601' })
  expectedUpdatedAt?: string;
}
