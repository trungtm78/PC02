import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  IsEmail,
  IsNotEmpty,
  MaxLength,
  Matches,
  IsBoolean,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { PetitionStatus, LoaiDon } from '@prisma/client';
import { stripHtmlTags } from '../../common/utils/sanitize.util';

// Re-export so other modules can import from this DTO file
export { PetitionStatus, LoaiDon };

export class CreatePetitionDto {
  // Số tiếp nhận — unique. Optional: engine sinh khi không cung cấp
  @IsOptional()
  @Transform(({ value }) => {
    const stripped = stripHtmlTags(value);
    return typeof stripped === 'string' ? stripped.trim() || undefined : stripped;
  })
  @IsString()
  @MaxLength(50)
  stt?: string;

  // Ngày tiếp nhận — bắt buộc, không được là tương lai
  @IsDateString()
  receivedDate: string;

  // Tên người gửi — bắt buộc
  @Transform(({ value }) => stripHtmlTags(value))
  @IsString()
  @MaxLength(255)
  senderName: string;

  @IsOptional()
  @Transform(({ value }) => stripHtmlTags(value))
  @IsString()
  @MaxLength(255)
  unit?: string;

  @IsOptional()
  @IsString()
  enteredById?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4)
  senderBirthYear?: string;

  @IsOptional()
  @Transform(({ value }) => stripHtmlTags(value))
  @IsString()
  @MaxLength(500)
  senderAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^[0-9\s+-]*$/, { message: 'Số điện thoại không hợp lệ' })
  senderPhone?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  @MaxLength(255)
  senderEmail?: string;

  @IsOptional()
  @Transform(({ value }) => stripHtmlTags(value))
  @IsString()
  @MaxLength(255)
  suspectedPerson?: string;

  @IsOptional()
  @Transform(({ value }) => stripHtmlTags(value))
  @IsString()
  @MaxLength(500)
  suspectedAddress?: string;

  @IsNotEmpty({ message: 'Loại đơn thư là bắt buộc' })
  @IsEnum(LoaiDon, {
    message: 'Loại đơn thư không hợp lệ — chọn: Tố cáo, Khiếu nại, Kiến nghị hoặc Phản ánh',
  })
  petitionType: LoaiDon;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  priority?: string;

  @IsOptional()
  @Transform(({ value }) => stripHtmlTags(value))
  @IsString()
  @MaxLength(1000)
  summary?: string;

  @IsOptional()
  @Transform(({ value }) => stripHtmlTags(value))
  @IsString()
  detailContent?: string;

  @IsOptional()
  @Transform(({ value }) => stripHtmlTags(value))
  @IsString()
  attachmentsNote?: string;

  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsOptional()
  @IsString()
  assignedToId?: string;

  // FK Team (Petition.assignedTeamId) — paired with `unit` text label.
  // FE pre-fills both so DataScope team-filter matches the user's primary team.
  @IsOptional()
  @IsString()
  assignedTeamId?: string;

  @IsOptional()
  @Transform(({ value }) => stripHtmlTags(value))
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(PetitionStatus)
  status?: PetitionStatus;

  // v0.47 PR3.1 — Nội dung phiếu đề xuất (T11). Tất cả optional vì chỉ cần khi
  // officer chuẩn bị xuất docx, và phục vụ nhiều doc types khác nhau.

  @IsOptional()
  @Transform(({ value }) => stripHtmlTags(value))
  @IsString()
  @MaxLength(5000)
  nhanThay?: string;

  @IsOptional()
  @Transform(({ value }) => stripHtmlTags(value))
  @IsString()
  @MaxLength(5000)
  deXuat?: string;

  @IsOptional()
  @Transform(({ value }) => stripHtmlTags(value))
  @IsString()
  @MaxLength(1000)
  raSoatTrung?: string;

  @IsOptional()
  @IsBoolean()
  baoCaoBanGiamDoc?: boolean;

  @IsOptional()
  @IsDateString()
  petitionDate?: string;

  @IsOptional()
  @Transform(({ value }) => stripHtmlTags(value))
  @IsString()
  @MaxLength(500)
  nguonDon?: string;

  @IsOptional()
  @Transform(({ value }) => stripHtmlTags(value))
  @IsString()
  @MaxLength(255)
  subTeamAssigned?: string;

  @IsOptional()
  @Transform(({ value }) => stripHtmlTags(value))
  @IsString()
  @MaxLength(2000)
  lyDoChuyen?: string;

  @IsOptional()
  @Transform(({ value }) => stripHtmlTags(value))
  @IsString()
  @MaxLength(1000)
  canCuPhapLy?: string;

  @IsOptional()
  @Transform(({ value }) => stripHtmlTags(value))
  @IsString()
  @MaxLength(5000)
  huongDanKhoiKien?: string;

  @IsOptional()
  @Transform(({ value }) => stripHtmlTags(value))
  @IsString()
  @MaxLength(2000)
  lyDoTraDon?: string;
}
