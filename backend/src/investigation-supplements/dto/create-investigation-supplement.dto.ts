import { IsString, IsOptional } from 'class-validator';
import { IsNgayThat } from '../../common/validators/is-ngay-that.validator';

export class CreateInvestigationSupplementDto {
  @IsString()
  caseId: string;

  @IsString()
  type: string;

  @IsString()
  decisionNumber: string;

  @IsOptional()
  @IsNgayThat()
  decisionDate?: string;

  @IsString()
  reason: string;

  @IsOptional()
  @IsNgayThat()
  deadline?: string;

  // ── Ba mốc ngày của bảng "Danh sách điều tra bổ sung" hệ cũ (26/08/2026) ──
  // Máy chủ bật `forbidNonWhitelisted`: thiếu ba dòng này thì gửi lên là cả lời gọi bị từ
  // chối 400, chứ không phải bỏ qua ba trường.
  @IsOptional()
  @IsNgayThat()
  ngayTiepNhanDTBS?: string;

  @IsOptional()
  @IsNgayThat()
  ngayTraHoSoVKS?: string;

  @IsOptional()
  @IsNgayThat()
  ngayTraHoSoToaAn?: string;
}
