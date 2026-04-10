import {
  IsString,
  IsOptional,
  IsDateString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateIncidentDto {
  // Tên vụ việc — bắt buộc, 5–255 ký tự (Table 2.2.A)
  @IsString()
  @MinLength(5, { message: 'Tên vụ việc phải có ít nhất 5 ký tự' })
  @MaxLength(255, { message: 'Tên vụ việc không được vượt quá 255 ký tự' })
  name: string;

  // Loại vụ việc — tuỳ chọn
  @IsOptional()
  @IsString()
  @MaxLength(100)
  incidentType?: string;

  // Mô tả
  @IsOptional()
  @IsString()
  description?: string;

  // Từ ngày (fromDate) — EC-05: fromDate <= toDate
  @IsOptional()
  @IsDateString({}, { message: 'Từ ngày không đúng định dạng' })
  fromDate?: string;

  // Đến ngày (toDate)
  @IsOptional()
  @IsDateString({}, { message: 'Đến ngày không đúng định dạng' })
  toDate?: string;

  // Hạn xử lý
  @IsOptional()
  @IsDateString({}, { message: 'Hạn xử lý không đúng định dạng' })
  deadline?: string;

  // Đơn vị thụ lý (ID)
  @IsOptional()
  @IsString()
  unitId?: string;

  // Điều tra viên thụ lý (ID)
  @IsOptional()
  @IsString()
  investigatorId?: string;

  // Nguồn từ đơn thư
  @IsOptional()
  @IsString()
  sourcePetitionId?: string;
}
