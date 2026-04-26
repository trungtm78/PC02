import { IsString, IsOptional, IsDateString } from 'class-validator';

/**
 * DTO dùng cho API Phân công điều tra viên (AC-03)
 * EC-02: Không phân công cho vụ việc ĐÃ KẾT THÚC (DA_GIAI_QUYET)
 */
export class AssignInvestigatorDto {
  // Tổ điều tra — tuỳ chọn (dispatcher có thể chỉ assign tổ)
  @IsOptional()
  @IsString()
  assignedTeamId?: string;

  // ID điều tra viên — tuỳ chọn (dispatcher có thể chỉ assign tổ trước)
  @IsOptional()
  @IsString()
  investigatorId?: string;

  // Hạn xử lý — bắt buộc khi phân công (UI_Specs Table 2.2.E)
  @IsOptional()
  @IsDateString({}, { message: 'Hạn xử lý không đúng định dạng' })
  deadline?: string;

  @IsOptional()
  @IsDateString({}, { message: 'expectedUpdatedAt không đúng định dạng ISO 8601' })
  expectedUpdatedAt?: string;
}
