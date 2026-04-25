import { IsString, IsOptional, IsDateString, MaxLength } from 'class-validator';

/**
 * DTO dùng cho API Khởi tố vụ việc (AC-04)
 * Khi nhấn "Khởi tố" → tạo Case mới + update incident status → DA_CHUYEN_VU_AN
 * EC-01: Mã vụ án trùng → hệ thống trả về lỗi hợp lệ
 */
export class ProsecuteIncidentDto {
  // Tên vụ án — bắt buộc (FRD: copy sang Case Management)
  @IsString()
  @MaxLength(500)
  caseName: string;

  // Số quyết định khởi tố — bắt buộc (UI_Specs)
  @IsString()
  @MaxLength(100)
  prosecutionDecision: string;

  // Ngày quyết định khởi tố
  @IsOptional()
  @IsDateString()
  prosecutionDate?: string;

  // Tội danh
  @IsOptional()
  @IsString()
  @MaxLength(255)
  crime?: string;

  @IsOptional()
  @IsDateString({}, { message: 'expectedUpdatedAt không đúng định dạng ISO 8601' })
  expectedUpdatedAt?: string;
}
