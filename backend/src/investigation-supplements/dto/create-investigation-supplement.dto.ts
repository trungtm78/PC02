import { IsString, IsOptional, IsDateString } from 'class-validator';

export class CreateInvestigationSupplementDto {
  @IsString()
  caseId: string;

  @IsString()
  type: string;

  @IsString()
  decisionNumber: string;

  @IsOptional()
  @IsDateString()
  decisionDate?: string;

  @IsString()
  reason: string;

  @IsOptional()
  @IsDateString()
  deadline?: string;

  // ── Ba mốc ngày của bảng "Danh sách điều tra bổ sung" hệ cũ (26/08/2026) ──
  // Máy chủ bật `forbidNonWhitelisted`: thiếu ba dòng này thì gửi lên là cả lời gọi bị từ
  // chối 400, chứ không phải bỏ qua ba trường.
  @IsOptional()
  @IsDateString()
  ngayTiepNhanDTBS?: string;

  @IsOptional()
  @IsDateString()
  ngayTraHoSoVKS?: string;

  @IsOptional()
  @IsDateString()
  ngayTraHoSoToaAn?: string;
}
