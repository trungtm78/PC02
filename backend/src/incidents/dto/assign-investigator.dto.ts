import { IsString, IsOptional, IsDateString, IsUUID } from 'class-validator';

/**
 * DTO dùng cho API Phân công điều tra viên (AC-03)
 * EC-02: Không phân công cho vụ việc ĐÃ KẾT THÚC (DA_GIAI_QUYET)
 */
export class AssignInvestigatorDto {
  // Tổ điều tra — bắt buộc khi dispatcher phân công
  @IsOptional()
  @IsUUID('4')
  assignedTeamId?: string;

  // ID điều tra viên — bắt buộc
  @IsUUID('4')
  investigatorId: string;

  // Hạn xử lý — bắt buộc khi phân công (UI_Specs Table 2.2.E)
  @IsOptional()
  @IsDateString({}, { message: 'Hạn xử lý không đúng định dạng' })
  deadline?: string;

  @IsOptional()
  @IsDateString({}, { message: 'expectedUpdatedAt không đúng định dạng ISO 8601' })
  expectedUpdatedAt?: string;
}
